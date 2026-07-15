import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { config } from "./config/env.js";
import { connectDB } from "./config/prisma.js";
import { connectRedis } from "./config/redis.js";
import { prisma } from "./config/prisma.js";
import { logger } from "./utils/logger.js";
import { registerSocketHandlers } from "./services/socket.service.js";
import { startHandoffWorker } from "./services/queue.service.js";
import authRoutes from "./routes/auth.routes.js";
import sessionRoutes from "./routes/session.routes.js";

const app = express();
const httpServer = createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: {
    origin: config.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Required for Railway (behind a proxy)
  transports: ["websocket", "polling"],
});

// ── Middleware ────────────────────────────────────────────────────────
app.set("trust proxy", 1); // Required when behind Railway/Nginx proxy

app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// ── Health check (Railway uses this) ─────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  });
});

// ── Routes ────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);

// CSAT from email link → redirect to frontend with score
app.get("/csat/:sessionId/:score", async (req, res) => {
  const { sessionId, score } = req.params;
  try {
    const s = parseInt(score);
    if (s >= 1 && s <= 5) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { csatScore: s },
      });
    }
    // Redirect to frontend thank-you page
    res.redirect(`${config.FRONTEND_URL}/csat/thanks`);
  } catch {
    res.redirect(`${config.FRONTEND_URL}/csat/thanks`);
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();
    logger.info("✅ Database connected");

    await connectRedis();

    registerSocketHandlers(io);

    try {
      startHandoffWorker(io);
    } catch (err) {
      logger.warn("Handoff worker unavailable, continuing without it", {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
    }

    httpServer.listen(config.PORT, () => {
      logger.info(`🚀 Server running`, {
        port: config.PORT,
        env: config.NODE_ENV,
        frontend: config.FRONTEND_URL,
      });
    });
  } catch (err) {
    logger.error("Failed to start server", {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    process.exit(1);
  }
}

bootstrap();
