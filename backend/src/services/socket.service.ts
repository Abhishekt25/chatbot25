import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  getAIResponse,
  detectEscalationKeywords,
  buildGeminiHistory,
} from "./ai.service.js";
import { queueHandoff } from "./queue.service.js";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.debug("Socket connected", { id: socket.id });

    // ── USER: join their session room ──────────────────────────────────
    socket.on("join_session", async ({ sessionId, userId }) => {
      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            messages: { orderBy: { createdAt: "asc" }, take: 50 },
          },
        });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

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

    // ── AGENT: go online (dashboard loaded) ───────────────────────────
    socket.on("agent_online", async ({ token }) => {
      try {
        const payload = jwt.verify(token, config.JWT_SECRET) as {
          agentId: string;
        };

        socket.join(`agent:${payload.agentId}`);
        socket.data.agentId = payload.agentId;
        socket.data.role = "agent";

        await prisma.agent.update({
          where: { id: payload.agentId },
          data: { isOnline: true },
        });
        await redis.sadd("online_agents", payload.agentId);

        logger.info("Agent online", { agentId: payload.agentId });
      } catch {
        socket.emit("error", { message: "Unauthorized" });
      }
    });

    // ── AGENT: join a specific session to chat ─────────────────────────
    socket.on("agent_join_session", async ({ token, sessionId }) => {
      try {
        const payload = jwt.verify(token, config.JWT_SECRET) as {
          agentId: string;
        };

        socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;

        // Send history to agent
        const messages = await prisma.message.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
        });
        socket.emit("session_history", { messages });

        logger.info("Agent joined session", {
          agentId: payload.agentId,
          sessionId,
        });
      } catch {
        socket.emit("error", { message: "Unauthorized" });
      }
    });

    // ── USER: send a message ───────────────────────────────────────────
    socket.on("user_message", async ({ sessionId, content }) => {
      try {
        if (!content?.trim()) return;

        const session = await prisma.session.findUnique({
          where: { id: sessionId },
        });
        if (!session || session.status === "CLOSED") return;

        // Save user message
        const userMsg = await prisma.message.create({
          data: { sessionId, role: "USER", content: content.trim() },
        });
        io.to(`session:${sessionId}`).emit("new_message", userMsg);

        // If human agent is already handling — stop here, agent replies manually
        if (session.status === "HUMAN") return;

        // Quick keyword check first (faster than AI call)
        const keywordEscalate = detectEscalationKeywords(content);

        // Get last 20 messages for AI context
        const recentMessages = await prisma.message.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
          take: 20,
        });

        const history = buildGeminiHistory(
          recentMessages.filter((m) => m.id !== userMsg.id)
        );

        const { text: aiText, shouldEscalate: aiEscalate } =
          await getAIResponse(history, content);

        const shouldEscalate = keywordEscalate || aiEscalate;

        // Save and send AI reply
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
          io.to(`session:${sessionId}`).emit("status_change", {
            status: "PENDING_HUMAN",
          });
          await queueHandoff(sessionId, content);
        }
      } catch (err) {
        logger.error("user_message error", { err });
        socket.emit("error", { message: "Could not send message" });
      }
    });

    // ── USER: manually click "Talk to human" button ────────────────────
    socket.on("request_human", async ({ sessionId }) => {
      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
        });
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
            content:
              "Connecting you to a human agent. Please hold on a moment...",
          },
        });

        io.to(`session:${sessionId}`).emit("new_message", sysMsg);
        io.to(`session:${sessionId}`).emit("status_change", {
          status: "PENDING_HUMAN",
        });

        await queueHandoff(
          sessionId,
          lastUserMsg?.content ?? "User requested a human agent"
        );
      } catch (err) {
        logger.error("request_human error", { err });
      }
    });

    // ── AGENT: send a message ──────────────────────────────────────────
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

    // ── DISCONNECT: mark agent offline if no other sockets ────────────
    socket.on("disconnect", async () => {
      const { agentId, role } = socket.data;
      if (role === "agent" && agentId) {
        // Wait a moment then check if agent has other active sockets
        setTimeout(async () => {
          const sockets = await io.in(`agent:${agentId}`).fetchSockets();
          if (sockets.length === 0) {
            await prisma.agent
              .update({
                where: { id: agentId },
                data: { isOnline: false },
              })
              .catch(() => {});
            await redis.srem("online_agents", agentId);
            logger.info("Agent went offline", { agentId });
          }
        }, 2000);
      }
    });
  });
}
