import { logger } from "../utils/logger.js";
import {
  searchDocuments,
  formatDocsAsContext,
  RetrievedDoc,
} from "./rag.service.js";
import { callAI, detectEscalationKeywords } from "./ai.service.js";

// ─── Graph State ──────────────────────────────────────────────────────────────
// This is the state that flows through all nodes in the graph

export type GraphState = {
  userMessage: string;
  chatHistory: { role: "user" | "assistant"; content: string }[];

  // RAG
  retrievedDocs: RetrievedDoc[];
  hasRelevantDocs: boolean;
  context: string;

  // Output
  finalAnswer: string;
  shouldEscalate: boolean;
  escalationReason: string;

  // Routing
  currentNode: string;
};

// ─── NODE 1: Retrieve documents ───────────────────────────────────────────────

async function nodeRetrieve(state: GraphState): Promise<Partial<GraphState>> {
  logger.debug("LangGraph: nodeRetrieve", { query: state.userMessage.slice(0, 50) });

  // First check keywords — no need to search if user wants human
  if (detectEscalationKeywords(state.userMessage)) {
    return {
      currentNode: "escalate",
      shouldEscalate: true,
      escalationReason: "keyword",
      retrievedDocs: [],
      hasRelevantDocs: false,
    };
  }

  const docs = await searchDocuments(state.userMessage, 3, 0.45);

  return {
    currentNode: "grade",
    retrievedDocs: docs,
    hasRelevantDocs: docs.length > 0,
  };
}

// ─── NODE 2: Grade relevance ──────────────────────────────────────────────────
// Decides if the retrieved docs are actually useful for this question

async function nodeGrade(state: GraphState): Promise<Partial<GraphState>> {
  logger.debug("LangGraph: nodeGrade", { docsFound: state.retrievedDocs.length });

  if (!state.hasRelevantDocs) {
    // No docs found — go to general AI answer
    return { currentNode: "general_answer" };
  }

  // Check if top doc similarity is high enough
  const topDoc = state.retrievedDocs[0];
  if (topDoc.similarity < 0.55) {
    // Docs found but not very relevant — use general AI
    return { currentNode: "general_answer" };
  }

  const context = formatDocsAsContext(state.retrievedDocs);
  return { currentNode: "rag_answer", context };
}

// ─── NODE 3A: RAG Answer (answer using documents) ────────────────────────────

async function nodeRAGAnswer(state: GraphState): Promise<Partial<GraphState>> {
  logger.debug("LangGraph: nodeRAGAnswer");

  const systemPrompt = `You are a helpful customer support assistant.
Answer the user's question using ONLY the information provided in the knowledge base below.
Be concise, accurate, and friendly.
If the knowledge base does not fully answer the question, say so and offer to connect them with a human agent.
If the user asks for a human agent, respond ONLY with: [ESCALATE]

${state.context}`;

  const { text, shouldEscalate } = await callAI(
    state.chatHistory,
    state.userMessage,
    systemPrompt
  );

  if (shouldEscalate) {
    return {
      currentNode: "escalate",
      shouldEscalate: true,
      escalationReason: "ai_decision",
      finalAnswer:
        "I'll connect you with a human agent right away. Please hold on.",
    };
  }

  return {
    currentNode: "end",
    finalAnswer: text,
    shouldEscalate: false,
  };
}

// ─── NODE 3B: General Answer (no relevant docs found) ────────────────────────

async function nodeGeneralAnswer(
  state: GraphState
): Promise<Partial<GraphState>> {
  logger.debug("LangGraph: nodeGeneralAnswer");

  const systemPrompt = `You are a helpful customer support assistant.
Be concise, warm, and professional.
If the user asks for a human agent or is clearly frustrated, respond ONLY with: [ESCALATE]
Answer the user's question as helpfully as possible.
If you are not sure, offer to connect them with a human agent.`;

  const { text, shouldEscalate } = await callAI(
    state.chatHistory,
    state.userMessage,
    systemPrompt
  );

  if (shouldEscalate) {
    return {
      currentNode: "escalate",
      shouldEscalate: true,
      escalationReason: "ai_decision",
      finalAnswer:
        "I'll connect you with a human agent right away. Please hold on.",
    };
  }

  return {
    currentNode: "end",
    finalAnswer: text,
    shouldEscalate: false,
  };
}

// ─── NODE 4: Escalate ─────────────────────────────────────────────────────────

function nodeEscalate(state: GraphState): Partial<GraphState> {
  logger.info("LangGraph: nodeEscalate", { reason: state.escalationReason });
  return {
    currentNode: "end",
    shouldEscalate: true,
    finalAnswer:
      "I'll connect you with a human agent right away. Please hold on for a moment — someone will be with you shortly.",
  };
}

// ─── GRAPH RUNNER ─────────────────────────────────────────────────────────────
// Runs the graph node by node based on routing decisions

export async function runGraph(
  userMessage: string,
  chatHistory: { role: "user" | "assistant"; content: string }[]
): Promise<{ text: string; shouldEscalate: boolean }> {
  // Initial state
  let state: GraphState = {
    userMessage,
    chatHistory,
    retrievedDocs: [],
    hasRelevantDocs: false,
    context: "",
    finalAnswer: "",
    shouldEscalate: false,
    escalationReason: "",
    currentNode: "retrieve",
  };

  logger.debug("LangGraph: starting", { message: userMessage.slice(0, 50) });

  // Run the graph
  let iterations = 0;
  const maxIterations = 10;

  while (state.currentNode !== "end" && iterations < maxIterations) {
    iterations++;
    let updates: Partial<GraphState> = {};

    switch (state.currentNode) {
      case "retrieve":
        updates = await nodeRetrieve(state);
        break;
      case "grade":
        updates = await nodeGrade(state);
        break;
      case "rag_answer":
        updates = await nodeRAGAnswer(state);
        break;
      case "general_answer":
        updates = await nodeGeneralAnswer(state);
        break;
      case "escalate":
        updates = nodeEscalate(state);
        break;
      default:
        logger.error("LangGraph: unknown node", { node: state.currentNode });
        state.currentNode = "end";
    }

    // Merge updates into state
    state = { ...state, ...updates };
    logger.debug("LangGraph: node completed", { nextNode: state.currentNode });
  }

  return {
    text: state.finalAnswer || "I'm sorry, I could not process your request.",
    shouldEscalate: state.shouldEscalate,
  };
}
