/**
 * High-level: scrape one post / reel by shortcode.
 *
 * `/p/{shortcode}/` serves reels too (same `web_info` payload), so every
 * post kind goes through the same URL.
 */

import type { HttpClient } from "../http/client.ts";
import { extractApolloCache } from "../parse/apolloCache.ts";
import { isRecord } from "../parse/jsonDocument.ts";
import { parsePostFromHtml } from "../parse/post.ts";
import type { InstagramPost } from "../types/post.ts";
import { asStopError, httpStatusOf } from "./errors.ts";

/** The only `HttpClient` method the scrape functions need (lets tests fake it). */
export type HtmlFetcher = Pick<HttpClient, "fetchHtml">;

export interface ScrapePostOptions {
  /**
   * Diagnostic log: the field NAMES of the post's `location` object (never
   * values), so a renamed coordinate field shows up without a debug session.
   */
  log?: (message: string) => void;
}

/**
 * Returns null when the post cannot be read (404, or a page without the
 * `web_info` payload: deleted, private and not followed, surface changed).
 * Throws the typed stop errors (checkpoint, login, rate limit).
 */
export async function scrapePostByShortcode(
  http: HtmlFetcher,
  shortcode: string,
  options: ScrapePostOptions = {},
): Promise<InstagramPost | null> {
  const url = `https://www.instagram.com/p/${encodeURIComponent(shortcode)}/`;
  let html: string;
  try {
    html = await http.fetchHtml(url);
  } catch (err) {
    const stop = asStopError(err);
    if (stop) throw stop;
    if (httpStatusOf(err) === 404) return null;
    throw err;
  }
  if (options.log) options.log(`post location fields: ${locationFieldNames(html)}`);
  return parsePostFromHtml(html, shortcode);
}

function locationFieldNames(html: string): string {
  const webInfo = extractApolloCache<unknown>(html, "xdt_api__v1__media__shortcode__web_info");
  const items = isRecord(webInfo) ? webInfo["items"] : undefined;
  const first = Array.isArray(items) ? items[0] : undefined;
  if (!isRecord(first)) return "no web_info item";
  const location = first["location"];
  if (!isRecord(location)) return location === null ? "location: null" : "no location key";
  return Object.keys(location).sort().join(", ");
}
