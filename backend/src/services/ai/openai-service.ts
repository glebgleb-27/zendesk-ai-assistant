import OpenAI from "openai";

import { config } from "../../config.js";
import type { ChatRequestBody } from "../../types.js";
import type { AiProvider, AiReply } from "./ai-provider.js";
import { buildInstructions, buildUserInput } from "./prompts.js";

interface ResponseLike {
  id?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string | null;
}

function extractResponseText(response: ResponseLike): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts: string[] = [];

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

export class OpenAiService implements AiProvider {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async generateReply(request: ChatRequestBody): Promise<AiReply> {
    const response = await this.client.responses.create({
      model: config.OPENAI_MODEL,
      instructions: buildInstructions(request.action),
      input: buildUserInput(request)
    });

    const text = extractResponseText(response as ResponseLike);

    if (!text) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      model: config.OPENAI_MODEL,
      requestId: response.id,
      text
    };
  }
}

