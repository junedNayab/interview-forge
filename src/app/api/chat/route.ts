import {
  createChatCompletion,
  getApiKey,
  getFreeModels,
  invalidateFreeModels,
} from "@/lib/chat/openrouter";
import { buildModelMessages, NO_MATCH_REPLY } from "@/lib/chat/prompt";
import {
  MAX_REQUEST_BYTES,
  parseChatRequest,
  type ChatErrorCode,
  type ChatFailure,
  type ChatSuccess,
} from "@/lib/chat/protocol";
import { CHAT_RATE_LIMITS, clientKey, createRateLimiter } from "@/lib/chat/rate-limit";
import { leadingChunks, mergeHits, refersToCurrentPage, search, toSources } from "@/lib/chat/retrieval";
import { getSiteIndex, resolveCurrentPage } from "@/lib/chat/site-index";

/** Free models can be slow; the upstream call itself times out a little sooner. */
export const maxDuration = 60;

/** Share of the excerpt budget a pinned current lesson may take. */
const PINNED_CONTEXT_CHARS = 8000;

const limiter = createRateLimiter(CHAT_RATE_LIMITS);

function fail(status: number, code: ChatErrorCode, message: string, retryAfterSeconds?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  return Response.json({ error: { code, message, retryAfterSeconds } } satisfies ChatFailure, {
    status,
    headers,
  });
}

async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) throw new RangeError();
  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) throw new RangeError();
  return JSON.parse(text);
}

export async function POST(request: Request) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return fail(
      503,
      "not_configured",
      "The chat assistant isn't configured on this server yet: OPENROUTER_API_KEY is not set.",
    );
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    return error instanceof RangeError
      ? fail(413, "invalid_request", "That conversation is too large to send. Start a new chat.")
      : fail(400, "invalid_request", "Request body must be valid JSON.");
  }

  const parsed = parseChatRequest(body);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const { model, messages, path } = parsed.value;

  const verdict = limiter.check(clientKey(request.headers));
  if (!verdict.allowed) {
    const seconds = Math.ceil(verdict.retryAfterMs / 1000);
    return fail(
      429,
      "rate_limited",
      `You're sending messages faster than the assistant allows. Try again in ${seconds}s.`,
      seconds,
    );
  }

  // The key is the site owner's, so only models that are free *right now* are
  // allowed — a client cannot opt into a paid model by sending its id.
  let freeModels;
  try {
    freeModels = (await getFreeModels()).models;
  } catch {
    return fail(
      503,
      "models_unavailable",
      "Couldn't load OpenRouter's list of free models, so the chosen model can't be verified. Try again shortly.",
    );
  }
  if (!freeModels.some((candidate) => candidate.id === model)) {
    invalidateFreeModels();
    return fail(
      400,
      "model_not_allowed",
      "That model is no longer in OpenRouter's list of free models. Refresh the list and pick another.",
    );
  }

  const index = getSiteIndex();
  const currentPage = resolveCurrentPage(index, path);
  const question = messages.at(-1)!.content;
  const previousQuestion = messages.slice(0, -1).findLast((m) => m.role === "user")?.content;
  const ranked = search(index, question, {
    // Follow-ups like "and its complexity?" lean on the previous question and page.
    context: [previousQuestion, currentPage?.title].filter(Boolean).join("\n"),
    boostDocId: currentPage?.docId,
  });
  // "Summarize this lesson" needs the lesson itself, not whatever else says "lesson".
  const pinned =
    currentPage && refersToCurrentPage(question)
      ? leadingChunks(index, currentPage.docId, PINNED_CONTEXT_CHARS)
      : [];
  const hits = mergeHits(pinned, ranked);

  if (hits.length === 0) {
    return Response.json(
      { reply: NO_MATCH_REPLY, sources: [], grounded: false, model } satisfies ChatSuccess,
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await createChatCompletion({
    apiKey,
    model,
    messages: buildModelMessages(hits, messages, currentPage),
    signal: request.signal,
  }).catch(() => null);

  if (!result) return fail(499, "upstream_error", "The request was cancelled.");
  if (!result.ok) {
    const { status, code, message, retryAfterSeconds } = result.error;
    return fail(status, code, message, retryAfterSeconds);
  }

  const reply = result.truncated
    ? `${result.reply}\n\n(The answer was cut off. Ask a narrower question for the rest.)`
    : result.reply;

  return Response.json(
    { reply, sources: toSources(hits), grounded: true, model } satisfies ChatSuccess,
    { headers: { "Cache-Control": "no-store" } },
  );
}
