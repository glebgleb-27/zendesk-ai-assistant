export interface KnowledgeSnippet {
  title: string;
  content: string;
  source: string;
}

export interface KnowledgeSource {
  getRelevantSnippets(query: string): Promise<KnowledgeSnippet[]>;
}

