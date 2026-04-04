import type { KnowledgeSnippet, KnowledgeSource } from "./knowledge-source.js";

export class NotionKnowledgeSource implements KnowledgeSource {
  async getRelevantSnippets(_query: string): Promise<KnowledgeSnippet[]> {
    // Placeholder for a later Notion integration. Keep credentials and fetching logic server-side.
    return [];
  }
}

