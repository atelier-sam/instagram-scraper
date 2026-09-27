/**
 * Location parsers.
 *
 * Both surfaces carry the same `native_location_data.location_info` block
 * (the shape instaloader, MIT, reads to complete a post's lat/lng):
 *  - the HTML page `/explore/locations/{id}/`, Apollo cache field
 *    `xdt_location_get_web_info` — measured 2026-09-27 with a logged-in
 *    session: `location_info.{location_id (string), name, lat, lng, slug,
 *    location_address, location_city, location_zip, category, media_count,
 *    phone, price_range, hours, ig_business}`; the post grid sits next to
 *    it in `xdt_location_get_web_info_tab.edges[].node`. The 2026-05 field
 *    `xdt_api__v1__locations__web_info` ({location_info, top, recent}) is
 *    no longer served; it is still read, as a fallback;
 *  - the JSON surface `/explore/locations/{id}/?__a=1&__d=dis`, body
 *    `native_location_data` — measured 2026-09-27: answered with the HTML
 *    app shell (no payload at all) to a browser navigation.
 *
 * Both are read with explicit guards (no schema dependency): a payload
 * that does not match simply yields null — Instagram reshuffles these often
 * and a soft miss lets the caller fall back to another surface.
 */

import { extractApolloCache } from "./apolloCache.ts";
import { readCoordinates, readId, readText } from "./coordinates.ts";
import type { HashtagPostSummary } from "./hashtag.ts";
import { isRecord } from "./jsonDocument.ts";

/** Field served since (at least) 2026-09: `{ native_location_data: { location_info } }`. */
const WEB_INFO_FIELD = "xdt_location_get_web_info";
/** Post grid of the page: `{ edges: [{ node: <media> }], page_info }`. */
const WEB_INFO_TAB_FIELD = "xdt_location_get_web_info_tab";
/** 2026-05 field: `{ location_info, top, recent }`. */
const LEGACY_FIELD = "xdt_api__v1__locations__web_info";

export interface InstagramLocationPage {
  id: string;
  name: string;
  slug?: string;
  /** Both set, or neither (see `readCoordinates`). */
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
  mediaCount?: number;
  topPosts: HashtagPostSummary[];
  recentPosts: HashtagPostSummary[];
}

/**
 * Parses an `/explore/locations/{id}/` HTML page. Returns null when no
 * known location payload is embedded.
 */
export function parseLocationFromHtml(
  html: string,
  locationIdHint?: string,
): InstagramLocationPage | null {
  const webInfo = extractApolloCache<unknown>(html, WEB_INFO_FIELD);
  const native = isRecord(webInfo) ? webInfo["native_location_data"] : undefined;
  if (isRecord(native)) {
    const page = mapLocationPayload(native, ["ranked", "top"], locationIdHint);
    if (page) {
      // The grid of the page. Instagram does not say whether it is ranked
      // or recent; it is what the page shows first, hence `topPosts`.
      if (page.topPosts.length === 0) {
        page.topPosts = collectMedias(edgeNodes(extractApolloCache(html, WEB_INFO_TAB_FIELD)));
      }
      return page;
    }
  }
  const legacy = extractApolloCache<unknown>(html, LEGACY_FIELD);
  if (!isRecord(legacy)) return null;
  return mapLocationPayload(legacy, ["top", "ranked"], locationIdHint);
}

/**
 * Parses the body of `/explore/locations/{id}/?__a=1&__d=dis`. Returns null
 * when `native_location_data.location_info` is missing or has no name.
 */
export function parseLocationFromJson(
  body: unknown,
  locationIdHint?: string,
): InstagramLocationPage | null {
  if (!isRecord(body)) return null;
  const native = body["native_location_data"];
  if (!isRecord(native)) return null;
  return mapLocationPayload(native, ["ranked", "top"], locationIdHint);
}

