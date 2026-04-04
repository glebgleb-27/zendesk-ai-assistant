export type SidebarAction = "freeform" | "summarize" | "draft_reply" | "next_steps";

export interface SidebarMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TicketConversationItem {
  authorName?: string;
  authorRole?: string;
  channel?: string;
  createdAt?: string;
  public?: boolean;
  text?: string;
}

export interface TicketContext {
  id?: number | null;
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  tags?: string[];
  viaChannel?: string;
  requester?: {
    name?: string;
    email?: string;
  };
  assignee?: {
    name?: string;
  };
  organization?: {
    name?: string;
  };
  draftComment?: string;
  draftCommentType?: string;
  conversation?: TicketConversationItem[];
}

export interface ChatRequestBody {
  prompt: string;
  action: SidebarAction;
  conversation: SidebarMessage[];
  ticket: TicketContext;
  metadata?: {
    subdomain?: string;
    agentName?: string;
    locale?: string;
  };
}

export interface ChatResponseBody {
  reply: string;
  model: string;
  requestId?: string;
}

