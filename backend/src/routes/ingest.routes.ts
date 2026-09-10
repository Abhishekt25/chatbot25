import { Router, Request, Response } from "express";
import { agentAuth } from "../middleware/auth.js";
import {
  ingestDemoFAQ,
  clearDocuments,
} from "../services/ingest.service.js";
import { hasDocuments } from "../services/rag.service.js";
import { prisma } from "../config/prisma.js";

const router = Router();

// GET /api/ingest/status — check how many documents are loaded
router.get("/status", agentAuth, async (_req: Request, res: Response) => {
  try {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Document"
    `;
    const count = Number(result[0].count);
    res.json({
      documentsLoaded: count,
      hasDocuments: count > 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not get status" });
  }
});

// POST /api/ingest/demo — load demo FAQ data
router.post("/demo", agentAuth, async (_req: Request, res: Response) => {
  try {
    const { count } = await ingestDemoFAQ();
    res.json({
      success: true,
      message: `Ingested ${count} FAQ documents`,
      count,
    });
  } catch (err) {
    res.status(500).json({ error: "Ingestion failed" });
  }
});

// DELETE /api/ingest/clear — clear all documents
router.delete("/clear", agentAuth, async (_req: Request, res: Response) => {
  try {
    await clearDocuments();
    res.json({ success: true, message: "All documents cleared" });
  } catch (err) {
    res.status(500).json({ error: "Could not clear documents" });
  }
});

export default router;