/**
 * Maps a `{ location_info, <top|ranked>, recent }` block. Field names are
 * read in both spellings Instagram uses across surfaces (`pk` / `location_id`,
 * `address` / `location_address`, `city` / `location_city`).
 */
function mapLocationPayload(
  payload: Record<string, unknown>,
  topKeys: readonly string[],
  locationIdHint: string | undefined,
): InstagramLocationPage | null {
  const info = payload["location_info"];
  if (!isRecord(info)) return null;
  const id =
    readId(info["pk"]) ?? readId(info["location_id"]) ?? readId(info["id"]) ?? locationIdHint;
  const name = readText(info["name"]);
  if (!id || !name) return null;

  const topSections = topKeys.map((k) => sectionsOf(payload[k])).find((s) => s.length > 0) ?? [];
  const out: InstagramLocationPage = {
    id,
    name,
    topPosts: collect(topSections),
    recentPosts: collect(sectionsOf(payload["recent"])),
  };
  const slug = readText(info["slug"]);
  if (slug) out.slug = slug;
  const coords = readCoordinates(info["lat"], info["lng"]);
  if (coords) {
    out.lat = coords.lat;
    out.lng = coords.lng;
  }
  const address = readText(info["location_address"]) ?? readText(info["address"]);
  if (address) out.address = address;
  const city = readText(info["location_city"]) ?? readText(info["city"]);
  if (city) out.city = city;
  const mediaCount = info["media_count"];
  if (typeof mediaCount === "number" && Number.isFinite(mediaCount)) out.mediaCount = mediaCount;
  return out;
}

function sectionsOf(block: unknown): unknown[] {
  if (!isRecord(block)) return [];
  const sections = block["sections"];
  return Array.isArray(sections) ? sections : [];
}

/** `sections[].layout_content.medias[].media` (legacy and JSON shapes). */
function collect(sections: readonly unknown[]): HashtagPostSummary[] {
  const nodes: unknown[] = [];
  for (const section of sections) {
    if (!isRecord(section)) continue;
    const layout = section["layout_content"];
    const medias = isRecord(layout) ? layout["medias"] : undefined;
    if (!Array.isArray(medias)) continue;
    for (const m of medias) nodes.push(isRecord(m) ? m["media"] : undefined);
  }
  return collectMedias(nodes);
}

/** `edges[].node` of a GraphQL connection. */
function edgeNodes(connection: unknown): unknown[] {
  if (!isRecord(connection)) return [];
  const edges = connection["edges"];
  if (!Array.isArray(edges)) return [];
  return edges.map((e) => (isRecord(e) ? e["node"] : undefined));
}

function collectMedias(nodes: readonly unknown[]): HashtagPostSummary[] {
  const out: HashtagPostSummary[] = [];
  for (const n of nodes) {
    if (!isRecord(n)) continue;
    const code = readText(n["code"]);
    if (!code) continue;
    const s: HashtagPostSummary = { shortcode: code };
    const user = n["user"];
    const username = isRecord(user) ? readText(user["username"]) : undefined;
    if (username) s.ownerUsername = username;
    if (typeof n["like_count"] === "number") s.likeCount = n["like_count"];
    if (typeof n["comment_count"] === "number") s.commentCount = n["comment_count"];
    if (typeof n["taken_at"] === "number") {
      s.takenAt = new Date(n["taken_at"] * 1000).toISOString();
    }
    if (n["media_type"] === 2) s.isVideo = true;
    const thumb = firstCandidateUrl(n["image_versions2"]);
    if (thumb) s.thumbnailUrl = thumb;
    out.push(s);
  }
  return out;
}

function firstCandidateUrl(versions: unknown): string | undefined {
  if (!isRecord(versions)) return undefined;
  const candidates = versions["candidates"];
  if (!Array.isArray(candidates)) return undefined;
  const first = candidates[0];
  return isRecord(first) ? readText(first["url"]) : undefined;
}
