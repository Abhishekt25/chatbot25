import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { config } from "../config/env.js";
import { agentAuth } from "../middleware/auth.js";

const router = Router();

// Register a new agent
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: "email, name and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const existing = await prisma.agent.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Agent with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const agent = await prisma.agent.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true },
    });
    res.status(201).json({ agent });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Agent login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const agent = await prisma.agent.findUnique({ where: { email } });
    if (!agent) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, agent.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = jwt.sign(
      { agentId: agent.id, email: agent.email },
      config.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({
      token,
      agent: { id: agent.id, name: agent.name, email: agent.email },
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Get current agent info
router.get("/me", agentAuth, async (req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.agent!.agentId },
      select: { id: true, email: true, name: true, isOnline: true },
    });
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ agent });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
