import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";

// ─── HuggingFace Embedding (free, no API key needed) ─────────────────────────
// Uses the Xenova/all-MiniLM-L6-v2 model locally
// 384 dimensions — matches our pgvector column

let pipeline: any = null;

async function getEmbeddingPipeline() {
  if (!pipeline) {
    // Dynamic import — @xenova/transformers runs in Node.js
    const { pipeline: createPipeline } = await import("@xenova/transformers");
    pipeline = await createPipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    logger.info("HuggingFace embedding model loaded");
  }
  return pipeline;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data) as number[];
}

// ─── Store a document chunk in pgvector ──────────────────────────────────────

export async function storeDocument(
  content: string,
  metadata: Record<string, any>
): Promise<void> {
  const embedding = await generateEmbedding(content);
  const vectorStr = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    INSERT INTO "Document" (id, content, metadata, embedding, "createdAt")
    VALUES (
      gen_random_uuid(),
      ${content},
      ${JSON.stringify(metadata)}::jsonb,
      ${vectorStr}::vector,
      NOW()
    )
  `;
}

// ─── Search similar documents using cosine similarity ────────────────────────

export type RetrievedDoc = {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
};

export async function searchDocuments(
  query: string,
  topK: number = 3,
  threshold: number = 0.5
): Promise<RetrievedDoc[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    const results = await prisma.$queryRaw<RetrievedDoc[]>`
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM "Document"
      WHERE 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;

    logger.debug("RAG search results", {
      query: query.slice(0, 50),
      found: results.length,
    });

    return results;
  } catch (err) {
    logger.error("RAG search error", { err });
    return [];
  }
}

// ─── Format retrieved docs as context string ──────────────────────────────────

export function formatDocsAsContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) return "";

  const formatted = docs
    .map((doc, i) => {
      const meta = doc.metadata as any;
      return `[Source ${i + 1}] ${meta?.category || "General"}: ${doc.content}`;
    })
    .join("\n\n");

  return `RELEVANT KNOWLEDGE BASE INFORMATION:\n${formatted}`;
}

// ─── Check if we have any documents in the DB ─────────────────────────────────

export async function hasDocuments(): Promise<boolean> {
  const count = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "Document"
  `;
  return Number(count[0].count) > 0;
}
