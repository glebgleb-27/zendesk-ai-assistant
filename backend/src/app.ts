import express, { type NextFunction, type Request, type Response } from "express";

import { config } from "./config.js";
import { authenticateRequest } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import { chatRouter } from "./routes/chat.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      model: config.OPENAI_MODEL,
      notionConfigured: Boolean(config.NOTION_API_KEY && config.NOTION_DATABASE_ID),
      timestamp: new Date().toISOString()
    });
  });

  app.use("/api", authenticateRequest, chatRouter);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled request error", error);

    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  });

  return app;
}

