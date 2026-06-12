import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a helpful and friendly customer support assistant.
Guidelines:
- Be concise, warm, and professional in every reply.
- If the user is clearly frustrated, angry, or explicitly asks for a human agent or real person, respond ONLY with: [ESCALATE]
- Do not include anything else when you respond with [ESCALATE].
- Otherwise answer the user's question helpfully.
- Keep responses under 3 short paragraphs.
- Do not reveal you are an AI unless directly asked.`;

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export async function getAIResponse(
  history: GeminiMessage[],
  userMessage: string
): Promise<{ text: string; shouldEscalate: boolean }> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage);
    const text = result.response.text().trim();

    if (text.includes("[ESCALATE]")) {
      return {
        text: "I'll connect you with a human agent right away. Please hold on for a moment — someone will be with you shortly.",
        shouldEscalate: true,
      };
    }

    return { text, shouldEscalate: false };
  } catch (err) {
    logger.error("Gemini API error", { err });
    throw new Error("AI service temporarily unavailable");
  }
}

// Keyword-based escalation detection as a fast first check
export function detectEscalationKeywords(message: string): boolean {
  const keywords = [
    "human", "agent", "real person", "live person", "support staff",
    "talk to someone", "speak to someone", "representative",
    "not helping", "useless", "not useful", "this is terrible",
    "refund", "complaint", "manager", "supervisor", "escalate",
    "connect me", "transfer me",
  ];
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// Convert DB messages to Gemini history format
export function buildGeminiHistory(
  messages: { role: string; content: string }[]
): GeminiMessage[] {
  return messages
    .filter((m) => m.role === "USER" || m.role === "AI")
    .map((m) => ({
      role: m.role === "USER" ? "user" : "model",
      parts: [{ text: m.content }],
    }));
}
