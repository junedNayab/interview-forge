import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clientKey, createRateLimiter } from "../../src/lib/chat/rate-limit.ts";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    const limiter = createRateLimiter([{ limit: 2, windowMs: 1000 }]);
    assert.deepEqual(limiter.check("ip", 0), { allowed: true });
    assert.deepEqual(limiter.check("ip", 100), { allowed: true });

    const blocked = limiter.check("ip", 400);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.retryAfterMs, 600);

    assert.deepEqual(limiter.check("ip", 1000), { allowed: true });
  });

  it("does not count rejected requests against the client", () => {
    const limiter = createRateLimiter([{ limit: 1, windowMs: 1000 }]);
    limiter.check("ip", 0);
    for (let t = 1; t < 1000; t += 100) assert.equal(limiter.check("ip", t).allowed, false);
    assert.equal(limiter.check("ip", 1000).allowed, true);
  });

  it("applies every rule, so a long window caps bursts spread over time", () => {
    const limiter = createRateLimiter([
      { limit: 2, windowMs: 1000 },
      { limit: 3, windowMs: 10_000 },
    ]);
    assert.equal(limiter.check("ip", 0).allowed, true);
    assert.equal(limiter.check("ip", 1500).allowed, true);
    assert.equal(limiter.check("ip", 3000).allowed, true);

    const blocked = limiter.check("ip", 4500);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.retryAfterMs, 5500);
  });

  it("tracks clients independently and evicts the least recently used", () => {
    const limiter = createRateLimiter([{ limit: 1, windowMs: 1000 }], { maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 0);
    assert.equal(limiter.check("a", 1).allowed, false);
    limiter.check("c", 2); // evicts "b", the least recently used
    assert.equal(limiter.check("b", 3).allowed, true);
  });
});

describe("clientKey", () => {
  it("prefers the first forwarded address", () => {
    assert.equal(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
    assert.equal(clientKey(new Headers({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
    assert.equal(clientKey(new Headers()), "anonymous");
  });
});
