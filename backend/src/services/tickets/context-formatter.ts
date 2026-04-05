import type { SidebarMessage, TicketContext } from "../../types.js";

function truncate(value: string | undefined, maxLength: number): string {
  if (!value) {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export function formatTicketContext(ticket: TicketContext): string {
  const sections: string[] = [];

  sections.push(`Ticket ID: ${ticket.id ?? "unknown"}`);
  sections.push(`Subject: ${ticket.subject || "not available"}`);
  sections.push(`Status: ${ticket.status || "not available"}`);
  sections.push(`Priority: ${ticket.priority || "not set"}`);
  sections.push(`Type: ${ticket.type || "not set"}`);
  sections.push(`Channel: ${ticket.viaChannel || "not available"}`);
  sections.push(
    `Requester: ${ticket.requester?.name || "unknown"} (${ticket.requester?.email || "email unavailable"})${ticket.requester?.id ? ` [id: ${ticket.requester.id}]` : ""}`
  );
  sections.push(`Assignee: ${ticket.assignee?.name || "unassigned"}`);
  sections.push(`Organization: ${ticket.organization?.name || "not available"}`);
  sections.push(`Tags: ${ticket.tags && ticket.tags.length > 0 ? ticket.tags.join(", ") : "none"}`);

  if (ticket.customFields && ticket.customFields.length > 0) {
    const populatedCustomFields = ticket.customFields
      .filter((field) => hasMeaningfulValue(field.value))
      .map((field) => `${field.label || field.name || "custom field"}: ${formatCustomFieldValue(field.valueLabel, field.value)}`);

    if (populatedCustomFields.length > 0) {
      sections.push(`Custom fields:\n${populatedCustomFields.join("\n")}`);
    }
  }

  if (ticket.description) {
    sections.push(`Description:\n${truncate(ticket.description, 3000)}`);
  }

  if (ticket.draftComment) {
    sections.push(
      `Current agent draft (${ticket.draftCommentType || "comment"}):\n${truncate(ticket.draftComment, 1500)}`
    );
  }

  if (ticket.conversation && ticket.conversation.length > 0) {
    const recentConversation = ticket.conversation
      .slice(-10)
      .map((item, index) => {
        const visibility = item.public === false ? "internal" : "public";
        const author = item.authorName || item.authorRole || "unknown";
        const createdAt = item.createdAt || "unknown time";
        const channel = item.channel ? ` via ${item.channel}` : "";
        const text = truncate(item.text || "", 1800) || "[no text]";

        return `${index + 1}. ${author} (${visibility}${channel}) at ${createdAt}\n${text}`;
      })
      .join("\n\n");

    sections.push(`Recent ticket conversation:\n${recentConversation}`);
  }

  return sections.join("\n\n");
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return false;
}

function formatCustomFieldValue(preferredLabel: string | undefined, value: unknown): string {
  if (preferredLabel && preferredLabel.trim()) {
    return preferredLabel;
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatCustomFieldValue(undefined, item)).join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value ?? "empty");
}

export function formatSidebarConversation(conversation: SidebarMessage[]): string {
  if (conversation.length === 0) {
    return "No prior sidebar conversation.";
  }

  return conversation
    .slice(-8)
    .map((message, index) => `${index + 1}. ${message.role.toUpperCase()}: ${truncate(message.content, 2000)}`)
    .join("\n");
}
