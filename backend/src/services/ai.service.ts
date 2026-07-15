import OpenAI from "openai";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const client = new OpenAI({
  apiKey: config.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `You are a helpful and friendly customer support assistant.

Guidelines:
- Be concise, warm, and professional in every reply.
- If the user is clearly frustrated, angry, or explicitly asks for a human agent or real person, respond ONLY with: [ESCALATE]
- Do not include anything else when you respond with [ESCALATE].
- Otherwise answer the user's question helpfully.
- Keep responses under 3 short paragraphs.
- Do not reveal you are an AI unless directly asked.`;

export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function getAIResponse(
  history: AIMessage[],
  userMessage: string
): Promise<{ text: string; shouldEscalate: boolean }> {
  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },

        ...history,

        {
          role: "user",
          content: userMessage,
        },
      ],

      temperature: 0.7,
      max_tokens: 500,
    });

    const text =
      completion.choices[0]?.message?.content?.trim() || "";

    if (text.includes("[ESCALATE]")) {
      return {
        text: "I'll connect you with a human agent right away. Please hold on for a moment — someone will be with you shortly.",
        shouldEscalate: true,
      };
    }

    return {
      text,
      shouldEscalate: false,
    };
  } catch (err: any) {
    console.error("========== GROQ ERROR ==========");
    console.dir(err, { depth: null });

    console.log("Message:", err?.message);
    console.log("Status:", err?.status);

    if (err?.response) {
      console.log("Response:");
      console.dir(err.response, { depth: null });
    }

    logger.error("Groq API error", { err });

    throw new Error("AI service temporarily unavailable");
  }
}

/**
 * Fast keyword-based escalation detection.
 */
export function detectEscalationKeywords(message: string): boolean {
  const keywords = [
    "human",
    "agent",
    "real person",
    "live person",
    "support staff",
    "talk to someone",
    "speak to someone",
    "representative",
    "not helping",
    "useless",
    "not useful",
    "this is terrible",
    "refund",
    "complaint",
    "manager",
    "supervisor",
    "escalate",
    "connect me",
    "transfer me",
  ];

  const lower = message.toLowerCase();

  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Converts DB messages into OpenAI/Groq chat history.
 */
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