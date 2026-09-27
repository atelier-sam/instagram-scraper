/**
 * Stop signals shared by the scrape functions.
 *
 * `HttpClient.fetchHtml` reports HTTP failures as a plain
 * `Error("HTTP <status> on GET <url>")`. The scrape layer turns the ones a
 * caller must STOP on into typed errors, so no code path falls back to
 * another surface (or retries) after Instagram said "slow down" — that is
 * how a throttled session becomes a checkpointed account.
 */

import { AuthError, RateLimitedError } from "../types/auth.ts";

const HTTP_STATUS_RE = /^HTTP (\d{3}) on GET /;

/** HTTP status carried by a `fetchHtml` error, or null. */
export function httpStatusOf(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  const m = HTTP_STATUS_RE.exec(err.message);
  return m?.[1] ? Number(m[1]) : null;
}

/**
 * The typed error to rethrow when `err` means "stop now" (checkpoint,
 * login page, rate limit), else null.
 */
export function asStopError(err: unknown): AuthError | null {
  if (err instanceof AuthError) return err;
  if (httpStatusOf(err) === 429) return new RateLimitedError();
  return null;
}

/** First line of an error message, for logs (Playwright appends a call log). */
export function shortMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split("\n", 1)[0] ?? "";
}
