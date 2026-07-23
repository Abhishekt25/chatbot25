import { Queue, Worker, Job } from "bullmq";
import { Server } from "socket.io";
import { redis, bullMQConnection } from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import { sendAgentAssignedEmail } from "./email.service.js";
import { logger } from "../utils/logger.js";

export const handoffQueue = new Queue("handoff", {
 connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

type HandoffJob = {
  sessionId: string;
  userMessage: string;
};

export async function queueHandoff(
  sessionId: string,
  userMessage: string
): Promise<void> {
  await handoffQueue.add("assign-agent", { sessionId, userMessage } as HandoffJob);
  logger.info("Handoff queued", { sessionId });
}

export function startHandoffWorker(io: Server) {
  try {
    const worker = new Worker<HandoffJob>(
      "handoff",
      async (job: Job<HandoffJob>) => {
      const { sessionId, userMessage } = job.data;

      // Find the least-busy online agent
      const agent = await prisma.agent.findFirst({
        where: { isOnline: true },
        orderBy: { sessions: { _count: "asc" } },
      });

      if (!agent) {
        logger.warn("No agents online, will retry", { sessionId });
        throw new Error("No agents available — retrying");
      }

      // Assign agent to session
      await prisma.session.update({
        where: { id: sessionId },
        data: { agentId: agent.id, status: "HUMAN" },
      });

      // Notify agent dashboard via socket
      io.to(`agent:${agent.id}`).emit("new_chat_assigned", {
        sessionId,
        userMessage,
      });

      // Notify user that agent joined
      io.to(`session:${sessionId}`).emit("agent_joined", {
        agentName: agent.name,
        message: `You are now connected to ${agent.name} from our support team.`,
      });

      // Send email alert to agent (non-blocking)
      sendAgentAssignedEmail(agent.email, agent.name, sessionId, userMessage);

      logger.info("Agent assigned to session", {
        sessionId,
        agentId: agent.id,
        agentName: agent.name,
      });
    },
      {
        connection: bullMQConnection,
        concurrency: 10,
      }
    );

    worker.on("failed", (job, err) => {
    logger.error("Handoff job failed", {
      jobId: job?.id,
      attempt: job?.attemptsMade,
      error: err.message,
    });

    // After all retries exhausted, notify user
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      const { sessionId } = job.data;
      io.to(`session:${sessionId}`).emit("no_agents_available", {
        message:
          "All our agents are busy right now. Please try again in a few minutes or leave your email and we will get back to you.",
      });
    }
  });

    worker.on("completed", (job) => {
      logger.info("Handoff job completed", { jobId: job.id });
    });

    logger.info("Handoff worker started");
    return worker;
  } catch (err) {
    logger.error("Failed to start handoff worker; continuing without queue processing", {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return null;
  }
}
