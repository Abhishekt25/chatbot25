import Redis from "ioredis";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

// Railway Redis uses rediss:// (TLS), local Docker uses redis://
// ioredis handles both automatically from the URL
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  tls: config.REDIS_URL.startsWith("rediss://") ? {} : undefined,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error", { message: err.message }));

export async function connectRedis() {
  if (redis.status === "ready") {
    return;
  }

  if (redis.status === "connecting") {
    return;
  }

  await redis.connect();
}
