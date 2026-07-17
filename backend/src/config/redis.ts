import Redis from "ioredis";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  tls: config.REDIS_URL.startsWith("rediss://") ? {} : undefined,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error", { message: err.message }));

// No connectRedis function needed — ioredis auto-connects from URL
export async function connectRedis() {
  // Already connected via constructor — nothing to do
  return Promise.resolve();
}