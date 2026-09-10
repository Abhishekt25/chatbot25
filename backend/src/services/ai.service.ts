import OpenAI from "openai";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const client = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": config.FRONTEND_URL,
    "X-Title": "Support Chatbot",
  },
});

export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

// ─── Core AI call — used by LangGraph nodes ───────────────────────────────────

export async function callAI(
  history: AIMessage[],
  userMessage: string,
  systemPrompt: string
): Promise<{ text: string; shouldEscalate: boolean }> {
  try {
    const completion = await client.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";

    if (text.includes("[ESCALATE]")) {
      return { text: "", shouldEscalate: true };
    }

    return { text, shouldEscalate: false };
  } catch (err: any) {
    logger.error("OpenRouter API error", {
      message: err?.message,
      status: err?.status,
    });
    throw new Error("AI service temporarily unavailable");
  }
}

// ─── Keyword-based escalation detection ──────────────────────────────────────

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

// ─── Build chat history from DB messages ──────────────────────────────────────

export function buildHistory(
  messages: { role: string; content: string }[]
): AIMessage[] {
  return messages
    .filter((m) => m.role === "USER" || m.role === "AI")
    .map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));
}
