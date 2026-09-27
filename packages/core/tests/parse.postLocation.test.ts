import { describe, expect, it } from "vitest";
import { readCoordinates } from "../src/parse/coordinates.ts";
import { mapLocation, postFromWebInfoItem } from "../src/parse/post.ts";

describe("mapLocation — place of a post", () => {
  it("measured 2026-09-27 field set: __typename, lat, lng, name, pk, profile_pic_url", () => {
    expect(
      // Values of the two keys the parser does not read are neutral (only
      // their names were measured); the place values are the measured ones.
      mapLocation({
        __typename: "valeur_neutre",
        pk: 134420540554918,
        name: "Kotor, Montenegro",
        lat: 42.4293342,
        lng: 18.7701058,
        profile_pic_url: "https://example.invalid/pic.jpg",
      } as Parameters<typeof mapLocation>[0]),
    ).toEqual({
      id: "134420540554918",
      name: "Kotor, Montenegro",
      lat: 42.4293342,
      lng: 18.7701058,
    });
  });

  it("keeps lat / lng / address / city when the payload carries them", () => {
    expect(
      mapLocation({
        pk: 1000000001,
        name: "Lieu Exemple",
        slug: "lieu-exemple",
        lat: 44.1234,
        lng: 7.2345,
        address: "1 rue Exemple",
        city: "Villexemple",
      }),
    ).toEqual({
      id: "1000000001",
      name: "Lieu Exemple",
      slug: "lieu-exemple",
      lat: 44.1234,
      lng: 7.2345,
      address: "1 rue Exemple",
      city: "Villexemple",
    });
  });

  it("without coordinates: id + name only, no lat/lng keys at all", () => {
    const loc = mapLocation({ pk: "1000000002", name: "Lieu Sans Point", short_name: "Lieu" });
    expect(loc).toEqual({ id: "1000000002", name: "Lieu Sans Point" });
    expect(loc && "lat" in loc).toBe(false);
  });

  it("drops a half point (lat without lng) and null / empty extras", () => {
    const loc = mapLocation({
      pk: 3,
      name: "Demi",
      lat: 44.1,
      lng: null,
      address: "  ",
      city: null,
    });
    expect(loc).toEqual({ id: "3", name: "Demi" });
  });

  it("drops a location without id (instaloader #2736) or without name", () => {
    expect(mapLocation({ name: "Sans id" })).toBeUndefined();
    expect(mapLocation({ pk: 4, name: "" })).toBeUndefined();
    expect(mapLocation(null)).toBeUndefined();
  });

  it("flows through postFromWebInfoItem", () => {
    const post = postFromWebInfoItem({
      code: "LOC1",
      media_type: 1,
      location: { pk: 5, name: "Lieu Exemple", lat: "45.5", lng: "6.25" },
    });
    expect(post.location).toEqual({ id: "5", name: "Lieu Exemple", lat: 45.5, lng: 6.25 });
  });
});

describe("readCoordinates", () => {
  it.each([
    [44.1, 7.2, { lat: 44.1, lng: 7.2 }],
    ["-33.86", "151.2", { lat: -33.86, lng: 151.2 }],
    [90, -180, { lat: 90, lng: -180 }],
  ])("(%s, %s) → point", (lat, lng, expected) => {
    expect(readCoordinates(lat, lng)).toEqual(expected);
  });

  it.each([
    [0, 0],
    [91, 7],
    [44, 181],
    [Number.NaN, 7],
    [Number.POSITIVE_INFINITY, 7],
    ["", 7],
    ["abc", 7],
    [null, 7],
    [undefined, undefined],
    [44, undefined],
  ])("(%s, %s) → null", (lat, lng) => {
    expect(readCoordinates(lat, lng)).toBeNull();
  });
});
