/**
 * Instagram link recognizer — pure, no network.
 *
 * Accepted (everything else → null):
 *  - posts: `/p/{code}/`, `/reel/{code}/`, `/reels/{code}/`, `/tv/{code}/`,
 *    and the `/{username}/p/{code}/` / `/{username}/reel/{code}/` form the
 *    desktop share button produces;
 *  - places: `/explore/locations/{id}/…`;
 *  - hosts `instagram.com`, `www.instagram.com`, `instagr.am`, over http(s),
 *    scheme optional (a pasted `instagram.com/p/…` is still a link).
 *
 * Query strings (`?igsh=…`, `?utm_source=…`, `?img_index=…`) and fragments
 * are ignored: they identify the sharer, not the content. Stories,
 * highlights, profiles, hashtags and other hosts are refused on purpose —
 * none of them carries a place the scraper can read.
 */

import type { InstagramLink } from "../types/link.ts";

const HOSTS = new Set(["instagram.com", "www.instagram.com", "instagr.am"]);
const POST_KINDS = new Set(["p", "reel", "reels", "tv"]);
/** Base64url alphabet of Instagram shortcodes (private-post codes are longer). */
const SHORTCODE_RE = /^[A-Za-z0-9_-]+$/;
const LOCATION_ID_RE = /^\d+$/;
/** Instagram usernames: letters, digits, `.` and `_`, 30 chars at most. */
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

export function parseInstagramLink(input: string): InstagramLink | null {
  const url = toUrl(input);
  if (!url) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter((s) => s.length > 0);

  const post = postShortcode(segments);
  if (post) {
    return { kind: "post", shortcode: post, url: `https://www.instagram.com/p/${post}/` };
  }

  if (segments[0] === "explore" && segments[1] === "locations") {
    const id = segments[2];
    if (id && LOCATION_ID_RE.test(id)) {
      return {
        kind: "location",
        locationId: id,
        url: `https://www.instagram.com/explore/locations/${id}/`,
      };
    }
  }
  return null;
}

function postShortcode(segments: readonly string[]): string | null {
  const [a, b, c] = segments;
  // `/p/{code}/` and siblings.
  if (a && POST_KINDS.has(a) && b && SHORTCODE_RE.test(b)) return b;
  // `/{username}/p/{code}/` — only `p` and `reel` exist in that form.
  if (a && USERNAME_RE.test(a) && (b === "p" || b === "reel") && c && SHORTCODE_RE.test(c)) {
    return c;
  }
  return null;
}

function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}
