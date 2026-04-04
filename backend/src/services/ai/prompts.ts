import type { ChatRequestBody, SidebarAction } from "../../types.js";
import { formatSidebarConversation, formatTicketContext } from "../tickets/context-formatter.js";

function actionGuidance(action: SidebarAction): string {
  switch (action) {
    case "summarize":
      return [
        "Return a concise support-facing summary.",
        "Include the customer problem, what happened so far, current status, and any risk or urgency."
      ].join(" ");
    case "draft_reply":
      return [
        "Draft a customer reply the agent can edit before sending.",
        "Do not claim the reply has been sent.",
        "Keep the tone professional, clear, and empathetic."
      ].join(" ");
    case "next_steps":
      return [
        "List the most useful next steps for the support agent.",
        "Call out any missing information or clarifying questions."
      ].join(" ");
    default:
      return "Answer the agent's prompt using the ticket context below.";
  }
}

export function buildInstructions(action: SidebarAction): string {
  return [
    "You are an AI copilot for Zendesk support agents.",
    "Use the provided ticket context and sidebar conversation.",
    "Be accurate, practical, and concise.",
    "Never imply that a response has already been sent to the customer.",
    "If information is missing, say so clearly instead of inventing facts.",
    actionGuidance(action)
  ].join(" ");
}

export function buildUserInput(request: ChatRequestBody): string {
  const metadata = request.metadata || {};

  return [
    `Zendesk subdomain: ${metadata.subdomain || "unknown"}`,
    `Agent name: ${metadata.agentName || "unknown"}`,
    `Agent locale: ${metadata.locale || "unknown"}`,
    "",
    "Ticket context:",
    formatTicketContext(request.ticket),
    "",
    "Prior sidebar conversation:",
    formatSidebarConversation(request.conversation),
    "",
    "Agent request:",
    request.prompt
  ].join("\n");
}

