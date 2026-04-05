import { Router } from "express";
import { z } from "zod";

import { logger } from "../lib/logger.js";
import { OpenAiService } from "../services/ai/openai-service.js";
import type { ChatRequestBody } from "../types.js";

const router = Router();
const aiService = new OpenAiService();

const sidebarMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000)
});

const ticketConversationItemSchema = z.object({
  authorName: z.string().optional(),
  authorRole: z.string().optional(),
  channel: z.string().optional(),
  createdAt: z.string().optional(),
  public: z.boolean().optional(),
  text: z.string().optional()
});

const chatRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(6000),
  action: z.enum(["freeform", "summarize", "draft_reply", "next_steps"]).default("freeform"),
  conversation: z.array(sidebarMessageSchema).max(20).default([]),
  ticket: z.object({
    id: z.number().nullable().optional(),
    subject: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    viaChannel: z.string().optional(),
    requester: z
      .object({
        id: z.number().nullable().optional(),
        name: z.string().optional(),
        email: z.string().optional()
      })
      .optional(),
    assignee: z
      .object({
        name: z.string().optional()
      })
      .optional(),
    organization: z
      .object({
        name: z.string().optional()
      })
      .optional(),
    draftComment: z.string().optional(),
    draftCommentType: z.string().optional(),
    conversation: z.array(ticketConversationItemSchema).optional(),
    customFields: z
      .array(
        z.object({
          id: z.number().nullable().optional(),
          name: z.string().optional(),
          label: z.string().optional(),
          type: z.string().optional(),
          value: z.unknown().optional(),
          valueLabel: z.string().optional()
        })
      )
      .optional()
  }),
  metadata: z
    .object({
      subdomain: z.string().optional(),
      agentName: z.string().optional(),
      locale: z.string().optional()
    })
    .optional()
});

router.post("/chat", async (req, res, next) => {
  const parsed = chatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const requestBody = parsed.data as ChatRequestBody;

    logger.info("Processing Zendesk sidebar AI request", {
      action: requestBody.action,
      ticketId: requestBody.ticket.id ?? null,
      subdomain: requestBody.metadata?.subdomain ?? null
    });

    const reply = await aiService.generateReply(requestBody);

    res.json({
      reply: reply.text,
      model: reply.model,
      requestId: reply.requestId
    });
  } catch (error) {
    next(error);
  }
});

export { router as chatRouter };
