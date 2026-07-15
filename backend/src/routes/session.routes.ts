import { Router, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { io } from "../index.js";
import { agentAuth } from "../middleware/auth.js";
import {
  sendTranscriptEmail,
  sendCSATEmail,
} from "../services/email.service.js";

const router = Router();

// Create a new session (called when user opens chat)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;

    let user;
    if (email) {
      user = await prisma.user.upsert({
        where: { email },
        update: { name: name || undefined },
        create: { email, name: name || "Guest" },
      });
    } else {
      user = await prisma.user.create({
        data: { name: name || "Guest" },
      });
    }

    const session = await prisma.session.create({
      data: { userId: user.id, status: "BOT" },
    });

    res.status(201).json({
      sessionId: session.id,
      userId: user.id,
      userName: user.name,
    });
  } catch {
    res.status(500).json({ error: "Could not create session" });
  }
});

// Get messages for a session
router.get("/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const messages = await prisma.message.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ messages });
  } catch {
    res.status(500).json({ error: "Could not fetch messages" });
  }
});

// List all sessions (agent dashboard)
router.get("/", agentAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const sessions = await prisma.session.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: { select: { name: true, email: true } },
        agent: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    res.json({ sessions });
  } catch {
    res.status(500).json({ error: "Could not fetch sessions" });
  }
});

// Get single session details
router.get("/:sessionId", agentAuth, async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
      include: {
        user: { select: { name: true, email: true } },
        agent: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ session });
  } catch {
    res.status(500).json({ error: "Could not fetch session" });
  }
});

// Close a session — sends transcript + CSAT email
router.post(
  "/:sessionId/close",
  agentAuth,
  async (req: Request, res: Response) => {
    try {
      const session = await prisma.session.update({
        where: { id: req.params.sessionId },
        data: { status: "CLOSED", closedAt: new Date() },
        include: {
          user: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      // Send emails if user provided their email
      if (session.user.email) {
        const emailMessages = session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }));

      // Notify user in real-time that chat is closed
      io.to(`session:${req.params.sessionId}`).emit("session_closed", {
        message: "This chat has been closed by the support agent. You can start a new conversation anytime.",
      });

        // Non-blocking — don't make agent wait for email
        sendTranscriptEmail(
          session.user.email,
          session.user.name ?? "there",
          emailMessages
        );
        sendCSATEmail(
          session.user.email,
          session.user.name ?? "there",
          session.id
        );
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Could not close session" });
    }
  }
);

// Submit CSAT rating (from email link or in-app)
router.post("/:sessionId/csat", async (req: Request, res: Response) => {
  try {
    const score = parseInt(req.body.score);
    if (!score || score < 1 || score > 5) {
      res.status(400).json({ error: "Score must be between 1 and 5" });
      return;
    }
    await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { csatScore: score },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not save rating" });
  }
});

export default router;
