const client = ZAFClient.init();

const SHORTCUTS = {
  summarize: {
    action: "summarize",
    label: "Summarize",
    prompt: "Summarize this ticket for the support agent."
  },
  draft_reply: {
    action: "draft_reply",
    label: "Draft reply",
    prompt: "Draft a reply the agent can edit before sending to the customer."
  },
  next_steps: {
    action: "next_steps",
    label: "Next steps",
    prompt: "What should the support agent do next on this ticket?"
  }
};

const state = {
  messages: [],
  pending: false,
  settings: null,
  ticket: null,
  boundEvents: new Set(),
  backendAvailable: false,
  backendModeMessage: ""
};

const elements = {
  composer: document.getElementById("composer"),
  messages: document.getElementById("messages"),
  modeBadge: document.getElementById("mode-badge"),
  prompt: document.getElementById("prompt"),
  refreshContext: document.getElementById("refresh-context"),
  send: document.getElementById("send"),
  shortcuts: Array.from(document.querySelectorAll("[data-shortcut]")),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  bindBaseTicketEvents();
  renderMessages();
  resizeApp();

  try {
    await loadSettings();
    await refreshTicketContext({ announce: true });
  } catch (error) {
    setStatus(getErrorMessage(error), "error");
  }
}

function bindEvents() {
  elements.composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleSend({
      action: "freeform",
      label: "Agent prompt",
      prompt: elements.prompt.value
    });
  });

  elements.refreshContext.addEventListener("click", async () => {
    try {
      await refreshTicketContext({ announce: true });
    } catch (error) {
      setStatus(getErrorMessage(error), "error");
    }
  });

  elements.shortcuts.forEach((button) => {
    button.addEventListener("click", async () => {
      const shortcut = SHORTCUTS[button.dataset.shortcut];

      if (!shortcut) {
        return;
      }

      await handleSend(shortcut);
    });
  });
}

async function loadSettings() {
  const metadata = await client.metadata();
  state.settings = {
    backend_origin: String(metadata.settings?.backend_origin || "").trim(),
    backend_domain: String(metadata.settings?.backend_domain || "").trim()
  };

  const backendMode = getBackendMode(state.settings);
  state.backendAvailable = backendMode.available;
  state.backendModeMessage = backendMode.message;

  syncModeUi();
  updateUiState();
  renderMessages();
}

async function handleSend({ action, label, prompt }) {
  const trimmedPrompt = String(prompt || "").trim();

  if (!state.backendAvailable) {
    setStatus(state.backendModeMessage || "Preview mode keeps AI actions offline until a backend is configured.", "neutral");
    return;
  }

  if (!trimmedPrompt || state.pending) {
    return;
  }

  state.pending = true;
  updateUiState();

  const userMessage = {
    role: "user",
    label,
    content: trimmedPrompt
  };

  state.messages.push(userMessage);
  renderMessages();
  setStatus("Working on it...", "working");

  try {
    const ticket = await refreshTicketContext({ announce: false });
    const metadata = await collectMetadata();
    const conversation = state.messages.slice(0, -1).map(toApiMessage);

    const response = await requestAssistant({
      prompt: trimmedPrompt,
      action,
      conversation,
      ticket,
      metadata
    });

    state.messages.push({
      role: "assistant",
      label: response.model ? `AI - ${response.model}` : "AI",
      content: response.reply
    });

    renderMessages();
    setStatus("Reply ready. Review it before using it.", "success");

    if (action === "freeform") {
      elements.prompt.value = "";
    }
  } catch (error) {
    setStatus(getErrorMessage(error), "error");
  } finally {
    state.pending = false;
    updateUiState();
  }
}

async function requestAssistant(payload) {
  const endpoint = new URL("/api/chat", state.settings.backend_origin).toString();

  try {
    return await client.request({
      url: endpoint,
      type: "POST",
      secure: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer {{setting.backend_api_key}}"
      },
      data: JSON.stringify(payload)
    });
  } catch (error) {
    const responseError =
      error &&
      (error.responseJSON?.error ||
        error.responseText ||
        error.statusText ||
        error.message);

    throw new Error(responseError || "The backend request failed.");
  }
}

