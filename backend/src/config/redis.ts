import Redis from "ioredis";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

const tlsOptions = config.REDIS_URL.startsWith("rediss://") ? {} : undefined;

// General purpose Redis client
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  tls: tlsOptions,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error", { message: err.message }));

// BullMQ connection options — uses URL string directly
// so BullMQ creates its own ioredis instance internally
export const bullMQConnection = {
  url: config.REDIS_URL,
  tls: tlsOptions,
  maxRetriesPerRequest: null,
} as const;

export async function connectRedis() {
  return Promise.resolve();
}