import type { ChatRequestBody } from "../../types.js";

export interface AiReply {
  model: string;
  requestId?: string;
  text: string;
}

export interface AiProvider {
  generateReply(request: ChatRequestBody): Promise<AiReply>;
}

