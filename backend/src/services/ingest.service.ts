import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { storeDocument, hasDocuments } from "./rag.service.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type FAQItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

// ─── Load demo FAQ data into pgvector ─────────────────────────────────────────

export async function ingestDemoFAQ(): Promise<{ count: number }> {
  const filePath = join(__dirname, "../../data/demo-faq.json");
  const raw = readFileSync(filePath, "utf-8");
  const faqs: FAQItem[] = JSON.parse(raw);

  logger.info("Starting FAQ ingestion", { total: faqs.length });

  let count = 0;
  for (const faq of faqs) {
    try {
      // Store Q+A together for better semantic search
      const content = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
      const metadata = {
        id: faq.id,
        category: faq.category,
        question: faq.question,
        source: "demo-faq",
      };

      await storeDocument(content, metadata);
      count++;
      logger.debug("Ingested FAQ", { id: faq.id, category: faq.category });
    } catch (err) {
      logger.error("Failed to ingest FAQ", { id: faq.id, err });
    }
  }

  logger.info("FAQ ingestion complete", { ingested: count, total: faqs.length });
  return { count };
}

// ─── Clear all documents ───────────────────────────────────────────────────────

export async function clearDocuments(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "Document"`;
  logger.info("All documents cleared");
}

// ─── Auto-ingest on server start if DB is empty ───────────────────────────────

export async function autoIngestIfEmpty(): Promise<void> {
  try {
    const exists = await hasDocuments();
    if (!exists) {
      logger.info("No documents found — auto-ingesting demo FAQ...");
      await ingestDemoFAQ();
    } else {
      logger.info("Documents already exist — skipping auto-ingest");
    }
  } catch (err) {
    logger.error("Auto-ingest failed", { err });
  }
}
