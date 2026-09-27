/**
 * Link → place contract.
 *
 * `readLinkPlace` is consumed by the travels places engine
 * (`lib/lieux/sources/instagram.ts`): the shape of {@link LinkPlace} is a
 * contract. Add optional fields only; never rename or remove one.
 */

/** A recognized Instagram link, as returned by `parseInstagramLink`. */
export type InstagramLink =
  | {
      kind: "post";
      /** Shortcode from `/p/`, `/reel/`, `/reels/` or `/tv/`. */
      shortcode: string;
      /** Canonical URL the scraper fetches (`/p/{shortcode}/` serves reels too). */
      url: string;
    }
  | {
      kind: "location";
      /** Numeric Instagram location id from `/explore/locations/{id}/`. */
      locationId: string;
      url: string;
    };

/**
 * How precisely the place is known:
 *  - `"point"`: Instagram served both coordinates (`lat`, `lng` are set);
 *  - `"nom"`: only the name (and id) is known — the caller must resolve the
 *    name itself and say the position is deduced from it.
 */
export type LinkPlacePrecision = "point" | "nom";

/** Which Instagram surface the coordinates came from (set when `precision === "point"`). */
export type LinkPlaceCoordinatesSource = "post" | "location-json" | "location-html";

export interface LinkPlaceLocation {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
  precision: LinkPlacePrecision;
  coordinatesFrom?: LinkPlaceCoordinatesSource;
}

export interface LinkPlace {
  kind: "post" | "location";
  shortcode?: string;
  /** Author username of the post. */
  author?: string;
  caption?: string;
  /** `null` when the post carries no place. */
  location: LinkPlaceLocation | null;
}

export type InstagramLinkErrorCode = "unsupported" | "not_found";

/**
 * `unsupported`: the URL is not a post / reel / location link (no request
 * was made). `not_found`: the target could not be read (deleted, private,
 * or its surface changed).
 */
export class InstagramLinkError extends Error {
  public readonly code: InstagramLinkErrorCode;
  constructor(code: InstagramLinkErrorCode, message: string) {
    super(message);
    this.name = "InstagramLinkError";
    this.code = code;
  }
}
