/**
 * The contract between the chat panel and `/api/chat`. Pure — no Node APIs and
 * no runtime imports — so it is safe in the client bundle, the route handlers
 * and `node --test` alike.
 */

/** Longest question a user may send, in characters. */
export const MAX_MESSAGE_CHARS = 1000;
/** Most recent messages (both roles, including the new question) sent per request. */
export const MAX_HISTORY_MESSAGES = 12;
/** Earlier assistant replies are echoed back as history; longer ones are clipped. */
export const MAX_ASSISTANT_CHARS = 6000;
/** Hard cap on the raw request body, checked before parsing. */
export const MAX_REQUEST_BYTES = 64 * 1024;

const MAX_MODEL_ID_CHARS = 200;
const MAX_PATH_CHARS = 300;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._~:/-]+$/;

export type ChatRole = "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

/** A lesson or topic page the answer was grounded in. */
export type ChatSource = { title: string; href: string; topic: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  /** Pathname the user is reading, used to favour that lesson during retrieval. */
  path?: string;
};

export type ChatErrorCode =
  | "invalid_request"
  | "rate_limited"
  | "not_configured"
  | "models_unavailable"
  | "model_not_allowed"
  | "model_unavailable"
  | "upstream_rate_limited"
  | "upstream_blocked"
  | "upstream_error"
  | "empty_response"
  | "timeout";

export type ChatError = {
  code: ChatErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

export type ChatSuccess = {
  reply: string;
  sources: ChatSource[];
  /** False when nothing on the site matched and no model was called. */
  grounded: boolean;
  model: string;
};

export type ChatFailure = { error: ChatError };

export type FreeModel = { id: string; name: string; contextLength?: number };

export type ModelsSuccess = {
  /** Whether the server has an OpenRouter API key; models can list without one. */
  configured: boolean;
  models: FreeModel[];
  fetchedAt: string;
  /** True when OpenRouter could not be reached and a cached list is served. */
  stale: boolean;
};

export type ModelsResponse = ModelsSuccess | (ChatFailure & { configured: boolean });

export type ParseResult =
  | { ok: true; value: ChatRequest }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates an untrusted request body. Never trust the client's own limits. */
export function parseChatRequest(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, message: "Request body must be a JSON object." };

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model || model.length > MAX_MODEL_ID_CHARS || !MODEL_ID_PATTERN.test(model)) {
    return { ok: false, message: "Choose a model before sending a message." };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, message: "Send at least one message." };
  }
  if (body.messages.length > MAX_HISTORY_MESSAGES) {
    return {
      ok: false,
      message: `Send at most the ${MAX_HISTORY_MESSAGES} most recent messages.`,
    };
  }

  const messages: ChatMessage[] = [];
  for (const entry of body.messages) {
    if (!isRecord(entry) || typeof entry.content !== "string") {
      return { ok: false, message: "Each message needs a role and text content." };
    }

    if (entry.role === "user") {
      const content = entry.content.trim();
      if (!content) return { ok: false, message: "Messages cannot be empty." };
      if (content.length > MAX_MESSAGE_CHARS) {
        return {
          ok: false,
          message: `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`,
        };
      }
      messages.push({ role: "user", content });
    } else if (entry.role === "assistant") {
      const content = entry.content.trim().slice(0, MAX_ASSISTANT_CHARS);
      if (content) messages.push({ role: "assistant", content });
    } else {
      return { ok: false, message: "Message roles must be 'user' or 'assistant'." };
    }
  }

  if (messages.at(-1)?.role !== "user") {
    return { ok: false, message: "The last message must be a question from you." };
  }

  const path =
    typeof body.path === "string" &&
    body.path.startsWith("/") &&
    body.path.length <= MAX_PATH_CHARS
      ? body.path
      : undefined;

  return { ok: true, value: { model, messages, path } };
}
