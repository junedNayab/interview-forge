/**
 * In-memory sliding-window rate limiting for the chat route. Pure, with an
 * injectable clock for tests.
 *
 * State lives in the server process, so it is per instance: good enough for a
 * single `next start` server, but on a serverless/multi-instance host each
 * instance counts separately. OpenRouter's own free-model limits still apply
 * on top and are surfaced to the user as `upstream_rate_limited`.
 */

export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export type RateLimiter = { check(key: string, now?: number): RateLimitResult };

/** Per-client allowance for chat messages. */
export const CHAT_RATE_LIMITS: RateLimitRule[] = [
  { limit: 6, windowMs: 60_000 },
  { limit: 60, windowMs: 60 * 60_000 },
];

export function createRateLimiter(
  rules: RateLimitRule[],
  { maxKeys = 5000 }: { maxKeys?: number } = {},
): RateLimiter {
  const log = new Map<string, number[]>();
  const longestWindow = Math.max(...rules.map((rule) => rule.windowMs));

  return {
    check(key, now = Date.now()) {
      const recent = (log.get(key) ?? []).filter((time) => now - time < longestWindow);
      // Re-insert on every check so Map iteration order doubles as least-recently-used
      // order; a client being throttled right now must not be the first one evicted.
      log.delete(key);
      log.set(key, recent);

      for (const rule of rules) {
        const inWindow = recent.filter((time) => now - time < rule.windowMs);
        if (inWindow.length >= rule.limit) {
          // The request frees up once the oldest hit that keeps us at the limit expires.
          const blocking = inWindow[inWindow.length - rule.limit];
          return { allowed: false, retryAfterMs: Math.max(1, rule.windowMs - (now - blocking)) };
        }
      }

      recent.push(now);
      if (log.size > maxKeys) {
        const oldest = log.keys().next().value;
        if (oldest !== undefined) log.delete(oldest);
      }

      return { allowed: true };
    },
  };
}

/**
 * Best-effort client identity. Behind a platform proxy (e.g. Vercel) the first
 * `x-forwarded-for` entry is set by the platform; on a bare server it can be
 * spoofed, so treat this as abuse damping, not access control.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "anonymous";
}
