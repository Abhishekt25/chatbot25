import { PrismaClient } from "@prisma/client";
import { config } from "./env.js";

export const prisma = new PrismaClient({
  log: config.NODE_ENV === "development" ? ["error"] : ["error"],
});

export async function connectDB() {
  await prisma.$connect();
}
