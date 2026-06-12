import Redis from "ioredis";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

// Railway Redis uses rediss:// (TLS), local Docker uses redis://
// ioredis handles both automatically from the URL
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Required for Railway Redis which uses TLS
  tls: config.REDIS_URL.startsWith("rediss://") ? {} : undefined,
});

redis.on("connect", () => logger.info("✅ Redis connected"));
redis.on("error", (err) => logger.error("Redis error", { message: err.message }));

export async function connectRedis() {
  await redis.connect();
}
