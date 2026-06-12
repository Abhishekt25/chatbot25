import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export type JwtPayload = { agentId: string; email: string };

declare global {
  namespace Express {
    interface Request {
      agent?: JwtPayload;
    }
  }
}

export function agentAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.agent = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
