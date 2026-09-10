import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { buildHistory, detectEscalationKeywords } from "./ai.service.js";
import { runGraph } from "./graph.service.js";  // ← LangGraph
import { queueHandoff } from "./queue.service.js";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.debug("Socket connected", { id: socket.id });

    // ── USER: join session ────────────────────────────────────────────
    socket.on("join_session", async ({ sessionId, userId }) => {
      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            messages: { orderBy: { createdAt: "asc" }, take: 50 },
          },
        });
        if (!session) { socket.emit("error", { message: "Session not found" }); return; }

        socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.userId = userId;
        socket.data.role = "user";

        socket.emit("session_history", {
          messages: session.messages,
          status: session.status,
        });
        logger.info("User joined session", { sessionId });
      } catch (err) {
        logger.error("join_session error", { err });
        socket.emit("error", { message: "Could not join session" });
      }
    });

    // ── AGENT: go online ──────────────────────────────────────────────
    socket.on("agent_online", async ({ token }) => {
      try {
        const payload = jwt.verify(token, config.JWT_SECRET) as { agentId: string };
        socket.join(`agent:${payload.agentId}`);
        socket.data.agentId = payload.agentId;
        socket.data.role = "agent";
        await prisma.agent.update({ where: { id: payload.agentId }, data: { isOnline: true } });
        await redis.sadd("online_agents", payload.agentId);
        logger.info("Agent online", { agentId: payload.agentId });
      } catch { socket.emit("error", { message: "Unauthorized" }); }
    });

    // ── AGENT: join specific session ──────────────────────────────────
    socket.on("agent_join_session", async ({ token, sessionId }) => {
      try {
        jwt.verify(token, config.JWT_SECRET);
        socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        const messages = await prisma.message.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
        });
        socket.emit("session_history", { messages });
      } catch { socket.emit("error", { message: "Unauthorized" }); }
    });

    // ── USER: send message → LangGraph processes it ───────────────────
    socket.on("user_message", async ({ sessionId, content }) => {
      try {
        if (!content?.trim()) return;

        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session || session.status === "CLOSED") return;

        // Save user message
        const userMsg = await prisma.message.create({
          data: { sessionId, role: "USER", content: content.trim() },
        });
        io.to(`session:${sessionId}`).emit("new_message", userMsg);

        // If human agent already handling — stop
        if (session.status === "HUMAN") return;

        // Get chat history for context
        const recentMessages = await prisma.message.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
          take: 20,
        });
        const history = buildHistory(
          recentMessages.filter((m: { id: string; role: string; content: string }) => m.id !== userMsg.id)
        );

        // ── RUN LANGGRAPH ──
        // This replaces the simple getAIResponse() call
        // Graph: retrieve → grade → rag_answer/general_answer → escalate?
        const { text: aiText, shouldEscalate } = await runGraph(
          content,
          history
        );

        // Save AI reply
        const aiMsg = await prisma.message.create({
          data: { sessionId, role: "AI", content: aiText },
        });
        io.to(`session:${sessionId}`).emit("new_message", aiMsg);

        // Escalate if needed
        if (shouldEscalate && session.status === "BOT") {
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: "PENDING_HUMAN" },
          });
          io.to(`session:${sessionId}`).emit("status_change", { status: "PENDING_HUMAN" });
          await queueHandoff(sessionId, content);
        }
      } catch (err) {
        logger.error("user_message error", { err });
        socket.emit("error", { message: "Could not send message" });
      }
    });

    // ── USER: request human manually ──────────────────────────────────
    socket.on("request_human", async ({ sessionId }) => {
      try {
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session || session.status !== "BOT") return;

        const lastUserMsg = await prisma.message.findFirst({
          where: { sessionId, role: "USER" },
          orderBy: { createdAt: "desc" },
        });

        await prisma.session.update({
          where: { id: sessionId },
          data: { status: "PENDING_HUMAN" },
        });

        const sysMsg = await prisma.message.create({
          data: {
            sessionId,
            role: "SYSTEM",
            content: "Connecting you to a human agent. Please hold on...",
          },
        });

        io.to(`session:${sessionId}`).emit("new_message", sysMsg);
        io.to(`session:${sessionId}`).emit("status_change", { status: "PENDING_HUMAN" });
        await queueHandoff(sessionId, lastUserMsg?.content ?? "User requested agent");
      } catch (err) {
        logger.error("request_human error", { err });
      }
    });

    // ── AGENT: send message ───────────────────────────────────────────
    socket.on("agent_message", async ({ sessionId, content }) => {
      try {
        const agentId = socket.data.agentId;
        if (!agentId || !content?.trim()) return;
        const msg = await prisma.message.create({
          data: { sessionId, role: "AGENT", content: content.trim() },
        });
        io.to(`session:${sessionId}`).emit("new_message", msg);
      } catch (err) {
        logger.error("agent_message error", { err });
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const { agentId, role } = socket.data;
      if (role === "agent" && agentId) {
        setTimeout(async () => {
          const sockets = await io.in(`agent:${agentId}`).fetchSockets();
          if (sockets.length === 0) {
            await prisma.agent.update({ where: { id: agentId }, data: { isOnline: false } }).catch(() => {});
            await redis.srem("online_agents", agentId);
            logger.info("Agent went offline", { agentId });
          }
        }, 2000);
      }
    });
  });
}
