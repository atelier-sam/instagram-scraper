/**
 * JSON surfaces read through a real browser navigation.
 *
 * `HttpClient.fetchHtml` navigates a Playwright page (the only path that
 * carries the session fingerprint Instagram accepts) and returns
 * `page.content()`. When the URL serves JSON, Chromium wraps the body in
 * `<pre>` (plus, on recent versions, a pretty-print container next to it),
 * HTML-escaping `&`, `<` and `>`. This module unwraps that, and reads the
 * failure envelopes Instagram answers JSON callers with.
 */

const PRE_RE = /<pre\b[^>]*>([\s\S]*?)<\/pre>/i;

/**
 * Returns the parsed JSON body of a navigated JSON URL, or null when the
 * document is not JSON (e.g. Instagram served its HTML app instead).
 * Accepts the raw JSON too, so it keeps working if the transport changes.
 */
export function extractJsonDocument(content: string): unknown | null {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return tryParse(trimmed);
  const pre = PRE_RE.exec(content)?.[1];
  if (pre === undefined) return null;
  const text = decodeHtmlText(pre).trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  return tryParse(text);
}

export type InstagramJsonFailure = "checkpoint" | "login" | "rate_limit";

/**
 * Reads the failure envelope of an Instagram JSON answer
 * (`{"status":"fail","message":…}`). Returns null when the body is not a
 * failure the caller must stop on.
 *
 * Messages follow what instaloader handles (`checkpoint_required`,
 * `challenge_required`, `feedback_required`, "Please wait a few minutes")
 * — not all measured here.
 */
export function readInstagramJsonFailure(body: unknown): InstagramJsonFailure | null {
  if (!isRecord(body)) return null;
  const message = typeof body["message"] === "string" ? body["message"].toLowerCase() : "";
  if (
    message.includes("checkpoint_required") ||
    message.includes("challenge_required") ||
    typeof body["checkpoint_url"] === "string" ||
    isRecord(body["challenge"])
  ) {
    return "checkpoint";
  }
  if (body["require_login"] === true || message.includes("login_required")) return "login";
  if (
    body["spam"] === true ||
    message.includes("feedback_required") ||
    message.includes("please wait a few minutes") ||
    message.includes("rate limit")
  ) {
    return "rate_limit";
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tryParse(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function decodeHtmlText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