async function refreshTicketContext({ announce }) {
  if (announce) {
    setStatus("Refreshing ticket context...", "working");
  }

  const ticketBase = await safeGetMany([
    "ticket.id",
    "ticket.subject",
    "ticket.description",
    "ticket.status",
    "ticket.priority",
    "ticket.type",
    "ticket.tags",
    "ticket.via.channel",
    "ticket.requester.id",
    "ticket.requester.name",
    "ticket.requester.email",
    "ticket.assignee.user.name",
    "ticket.organization.name",
    "ticket.comment.text",
    "comment.type",
    "ticket.conversation"
  ]);

  const customFields = await loadCustomFields();

  const ticket = {
    id: toNumber(ticketBase["ticket.id"]),
    subject: ticketBase["ticket.subject"] || "",
    description: ticketBase["ticket.description"] || "",
    status: ticketBase["ticket.status"] || "",
    priority: ticketBase["ticket.priority"] || "",
    type: ticketBase["ticket.type"] || "",
    tags: Array.isArray(ticketBase["ticket.tags"]) ? ticketBase["ticket.tags"] : [],
    viaChannel: ticketBase["ticket.via.channel"] || "",
    requester: {
      id: toNumber(ticketBase["ticket.requester.id"]),
      name: ticketBase["ticket.requester.name"] || "",
      email: ticketBase["ticket.requester.email"] || ""
    },
    assignee: {
      name: ticketBase["ticket.assignee.user.name"] || ""
    },
    organization: {
      name: ticketBase["ticket.organization.name"] || ""
    },
    draftComment: ticketBase["ticket.comment.text"] || "",
    draftCommentType: ticketBase["comment.type"] || "",
    conversation: normalizeConversation(ticketBase["ticket.conversation"]),
    customFields
  };

  if ((!ticket.conversation || ticket.conversation.length === 0) && ticket.id) {
    ticket.conversation = await fetchCommentsFallback(ticket.id);
  }

  state.ticket = ticket;
  bindCustomFieldEvents(customFields);

  if (announce) {
    const message = state.backendAvailable
      ? `Ticket${ticket.id ? ` #${ticket.id}` : ""} is synced and ready for AI.`
      : `Ticket${ticket.id ? ` #${ticket.id}` : ""} is synced. Preview mode keeps AI actions offline until a backend is connected.`;

    setStatus(message, state.backendAvailable ? "success" : "neutral");
  }

  resizeApp();
  return ticket;
}

async function fetchCommentsFallback(ticketId) {
  try {
    const response = await client.request({
      url: `/api/v2/tickets/${ticketId}/comments.json?sort_order=desc`,
      type: "GET"
    });

    if (!Array.isArray(response.comments)) {
      return [];
    }

    return response.comments
      .slice(0, 10)
      .reverse()
      .map((comment) => ({
        authorName: comment.author_id ? `User ${comment.author_id}` : "Unknown",
        authorRole: comment.public ? "requester_or_agent" : "agent",
        channel: "",
        createdAt: comment.created_at || "",
        public: comment.public,
        text: comment.plain_body || comment.body || ""
      }));
  } catch (_error) {
    return [];
  }
}

function normalizeConversation(value) {
  const items = Array.isArray(value)
    ? value
    : Array.isArray(value?.comments)
      ? value.comments
      : Array.isArray(value?.events)
        ? value.events
        : [];

  return items
    .slice(-10)
    .map((item) => ({
      authorName: item?.author?.name || item?.authorName || item?.author_name || "",
      authorRole: item?.author?.role || item?.authorRole || item?.role || "",
      channel: item?.via?.channel || item?.channel || "",
      createdAt: item?.created_at || item?.createdAt || "",
      public: typeof item?.public === "boolean" ? item.public : true,
      text:
        item?.plainBody ||
        item?.plain_body ||
        item?.body ||
        item?.htmlBody ||
        item?.text ||
        item?.value ||
        ""
    }))
    .filter((item) => item.text);
}

function bindBaseTicketEvents() {
  const events = [
    "ticket.subject.changed",
    "ticket.description.changed",
    "ticket.requester.id.changed",
    "ticket.requester.name.changed",
    "ticket.requester.email.changed",
    "ticket.tags.changed"
  ];

  events.forEach((eventName) => {
    bindTicketRefreshEvent(eventName);
  });
}

function bindCustomFieldEvents(customFields) {
  customFields.forEach((field) => {
    if (!field.name) {
      return;
    }

    bindTicketRefreshEvent(`ticket.${field.name}.changed`);
  });
}

function bindTicketRefreshEvent(eventName) {
  if (state.boundEvents.has(eventName)) {
    return;
  }

  state.boundEvents.add(eventName);
  client.on(eventName, () => {
    refreshTicketContext({ announce: false }).catch(() => {
      setStatus("Could not refresh ticket context automatically.", "error");
    });
  });
}

async function loadCustomFields() {
  const fieldResponse = await client.get("ticketFields").catch(() => ({}));
  const ticketFields = Array.isArray(fieldResponse.ticketFields) ? fieldResponse.ticketFields : [];
  const customFieldDefinitions = ticketFields.filter((field) => {
    return typeof field?.name === "string" && field.name.startsWith("custom_field_");
  });

  if (customFieldDefinitions.length === 0) {
    return [];
  }

  const valueResponse = await safeGetMany(
    customFieldDefinitions.map((field) => `ticket.customField:${field.name}`)
  );

  return customFieldDefinitions.map((field) => {
    const key = `ticket.customField:${field.name}`;
    const rawValue = valueResponse[key];
    const parsedId = field.name.replace("custom_field_", "");

    return {
      id: toNumber(parsedId),
      name: field.name,
      label: field.label || field.name,
      type: field.type || "",
      value: normalizeCustomFieldValue(rawValue, field.optionValues),
      valueLabel: formatCustomFieldValue(rawValue, field.optionValues)
    };
  });
}

function normalizeCustomFieldValue(value, optionValues) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCustomFieldValue(item, optionValues));
  }

  if (value && typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const option = findOptionValue(trimmed, optionValues);
    return option ? option.value : trimmed;
  }

  return value;
}

