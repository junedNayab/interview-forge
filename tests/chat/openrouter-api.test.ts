import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeUpstreamError,
  extractReply,
  isFreePricing,
  selectFreeModels,
} from "../../src/lib/chat/openrouter-api.ts";

const text = { input_modalities: ["text"], output_modalities: ["text"] };

describe("selectFreeModels", () => {
  it("keeps only zero-priced, text-output, unexpired models, sorted by name", () => {
    const now = Date.parse("2026-11-11T00:00:00Z");
    const payload = {
      data: [
        { id: "z/free:free", name: "Zeta (free)", pricing: { prompt: "0", completion: "0" }, architecture: text, context_length: 8192 },
        { id: "a/free:free", name: "Alpha (free)", pricing: { prompt: "0", completion: "0", request: "0" }, architecture: text },
        { id: "paid/model", name: "Paid", pricing: { prompt: "0.000001", completion: "0.000002" }, architecture: text },
        { id: "per-request", name: "Per request", pricing: { prompt: "0", completion: "0", request: "0.01" }, architecture: text },
        { id: "router/auto", name: "Variable", pricing: { prompt: "-1", completion: "-1" }, architecture: text },
        { id: "music/model", name: "Music", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["text", "audio"] } },
        { id: "old/free:free", name: "Expired", pricing: { prompt: "0", completion: "0" }, architecture: text, expiration_date: "2026-01-01" },
        { id: "soon/free:free", name: "Expiring later", pricing: { prompt: "0", completion: "0" }, architecture: text, expiration_date: "2027-01-01" },
        { id: "no-pricing", name: "Unknown price", architecture: text },
        { id: "blank", name: "Blank price", pricing: { prompt: "", completion: "" }, architecture: text },
        { name: "No id", pricing: { prompt: "0", completion: "0" } },
      ],
    };

    const models = selectFreeModels(payload, now);
    assert.deepEqual(
      models.map((m) => m.id),
      ["a/free:free", "soon/free:free", "z/free:free"],
    );
    assert.equal(models[2].contextLength, 8192);
    assert.equal(models[2].name, "Zeta (free)");
  });

  it("returns an empty list for malformed payloads", () => {
    assert.deepEqual(selectFreeModels(null), []);
    assert.deepEqual(selectFreeModels({ data: "nope" }), []);
    assert.deepEqual(selectFreeModels({ data: [] }), []);
  });

  it("falls back to the id when a model has no name", () => {
    const [model] = selectFreeModels({
      data: [{ id: "x/y:free", pricing: { prompt: 0, completion: 0 } }],
    });
    assert.equal(model.name, "x/y:free");
  });
});

describe("isFreePricing", () => {
  it("requires prompt and completion and every price to be zero", () => {
    assert.equal(isFreePricing({ prompt: "0", completion: "0" }), true);
    assert.equal(isFreePricing({ prompt: "0" }), false);
    assert.equal(isFreePricing({ prompt: "0", completion: "0", image: "0.001" }), false);
    assert.equal(isFreePricing(undefined), false);
  });
});

describe("describeUpstreamError", () => {
  it("maps rate limits and carries Retry-After", () => {
    const error = describeUpstreamError(429, { error: { code: 429, message: "slow down" } }, "30");
    assert.equal(error.status, 429);
    assert.equal(error.code, "upstream_rate_limited");
    assert.equal(error.retryAfterSeconds, 30);
    assert.match(error.message, /rate-limited/);
  });

  it("treats missing endpoints and provider outages as an unavailable model", () => {
    for (const status of [404, 502, 503]) {
      const error = describeUpstreamError(status, { error: { message: "No endpoints found" } });
      assert.equal(error.code, "model_unavailable");
      assert.match(error.message, /No endpoints found/);
    }
  });

  it("never blames the user for a bad server key", () => {
    const error = describeUpstreamError(401, { error: { message: "User not found" } });
    assert.equal(error.code, "not_configured");
    assert.match(error.message, /OPENROUTER_API_KEY/);
  });

  it("falls back to a generic upstream error", () => {
    assert.equal(describeUpstreamError(500, null).code, "upstream_error");
    assert.equal(describeUpstreamError(403, null).code, "upstream_blocked");
    assert.equal(describeUpstreamError(408, null).code, "timeout");
  });
});

describe("extractReply", () => {
  it("reads the first choice and flags truncation", () => {
    const result = extractReply({
      choices: [{ message: { content: " Answer " }, finish_reason: "length" }],
    });
    assert.deepEqual(result, { ok: true, reply: "Answer", truncated: true });
  });

  it("surfaces errors returned with HTTP 200", () => {
    const result = extractReply({ error: { code: 429, message: "Rate limit exceeded" } });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "upstream_rate_limited");
  });

  it("reports empty answers instead of returning blank text", () => {
    const result = extractReply({ choices: [{ message: { content: "" }, finish_reason: "stop" }] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "empty_response");
  });
});
