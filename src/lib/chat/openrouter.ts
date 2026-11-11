import "server-only";

import {
  describeUpstreamError,
  extractReply,
  selectFreeModels,
  type CompletionResult,
} from "./openrouter-api";
import type { FreeModel } from "./protocol";

const API_BASE = "https://openrouter.ai/api/v1";
/** The free roster changes often; refresh it every few minutes, not per request. */
const MODELS_TTL_MS = 10 * 60_000;
const MODELS_TIMEOUT_MS = 10_000;
const COMPLETION_TIMEOUT_MS = 55_000;
/** Reasoning models spend part of this on hidden thinking, so leave headroom. */
const MAX_OUTPUT_TOKENS = 2048;

/** Read per call so a key added to the environment is picked up without a rebuild. */
export function getApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

export class ModelsUnavailableError extends Error {}

type ModelCache = { models: FreeModel[]; fetchedAt: number };

let cache: ModelCache | undefined;
let inflight: Promise<ModelCache> | undefined;

async function fetchFreeModels(): Promise<ModelCache> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/models`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
    });
  } catch {
    throw new ModelsUnavailableError("Couldn't reach OpenRouter to load the model list.");
  }

  if (!response.ok) {
    throw new ModelsUnavailableError(
      `OpenRouter's model list returned HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json().catch(() => {
    throw new ModelsUnavailableError("OpenRouter's model list was not valid JSON.");
  });

  return { models: selectFreeModels(payload), fetchedAt: Date.now() };
}

/**
 * Free models from OpenRouter, cached in memory. If a refresh fails but an older
 * list exists, the older list is served and flagged `stale`; with no list at all
 * the error propagates so callers can say so instead of guessing.
 */
export async function getFreeModels(): Promise<ModelCache & { stale: boolean }> {
  if (cache && Date.now() - cache.fetchedAt < MODELS_TTL_MS) {
    return { ...cache, stale: false };
  }

  inflight ??= fetchFreeModels().finally(() => {
    inflight = undefined;
  });

  try {
    cache = await inflight;
    return { ...cache, stale: false };
  } catch (error) {
    if (cache) return { ...cache, stale: true };
    throw error;
  }
}

/** Forces the next `getFreeModels` call to refetch, e.g. after a model vanished. */
export function invalidateFreeModels() {
  if (cache) cache = { ...cache, fetchedAt: 0 };
}

export async function createChatCompletion({
  apiKey,
  model,
  messages,
  signal,
}: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
  signal?: AbortSignal;
}): Promise<CompletionResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Optional app attribution; OpenRouter ignores the title without a referer.
  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim();
  if (siteUrl) {
    headers["HTTP-Referer"] = siteUrl;
    headers["X-OpenRouter-Title"] = "InterviewForge";
  }

  const timeout = AbortSignal.timeout(COMPLETION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        stream: false,
      }),
    });
  } catch (error) {
    if (timeout.aborted) return { ok: false, error: describeUpstreamError(408, null) };
    if (signal?.aborted) throw error;
    return {
      ok: false,
      error: { status: 502, code: "upstream_error", message: "Couldn't reach OpenRouter." },
    };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 404) invalidateFreeModels();
    return {
      ok: false,
      error: describeUpstreamError(response.status, body, response.headers.get("retry-after")),
    };
  }

  return extractReply(body);
}
