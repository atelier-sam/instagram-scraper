import { describe, expect, it } from "vitest";
import { readLinkPlace } from "../src/scrape/link.ts";
import { scrapeLocationById } from "../src/scrape/location.ts";
import {
  CheckpointRequiredError,
  LoginRequiredError,
  RateLimitedError,
} from "../src/types/auth.ts";
import { InstagramLinkError } from "../src/types/link.ts";

/**
 * Fake `HttpClient.fetchHtml`: URL → content, or an Error to throw.
 * Records every URL so tests can count requests (the budget matters on a
 * real account) and prove no fallback runs after a stop signal.
 */
function fakeHttp(routes: Record<string, string | Error>) {
  const calls: string[] = [];
  return {
    calls,
    async fetchHtml(url: string): Promise<string> {
      calls.push(url);
      const hit = routes[url];
      if (hit === undefined) throw new Error(`HTTP 404 on GET ${url}`);
      if (hit instanceof Error) throw hit;
      return hit;
    },
  };
}

const POST_FIELD = "xdt_api__v1__media__shortcode__web_info";
const PAGE_FIELD = "xdt_location_get_web_info";
const LEGACY_FIELD = "xdt_api__v1__locations__web_info";

function apollo(field: string, payload: unknown): string {
  return `<!doctype html><script type="application/json">${JSON.stringify({
    require: [["S", "h", null, [{ __bbox: { result: { data: { [field]: payload } } } }]]],
  })}</script>`;
}

function postPage(location: unknown): string {
  return apollo(POST_FIELD, {
    items: [
      {
        code: "ABC",
        media_type: 1,
        caption: { text: "Légende exemple" },
        user: { pk: "900000001", username: "compte_exemple" },
        location,
      },
    ],
  });
}

/** A location page embedding `body` (`{ native_location_data }`) under the current field. */
function locationPage(body: unknown): string {
  return apollo(PAGE_FIELD, body);
}

function jsonDoc(body: unknown): string {
  return `<html><body><pre>${JSON.stringify(body).replace(/&/g, "&amp;")}</pre></body></html>`;
}

const POST_URL = "https://www.instagram.com/p/ABC/";
const LOC_JSON = "https://www.instagram.com/explore/locations/1000000001/?__a=1&__d=dis";
const LOC_HTML = "https://www.instagram.com/explore/locations/1000000001/";
const TAGGED = { pk: 1000000001, name: "Lieu Exemple" };
const LOC_BODY = {
  native_location_data: {
    location_info: {
      location_id: "1000000001",
      name: "Lieu Exemple (page)",
      lat: 44.1234,
      lng: 7.2345,
      location_city: "Villexemple",
    },
  },
};