function formatCustomFieldValue(value, optionValues) {
  if (Array.isArray(value)) {
    const labels = value
      .map((item) => formatCustomFieldValue(item, optionValues))
      .filter(Boolean);

    return labels.join(", ");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    const option = findOptionValue(trimmed, optionValues);
    return option ? option.label || option.value || trimmed : trimmed;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return "";
}

function findOptionValue(value, optionValues) {
  if (!Array.isArray(optionValues)) {
    return null;
  }

  return optionValues.find((option) => option && option.value === value) || null;
}

function renderMessages() {
  elements.messages.replaceChildren();

  if (state.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const eyebrow = document.createElement("p");
    eyebrow.className = "empty-state__eyebrow";
    eyebrow.textContent = "AI Output";

    const heading = document.createElement("h2");
    heading.textContent = state.backendAvailable ? "Ask Copilot anything" : "Preview mode is ready";

    const copy = document.createElement("p");
    copy.textContent = state.backendAvailable
      ? "Use a quick action or ask a custom question about the current ticket."
      : "Ticket context is already attached behind the scenes. Connect a backend to unlock summaries, drafted replies, and follow-up guidance.";

    empty.append(eyebrow, heading, copy);
    elements.messages.append(empty);
    resizeApp();
    return;
  }

  state.messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message message--${message.role}`;

    const meta = document.createElement("div");
    meta.className = "message__meta";

    const role = document.createElement("div");
    role.className = "message__role";
    role.textContent = message.label || (message.role === "assistant" ? "AI" : "Agent");

    meta.append(role);

    if (message.role === "assistant") {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "message__copy";
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", async () => {
        await copyToClipboard(message.content);
      });
      meta.append(copyButton);
    }

    const content = document.createElement("div");
    content.className = "message__content";
    content.textContent = message.content;

    article.append(meta, content);
    elements.messages.append(article);
  });

  elements.messages.scrollTop = elements.messages.scrollHeight;
  resizeApp();
}

function updateUiState() {
  elements.send.disabled = state.pending || !state.backendAvailable;
  elements.prompt.disabled = state.pending || !state.backendAvailable;
  elements.refreshContext.disabled = state.pending;

  elements.shortcuts.forEach((button) => {
    button.disabled = state.pending || !state.backendAvailable;
  });
}

function setStatus(message, tone) {
  elements.status.className = `status status--${tone}`;
  elements.statusText.textContent = message;
  resizeApp();
}

async function safeGetMany(paths) {
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        return await client.get(path);
      } catch (_error) {
        return {};
      }
    })
  );

  return results.reduce((accumulator, current) => Object.assign(accumulator, current), {});
}

async function collectMetadata() {
  const [context, currentUser] = await Promise.all([
    client.context().catch(() => ({})),
    safeGetMany(["currentUser.name"])
  ]);

  return {
    subdomain: context.account?.subdomain || "",
    agentName: currentUser["currentUser.name"] || "",
    locale: navigator.language || ""
  };
}

function toApiMessage(message) {
  return {
    role: message.role,
    content: message.content
  };
}

function toNumber(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "success");
  } catch (_error) {
    setStatus("Could not copy automatically. Please copy manually.", "error");
  }
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong.";
}

function syncModeUi() {
  elements.modeBadge.className = `mode-badge mode-badge--${state.backendAvailable ? "live" : "preview"}`;
  elements.modeBadge.textContent = state.backendAvailable ? "Live" : "Preview";

  if (state.backendAvailable) {
    elements.prompt.placeholder =
      'Ask a question or try a prompt like "draft a calm reply that asks for the order number."';
    return;
  }

  elements.prompt.value = "";
  elements.prompt.placeholder = "Preview mode keeps AI disabled. Connect a backend to ask Copilot questions here.";
}

function getBackendMode(settings) {
  const origin = String(settings?.backend_origin || "").trim();
  const domain = String(settings?.backend_domain || "").trim().toLowerCase();

  if (!origin || !domain) {
    return {
      available: false,
      message: "Preview mode: ticket context works even without backend settings, but AI actions are disabled."
    };
  }

  let parsedOrigin;

  try {
    parsedOrigin = new URL(origin);
  } catch (_error) {
    return {
      available: false,
      message: "Preview mode: backend_origin is not a valid URL, so AI actions are disabled."
    };
  }

  const originHost = parsedOrigin.hostname.toLowerCase();
  const placeholderHosts = new Set(["example.com", "www.example.com"]);

  if (placeholderHosts.has(originHost) || placeholderHosts.has(domain)) {
    return {
      available: false,
      message: "Preview mode: placeholder backend settings are in use, so only ticket context is available."
    };
  }

  if (originHost !== domain) {
    return {
      available: false,
      message: "Preview mode: backend_origin and backend_domain do not match, so AI actions are disabled."
    };
  }

  return {
    available: true,
    message: ""
  };
}

function resizeApp() {
  window.requestAnimationFrame(() => {
    client.invoke("resize", {
      height: `${document.body.scrollHeight}px`
    });
  });
}
