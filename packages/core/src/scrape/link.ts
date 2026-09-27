/**
 * High-level: Instagram link → place.
 *
 * Consumed by the travels places engine; the returned {@link LinkPlace} is
 * a contract (see `types/link.ts`). Coordinates come, in order, from the
 * post payload, then from the place looked up by id
 * ({@link scrapeLocationById}); otherwise the place is returned by name
 * with `precision: "nom"` — never a guessed point.
 */

import { parseInstagramLink } from "../parse/link.ts";
import {
  InstagramLinkError,
  type LinkPlace,
  type LinkPlaceCoordinatesSource,
  type LinkPlaceLocation,
} from "../types/link.ts";
import type { InstagramLocation } from "../types/post.ts";
import { type ScrapedLocation, scrapeLocationById } from "./location.ts";
import { type HtmlFetcher, scrapePostByShortcode } from "./post.ts";

export interface ReadLinkPlaceOptions {
  /**
   * Look the place up by id when the post payload has no coordinates
   * (1 or 2 more requests). Default true; false keeps it to one request
   * per post link and returns `precision: "nom"` in that case.
   */
  lookupLocation?: boolean;
  /** Step log, see `ScrapeLocationOptions.log`. */
  log?: (message: string) => void;
}

/**
 * Throws {@link InstagramLinkError} `unsupported` (no request made) or
 * `not_found`, and the typed stop errors (checkpoint, login, rate limit).
 */
export async function readLinkPlace(
  http: HtmlFetcher,
  url: string,
  options: ReadLinkPlaceOptions = {},
): Promise<LinkPlace> {
  const log = options.log ?? (() => undefined);
  const link = parseInstagramLink(url);
  if (!link) {
    throw new InstagramLinkError("unsupported", "Not an Instagram post, reel or location link");
  }

  if (link.kind === "location") {
    const place = await scrapeLocationById(http, link.locationId, { log });
    if (!place) {
      throw new InstagramLinkError("not_found", `Location ${link.locationId} could not be read`);
    }
    return { kind: "location", location: fromScraped(place) };
  }

  log(`GET ${link.url}`);
  const post = await scrapePostByShortcode(http, link.shortcode, { log: options.log });
  if (!post) {
    throw new InstagramLinkError("not_found", `Post ${link.shortcode} could not be read`);
  }
  const result: LinkPlace = {
    kind: "post",
    shortcode: post.shortcode || link.shortcode,
    location: null,
  };
  if (post.authorUsername) result.author = post.authorUsername;
  if (post.caption) result.caption = post.caption;
  if (!post.location) return result;

  const tagged = post.location;
  if (tagged.lat !== undefined && tagged.lng !== undefined) {
    result.location = point(tagged, tagged.lat, tagged.lng, "post");
    return result;
  }
  if (options.lookupLocation === false) {
    result.location = byName(tagged);
    return result;
  }
  const looked = await scrapeLocationById(http, tagged.id, { log });
  if (looked?.lat !== undefined && looked.lng !== undefined) {
    // The name stays the one the author tagged; the lookup only adds what
    // the post lacked.
    result.location = point(
      {
        ...tagged,
        address: tagged.address ?? looked.address,
        city: tagged.city ?? looked.city,
      },
      looked.lat,
      looked.lng,
      looked.source === "json" ? "location-json" : "location-html",
    );
  } else {
    result.location = byName({
      ...tagged,
      address: tagged.address ?? looked?.address,
      city: tagged.city ?? looked?.city,
    });
  }
  return result;
}

function fromScraped(place: ScrapedLocation): LinkPlaceLocation {
  const tagged: InstagramLocation = { id: place.id, name: place.name };
  if (place.address) tagged.address = place.address;
  if (place.city) tagged.city = place.city;
  if (place.lat !== undefined && place.lng !== undefined) {
    return point(
      tagged,
      place.lat,
      place.lng,
      place.source === "json" ? "location-json" : "location-html",
    );
  }
  return byName(tagged);
}

function point(
  place: InstagramLocation,
  lat: number,
  lng: number,
  from: LinkPlaceCoordinatesSource,
): LinkPlaceLocation {
  return { ...base(place), lat, lng, precision: "point", coordinatesFrom: from };
}

function byName(place: InstagramLocation): LinkPlaceLocation {
  return { ...base(place), precision: "nom" };
}

/** id, name, and address / city only when known (no `undefined` keys in JSON output). */
function base(
  place: InstagramLocation,
): Pick<LinkPlaceLocation, "id" | "name" | "address" | "city"> {
  const out: Pick<LinkPlaceLocation, "id" | "name" | "address" | "city"> = {
    id: place.id,
    name: place.name,
  };
  if (place.address) out.address = place.address;
  if (place.city) out.city = place.city;
  return out;
}
