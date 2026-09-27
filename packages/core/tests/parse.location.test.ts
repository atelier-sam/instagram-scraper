import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLocationFromHtml } from "../src/parse/location.ts";

const FIELD = "xdt_api__v1__locations__web_info";

function wrap(payload: unknown): string {
  return `<!doctype html><script type="application/json">${JSON.stringify({
    require: [
      [
        "ScheduledServerJS",
        "handle",
        null,
        [{ __bbox: { complete: true, result: { data: { [FIELD]: payload } } } }],
      ],
    ],
  })}</script>`;
}

const sample = {
  location_info: {
    pk: 264617522,
    name: "Cheverny",
    slug: "cheverny",
    lat: 47.5,
    lng: 1.45,
    media_count: 12345,
  },
  top: {
    sections: [
      {
        layout_content: {
          medias: [
            {
              media: {
                code: "TOPC1",
                user: { username: "alice" },
                like_count: 9,
                comment_count: 1,
                taken_at: 1_700_000_000,
                media_type: 1,
                image_versions2: { candidates: [{ url: "https://t.jpg" }] },
              },
            },
          ],
        },
      },
    ],
  },
  recent: { sections: [] },
};

describe("parseLocationFromHtml", () => {
  it("extracts location info + coerces pk to string", () => {
    const result = parseLocationFromHtml(wrap(sample));
    expect(result?.id).toBe("264617522");
    expect(result?.name).toBe("Cheverny");
    expect(result?.slug).toBe("cheverny");
    expect(result?.lat).toBe(47.5);
    expect(result?.lng).toBe(1.45);
    expect(result?.mediaCount).toBe(12345);
    expect(result?.topPosts).toHaveLength(1);
    expect(result?.topPosts[0]?.shortcode).toBe("TOPC1");
  });

  it("returns null when location_info is missing", () => {
    expect(parseLocationFromHtml(wrap({}))).toBeNull();
  });
});

describe("parseLocationFromHtml — extra fields", () => {
  it("reads location_address / location_city and rejects (0, 0)", () => {
    const result = parseLocationFromHtml(
      wrap({
        location_info: {
          pk: "7",
          name: "Lieu Exemple",
          lat: 0,
          lng: 0,
          location_address: "1 rue Exemple",
          location_city: "Villexemple",
        },
      }),
    );
    expect(result).toMatchObject({ id: "7", address: "1 rue Exemple", city: "Villexemple" });
    expect(result?.lat).toBeUndefined();
    expect(result?.lng).toBeUndefined();
  });

  it("survives malformed sections instead of throwing", () => {
    const result = parseLocationFromHtml(
      wrap({
        location_info: { pk: 8, name: "Lieu" },
        top: { sections: { not: "an array" } },
        recent: { sections: [{ layout_content: { medias: "nope" } }, null] },
      }),
    );
    expect(result?.topPosts).toEqual([]);
    expect(result?.recentPosts).toEqual([]);
  });
});

describe("parseLocationFromHtml — xdt_location_get_web_info (shape measured 2026-09-27)", () => {
  function page(): string {
    const blob = readFileSync(
      new URL("./fixtures/location-page-anon.json", import.meta.url),
      "utf-8",
    );
    return `<!doctype html><script type="application/json">${blob}</script>`;
  }

  it("reads native_location_data.location_info", () => {
    const result = parseLocationFromHtml(page());
    expect(result).toMatchObject({
      id: "134420540554918",
      name: "Kotor, Montenegro",
      slug: "kotor-montenegro",
      lat: 42.425024312505,
      lng: 18.77028924553,
      mediaCount: 200184,
    });
    expect(result?.address).toBeUndefined(); // "" in the payload
    expect(result?.city).toBeUndefined();
  });

  it("reads the grid from xdt_location_get_web_info_tab.edges[].node", () => {
    const result = parseLocationFromHtml(page());
    expect(result?.topPosts).toEqual([
      {
        shortcode: "FIXTURElOC1",
        ownerUsername: "compte_exemple",
        likeCount: 12,
        commentCount: 1,
        takenAt: "2023-11-14T22:13:20.000Z",
        thumbnailUrl: "https://example.invalid/fixture-thumb.jpg",
      },
    ]);
    expect(result?.recentPosts).toEqual([]);
  });

  it("still reads the 2026-05 field when the new one is absent (legacy fallback)", () => {
    expect(parseLocationFromHtml(wrap(sample))?.name).toBe("Cheverny");
  });

  it("returns null when native_location_data has no named place", () => {
    const html = `<script type="application/json">${JSON.stringify({
      __bbox: {
        result: {
          data: { xdt_location_get_web_info: { native_location_data: { location_info: {} } } },
        },
      },
    })}</script>`;
    expect(parseLocationFromHtml(html)).toBeNull();
  });
});