describe("readLinkPlace — precision", () => {
  it("point from the post payload: one request, no lookup", async () => {
    const http = fakeHttp({ [POST_URL]: postPage({ ...TAGGED, lat: 45.5, lng: 6.25 }) });
    const place = await readLinkPlace(http, "https://www.instagram.com/reel/ABC/?igsh=x");
    expect(place).toEqual({
      kind: "post",
      shortcode: "ABC",
      author: "compte_exemple",
      caption: "Légende exemple",
      location: {
        id: "1000000001",
        name: "Lieu Exemple",
        lat: 45.5,
        lng: 6.25,
        precision: "point",
        coordinatesFrom: "post",
      },
    });
    expect(http.calls).toEqual([POST_URL]);
  });

  it("point from the location page (current field) when the post has none: 2 requests", async () => {
    const http = fakeHttp({ [POST_URL]: postPage(TAGGED), [LOC_HTML]: locationPage(LOC_BODY) });
    const place = await readLinkPlace(http, "https://instagram.com/p/ABC");
    expect(place.location).toEqual({
      id: "1000000001",
      name: "Lieu Exemple", // the name the author tagged wins
      lat: 44.1234,
      lng: 7.2345,
      city: "Villexemple",
      precision: "point",
      coordinatesFrom: "location-html",
    });
    expect(http.calls).toEqual([POST_URL, LOC_HTML]);
  });

  it("point from the JSON surface when the page fails", async () => {
    const http = fakeHttp({
      [POST_URL]: postPage(TAGGED),
      [LOC_HTML]: new Error(`HTTP 500 on GET ${LOC_HTML}`),
      [LOC_JSON]: jsonDoc(LOC_BODY),
    });
    const place = await readLinkPlace(http, POST_URL);
    expect(place.location).toMatchObject({
      lat: 44.1234,
      lng: 7.2345,
      precision: "point",
      coordinatesFrom: "location-json",
    });
    expect(http.calls).toEqual([POST_URL, LOC_HTML, LOC_JSON]);
  });

  it("legacy page field still gives a point", async () => {
    const http = fakeHttp({
      [POST_URL]: postPage(TAGGED),
      [LOC_HTML]: apollo(LEGACY_FIELD, {
        location_info: { pk: 1000000001, name: "X", lat: 1.5, lng: 2.5 },
      }),
    });
    const place = await readLinkPlace(http, POST_URL);
    expect(place.location).toMatchObject({ lat: 1.5, lng: 2.5, coordinatesFrom: "location-html" });
  });

  it("name only when every surface misses", async () => {
    const http = fakeHttp({
      [POST_URL]: postPage(TAGGED),
      [LOC_JSON]: "<!doctype html><html><body>app shell</body></html>",
      [LOC_HTML]: "<!doctype html><html><body>app shell</body></html>",
    });
    const logs: string[] = [];
    const place = await readLinkPlace(http, POST_URL, { log: (m) => logs.push(m) });
    expect(place.location).toEqual({ id: "1000000001", name: "Lieu Exemple", precision: "nom" });
    expect(http.calls).toHaveLength(3);
    expect(logs.join("\n")).toMatch(/HTML page: no location payload/);
    expect(logs.join("\n")).toMatch(/JSON surface answered HTML without payload/);
  });

  it("lookupLocation: false keeps it to one request", async () => {
    const http = fakeHttp({ [POST_URL]: postPage(TAGGED) });
    const place = await readLinkPlace(http, POST_URL, { lookupLocation: false });
    expect(place.location?.precision).toBe("nom");
    expect(http.calls).toEqual([POST_URL]);
  });

  it("location null when the post carries no place", async () => {
    const http = fakeHttp({ [POST_URL]: postPage(null) });
    const place = await readLinkPlace(http, POST_URL);
    expect(place.location).toBeNull();
    expect(place.author).toBe("compte_exemple");
  });

  it("a location link reads the place directly (one request)", async () => {
    const http = fakeHttp({ [LOC_HTML]: locationPage(LOC_BODY) });
    const place = await readLinkPlace(
      http,
      "https://www.instagram.com/explore/locations/1000000001/lieu-exemple/",
    );
    expect(place).toEqual({
      kind: "location",
      location: {
        id: "1000000001",
        name: "Lieu Exemple (page)",
        lat: 44.1234,
        lng: 7.2345,
        city: "Villexemple",
        precision: "point",
        coordinatesFrom: "location-html",
      },
    });
    expect(http.calls).toEqual([LOC_HTML]);
  });
});

