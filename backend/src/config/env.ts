import { z } from "zod";
import dotenv from "dotenv";

// Load .env only in local/dev — Railway injects env vars directly
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const envSchema = z.object({
  // Database — local: docker service name, production: Railway connection string
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis — local: docker service name, production: Railway Redis URL
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),

  // GROQ AI
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),

  // Brevo SMTP
  BREVO_SMTP_HOST: z.string().default("smtp-relay.brevo.com"),
  BREVO_SMTP_PORT: z.coerce.number().default(587),
  BREVO_SMTP_USER: z.string().min(1, "BREVO_SMTP_USER is required"),
  BREVO_SMTP_PASS: z.string().min(1, "BREVO_SMTP_PASS is required"),

  // App
  PORT: z.coerce.number().default(4000),
  // LOCAL → http://localhost:5173  |  PRODUCTION → https://your-app.vercel.app
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  FROM_EMAIL: z.string().email("FROM_EMAIL must be a valid email"),
  FROM_NAME: z.string().default("Support Team"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:\n",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  );
  process.exit(1);
}

export const config = parsed.data;
