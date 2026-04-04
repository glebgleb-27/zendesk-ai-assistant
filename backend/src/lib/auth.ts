import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";

function extractBearerToken(value?: string): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function authenticateRequest(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.header("authorization"));

  if (!token || !secretsMatch(token, config.BACKEND_SHARED_SECRET)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

