/**
 * Pure helpers for OpenRouter's HTTP API: which models count as free, how
 * upstream failures map onto user-facing errors, and how to read a completion.
 * Network calls and the API key live in the server-only `openrouter.ts`.
 */
import type { ChatErrorCode, FreeModel } from "./protocol";

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: unknown;
  architecture?: unknown;
  expiration_date?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Free means every listed price is exactly zero — not just prompt/completion,
 * since some models bill per request, image or web search. Missing or
 * unparseable pricing is treated as not free, and negative values (used for
 * variable-price routers) are not free either.
 */
export function isFreePricing(pricing: unknown): boolean {
  if (!isRecord(pricing)) return false;
  const values = Object.values(pricing).filter((value) => value !== undefined && value !== null);
  if (!("prompt" in pricing) || !("completion" in pricing) || values.length === 0) return false;
  return values.every((value) => {
    if (typeof value === "number") return value === 0;
    // Number("") is 0, so a blank price must not read as free.
    return typeof value === "string" && value.trim() !== "" && Number(value) === 0;
  });
}

/** The panel needs plain text back; audio/image generators are excluded. */
function producesTextOnly(architecture: unknown): boolean {
  if (!isRecord(architecture)) return true;
  const outputs = architecture.output_modalities;
  if (Array.isArray(outputs)) return outputs.length > 0 && outputs.every((m) => m === "text");
  const modality = architecture.modality;
  return typeof modality !== "string" || modality.endsWith("->text");
}

function isExpired(expiration: unknown, now: number): boolean {
  if (typeof expiration !== "string" || !expiration) return false;
  const time = Date.parse(expiration);
  return Number.isFinite(time) && time <= now;
}

/** Filters OpenRouter's `GET /models` payload down to usable free chat models. */
export function selectFreeModels(payload: unknown, now = Date.now()): FreeModel[] {
  const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  const models = new Map<string, FreeModel>();

  for (const raw of data as RawModel[]) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) continue;
    if (!isFreePricing(raw.pricing)) continue;
    if (!producesTextOnly(raw.architecture)) continue;
    if (isExpired(raw.expiration_date, now)) continue;

    models.set(raw.id, {
      id: raw.id,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : raw.id,
      contextLength:
        typeof raw.context_length === "number" && raw.context_length > 0
          ? raw.context_length
          : undefined,
    });
  }

  return [...models.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type UpstreamError = {
  status: number;
  code: ChatErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

function upstreamMessage(body: unknown): string | undefined {
  const error = isRecord(body) ? body.error : undefined;
  const message = isRecord(error) ? error.message : undefined;
  if (typeof message !== "string" || !message.trim()) return undefined;
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 240 ? `${clean.slice(0, 240)}…` : clean;
}

function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    const delta = Math.ceil((date - Date.now()) / 1000);
    return delta > 0 ? delta : undefined;
  }
  return undefined;
}

/** Maps an OpenRouter error (HTTP status or in-body `error.code`) to what the user sees. */
export function describeUpstreamError(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): UpstreamError {
  const detail = upstreamMessage(body);
  const suffix = detail ? ` (OpenRouter: ${detail})` : "";

  switch (status) {
    case 401:
      return {
        status: 503,
        code: "not_configured",
        message:
          "The server's OpenRouter API key was rejected. The site owner needs to check OPENROUTER_API_KEY.",
      };
    case 402:
      return {
        status: 503,
        code: "upstream_error",
        message:
          "OpenRouter refused the request because of the account's credit balance; even free models can be blocked when the balance is negative." +
          suffix,
      };
    case 403:
      return {
        status: 422,
        code: "upstream_blocked",
        message: `OpenRouter or the model provider blocked this message.${suffix}`,
      };
    case 404:
    case 502:
    case 503:
      return {
        status: 502,
        code: "model_unavailable",
        message:
          `This free model isn't available right now. Pick another model and try again.${suffix}`,
      };
    case 408:
      return {
        status: 504,
        code: "timeout",
        message: "The model took too long to respond. Try again or pick a faster model.",
      };
    case 429:
      return {
        status: 429,
        code: "upstream_rate_limited",
        message:
          "This free model is rate-limited on OpenRouter right now (free models have per-minute and daily caps). Wait a little or pick another model.",
        retryAfterSeconds: parseRetryAfter(retryAfterHeader),
      };
    default:
      return {
        status: 502,
        code: "upstream_error",
        message: `OpenRouter couldn't complete the request.${suffix}`,
      };
  }
}

export type CompletionResult =
  | { ok: true; reply: string; truncated: boolean }
  | { ok: false; error: UpstreamError };

/** Reads a non-streaming chat completion, including errors reported with HTTP 200. */
export function extractReply(body: unknown): CompletionResult {
  if (isRecord(body) && isRecord(body.error)) {
    const code = typeof body.error.code === "number" ? body.error.code : 502;
    return { ok: false, error: describeUpstreamError(code, body) };
  }

  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : undefined;
  const message = isRecord(choice) ? choice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  const reply = typeof content === "string" ? content.trim() : "";

  if (isRecord(choice) && choice.finish_reason === "error" && !reply) {
    return { ok: false, error: describeUpstreamError(502, choice) };
  }

  if (!reply) {
    return {
      ok: false,
      error: {
        status: 502,
        code: "empty_response",
        message:
          "The model returned an empty answer (some free reasoning models run out of output budget). Try again or pick another model.",
      },
    };
  }

  return { ok: true, reply, truncated: isRecord(choice) && choice.finish_reason === "length" };
}
