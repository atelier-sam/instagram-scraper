/**
 * Guards shared by the parsers that read a place (post location, location
 * page, location JSON).
 *
 * Instagram payloads are read without a schema library (no dependency for
 * this); these guards are the explicit contract: a coordinate is kept only
 * when it is a real WGS84 value, a text only when it is a non-empty string.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Returns both coordinates, or null. Never one without the other: half a
 * point is not a position.
 *
 * Numeric strings are accepted (some Instagram surfaces serialize numbers
 * as strings). `(0, 0)` is rejected: it is the "no position" placeholder of
 * geo payloads, never a place a post is tagged at (supposed, not measured
 * on Instagram — but a false point in the Gulf of Guinea is worse than a
 * place resolved by its name).
 */
export function readCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const la = toFiniteNumber(lat);
  const ln = toFiniteNumber(lng);
  if (la === null || ln === null) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

/** Trimmed non-empty string, or undefined. */
export function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** String form of a numeric-or-string id, or undefined. */
export function readId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return undefined;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