describe("readLinkPlace — errors", () => {
  it("unsupported link: typed error, zero request", async () => {
    const http = fakeHttp({});
    await expect(
      readLinkPlace(http, "https://www.instagram.com/stories/x/1/"),
    ).rejects.toMatchObject({
      name: "InstagramLinkError",
      code: "unsupported",
    });
    expect(http.calls).toEqual([]);
  });

  it("unreadable post (404 or no payload): not_found", async () => {
    await expect(readLinkPlace(fakeHttp({}), POST_URL)).rejects.toBeInstanceOf(InstagramLinkError);
    await expect(
      readLinkPlace(fakeHttp({ [POST_URL]: "<html></html>" }), POST_URL),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("unreadable location link: not_found", async () => {
    const http = fakeHttp({});
    await expect(
      readLinkPlace(http, "https://www.instagram.com/explore/locations/1000000001/"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("429 on the post: RateLimitedError, nothing else requested", async () => {
    const http = fakeHttp({ [POST_URL]: new Error(`HTTP 429 on GET ${POST_URL}`) });
    await expect(readLinkPlace(http, POST_URL)).rejects.toBeInstanceOf(RateLimitedError);
    expect(http.calls).toEqual([POST_URL]);
  });

  it("429 on the location page: stop, no JSON fallback", async () => {
    const http = fakeHttp({
      [POST_URL]: postPage(TAGGED),
      [LOC_HTML]: new Error(`HTTP 429 on GET ${LOC_HTML}`),
      [LOC_JSON]: jsonDoc(LOC_BODY),
    });
    await expect(readLinkPlace(http, POST_URL)).rejects.toBeInstanceOf(RateLimitedError);
    expect(http.calls).toEqual([POST_URL, LOC_HTML]);
  });

  it("checkpoint redirect on the location page: stop, no JSON fallback", async () => {
    const http = fakeHttp({
      [POST_URL]: postPage(TAGGED),
      [LOC_HTML]: new CheckpointRequiredError(),
      [LOC_JSON]: jsonDoc(LOC_BODY),
    });
    await expect(readLinkPlace(http, POST_URL)).rejects.toBeInstanceOf(CheckpointRequiredError);
    expect(http.calls).toEqual([POST_URL, LOC_HTML]);
  });

  it("checkpoint envelope in the JSON body (fallback): stop", async () => {
    const http = fakeHttp({
      [POST_URL]: postPage(TAGGED),
      [LOC_HTML]: "<!doctype html><html><body>app shell</body></html>",
      [LOC_JSON]: jsonDoc({ message: "checkpoint_required", status: "fail" }),
    });
    await expect(readLinkPlace(http, POST_URL)).rejects.toBeInstanceOf(CheckpointRequiredError);
    expect(http.calls).toEqual([POST_URL, LOC_HTML, LOC_JSON]);
  });

  it("login redirect from HttpClient propagates as is", async () => {
    const http = fakeHttp({ [POST_URL]: new LoginRequiredError() });
    await expect(readLinkPlace(http, POST_URL)).rejects.toBeInstanceOf(LoginRequiredError);
  });
});

describe("scrapeLocationById", () => {
  it("nominal case: the page alone, one request", async () => {
    const http = fakeHttp({ [LOC_HTML]: locationPage(LOC_BODY) });
    const place = await scrapeLocationById(http, "1000000001");
    expect(place).toMatchObject({ id: "1000000001", lat: 44.1234, lng: 7.2345, source: "html" });
    expect(http.calls).toEqual([LOC_HTML]);
  });

  it("parses a page served on the JSON URL when the page itself failed", async () => {
    const http = fakeHttp({
      [LOC_HTML]: new Error(`HTTP 500 on GET ${LOC_HTML}`),
      [LOC_JSON]: locationPage(LOC_BODY),
    });
    const place = await scrapeLocationById(http, "1000000001");
    expect(place).toMatchObject({ id: "1000000001", source: "html" });
    expect(http.calls).toEqual([LOC_HTML, LOC_JSON]);
  });

  it("refuses a non-numeric id without any request", async () => {
    const http = fakeHttp({});
    expect(await scrapeLocationById(http, "../../accounts/edit")).toBeNull();
    expect(http.calls).toEqual([]);
  });

  it("logs field names only, never the body", async () => {
    const http = fakeHttp({
      [LOC_HTML]: '<html><script type="application/json">{"xdt_api__v1__other":1}</script></html>',
      [LOC_JSON]: jsonDoc({ status: "ok", secret_like_value: "sessionid=should-not-appear" }),
    });
    const logs: string[] = [];
    expect(await scrapeLocationById(http, "1000000001", { log: (m) => logs.push(m) })).toBeNull();
    const text = logs.join("\n");
    expect(text).toMatch(/keys: status, secret_like_value/);
    expect(text).toMatch(/fields: xdt_api__v1__other/);
    expect(text).not.toMatch(/should-not-appear/);
  });
});
