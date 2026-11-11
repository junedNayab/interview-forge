import { getApiKey, getFreeModels, ModelsUnavailableError } from "@/lib/chat/openrouter";
import type { ModelsResponse } from "@/lib/chat/protocol";

export async function GET() {
  const configured = Boolean(getApiKey());

  try {
    const { models, fetchedAt, stale } = await getFreeModels();
    return Response.json(
      { configured, models, fetchedAt: new Date(fetchedAt).toISOString(), stale } satisfies ModelsResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof ModelsUnavailableError
        ? `${error.message} Try again in a moment.`
        : "Couldn't load the list of free models. Try again in a moment.";
    return Response.json(
      { configured, error: { code: "models_unavailable", message } } satisfies ModelsResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
