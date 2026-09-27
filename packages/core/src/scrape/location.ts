/**
 * High-level: read an Instagram place by its numeric id.
 *
 * Order of surfaces (measured 2026-09-27 with Sam's session):
 *  1. HTML page `/explore/locations/{id}/` — embeds
 *     `xdt_location_get_web_info.native_location_data.location_info`
 *     (name, lat, lng, slug, address, city): one request in the nominal case.
 *  2. JSON `/explore/locations/{id}/?__a=1&__d=dis` in fallback only — the
 *     surface instaloader reads, same `native_location_data` block. On
 *     2026-09-27 it answered a browser navigation with the HTML app shell
 *     and no payload, so trying it first would double the requests for
 *     nothing. If Instagram answers that URL with a page that does embed
 *     the payload, it is parsed too.
 *
 * Contract: resolves null when neither surface yields a named place;
 * throws only the stop errors (checkpoint, login page, rate limit), and
 * never tries the fallback after one of them.
 */

import { extractJsonDocument, readInstagramJsonFailure } from "../parse/jsonDocument.ts";
import { parseLocationFromHtml, parseLocationFromJson } from "../parse/location.ts";
import type { InstagramLocationPage } from "../parse/location.ts";
import { CheckpointRequiredError, LoginRequiredError, RateLimitedError } from "../types/auth.ts";
import { asStopError, shortMessage } from "./errors.ts";
import type { HtmlFetcher } from "./post.ts";

export type LocationSurface = "json" | "html";

export type ScrapedLocation = InstagramLocationPage & {
  /** Surface the place was read from. */
  source: LocationSurface;
};

export interface ScrapeLocationOptions {
  /**
   * Step log (one line per request and per miss). Carries URLs built here,
   * payload field NAMES and first lines of errors — never cookies or bodies.
   */
  log?: (message: string) => void;
}

const LOCATION_ID_RE = /^\d+$/;

export async function scrapeLocationById(
  http: HtmlFetcher,
  locationId: string,
  options: ScrapeLocationOptions = {},
): Promise<ScrapedLocation | null> {
  const log = options.log ?? (() => undefined);
  const id = locationId.trim();
  // Refuse anything but a numeric id: it is interpolated into URLs.
  if (!LOCATION_ID_RE.test(id)) return null;

  const base = `https://www.instagram.com/explore/locations/${id}/`;

  // 1. HTML page.
  log(`GET ${base}`);
  try {
    const html = await http.fetchHtml(base);
    const parsed = parseLocationFromHtml(html, id);
    if (parsed) return { ...parsed, source: "html" };
    log(`HTML page: no location payload (fields: ${apolloFields(html)})`);
  } catch (err) {
    const stop = asStopError(err);
    if (stop) throw stop;
    log(`HTML page failed: ${shortMessage(err)}`);
  }

  // 2. JSON surface.
  const jsonUrl = `${base}?__a=1&__d=dis`;
  log(`GET ${jsonUrl}`);
  try {
    const content = await http.fetchHtml(jsonUrl);
    const body = extractJsonDocument(content);
    if (body !== null) {
      throwOnJsonFailure(body);
      const parsed = parseLocationFromJson(body, id);
      if (parsed) return { ...parsed, source: "json" };
      log(`JSON surface: no native_location_data.location_info (keys: ${topKeys(body)})`);
    } else {
      const parsed = parseLocationFromHtml(content, id);
      if (parsed) return { ...parsed, source: "html" };
      log(`JSON surface answered HTML without payload (fields: ${apolloFields(content)})`);
    }
  } catch (err) {
    const stop = asStopError(err);
    if (stop) throw stop;
    log(`JSON surface failed: ${shortMessage(err)}`);
  }
  return null;
}

function throwOnJsonFailure(body: unknown): void {
  switch (readInstagramJsonFailure(body)) {
    case "checkpoint":
      throw new CheckpointRequiredError();
    case "login":
      throw new LoginRequiredError();
    case "rate_limit":
      throw new RateLimitedError();
    default:
      return;
  }
}

/** Top-level key names of a JSON body (diagnostic only). */
function topKeys(body: unknown): string {
  if (body === null || typeof body !== "object") return typeof body;
  return Object.keys(body).slice(0, 12).join(", ") || "none";
}

/**
 * Names of the `xdt_*` GraphQL fields a page embeds — tells which field to
 * parse when Instagram renames the location payload (diagnostic only).
 */
function apolloFields(html: string): string {
  const names = new Set<string>();
  for (const m of html.matchAll(/"(xdt_[A-Za-z0-9_]+)"/g)) {
    if (m[1]) names.add(m[1]);
    if (names.size >= 15) break;
  }
  return names.size > 0 ? [...names].join(", ") : "none";
}
