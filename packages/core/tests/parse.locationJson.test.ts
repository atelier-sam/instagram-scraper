import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractJsonDocument, readInstagramJsonFailure } from "../src/parse/jsonDocument.ts";
import { parseLocationFromJson } from "../src/parse/location.ts";

function fixture(): unknown {
  return JSON.parse(
    readFileSync(new URL("./fixtures/location-json-anon.json", import.meta.url), "utf-8"),
  );
}

/** What `page.content()` returns after Chromium navigated a JSON URL. */
function asChromiumDocument(json: string): string {
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<html><head><meta name="color-scheme" content="light dark"></head><body><pre style="word-wrap: break-word; white-space: pre-wrap;">${escaped}</pre><div class="json-formatter-container"></div></body></html>`;
}

describe("parseLocationFromJson — native_location_data.location_info", () => {
  it("reads the measured location_info block (location_id string, empty address / city dropped)", () => {
    expect(parseLocationFromJson(fixture())).toEqual({
      id: "134420540554918",
      name: "Kotor, Montenegro",
      slug: "kotor-montenegro",
      lat: 42.425024312505,
      lng: 18.77028924553,
      mediaCount: 200184,
      topPosts: [],
      recentPosts: [],
    });
  });

  it("falls back to the id hint when location_info has no id", () => {
    const result = parseLocationFromJson(
      { native_location_data: { location_info: { name: "Lieu Exemple" } } },
      "42",
    );
    expect(result).toMatchObject({ id: "42", name: "Lieu Exemple" });
    expect(result?.lat).toBeUndefined();
  });

  it.each([
    null,
    "text",
    {},
    { native_location_data: null },
    { native_location_data: { location_info: { location_id: "1", name: "" } } },
    { graphql: { location: { id: "1", name: "Autre forme" } } },
  ])("%j → null", (body) => {
    expect(parseLocationFromJson(body)).toBeNull();
  });
});

describe("extractJsonDocument", () => {
  it("unwraps the <pre> Chromium puts around a JSON body (entities decoded)", () => {
    const json = JSON.stringify({ a: "x & y <b>", n: 1 });
    expect(extractJsonDocument(asChromiumDocument(json))).toEqual({ a: "x & y <b>", n: 1 });
  });

  it("accepts a raw JSON body", () => {
    expect(extractJsonDocument(' {"ok":true} ')).toEqual({ ok: true });
  });

  it("returns null for the HTML app or broken JSON", () => {
    expect(
      extractJsonDocument("<!doctype html><html><body><div>app</div></body></html>"),
    ).toBeNull();
    expect(extractJsonDocument("<html><body><pre>{not json</pre></body></html>")).toBeNull();
    expect(extractJsonDocument("<html><body><pre>plain text</pre></body></html>")).toBeNull();
  });

  it("round-trips the fixture through a Chromium document", () => {
    const raw = readFileSync(
      new URL("./fixtures/location-json-anon.json", import.meta.url),
      "utf-8",
    );
    expect(parseLocationFromJson(extractJsonDocument(asChromiumDocument(raw)))?.name).toBe(
      "Kotor, Montenegro",
    );
  });
});

describe("readInstagramJsonFailure", () => {
  it.each([
    [
      { message: "checkpoint_required", checkpoint_url: "/challenge/x/", status: "fail" },
      "checkpoint",
    ],
    [{ message: "challenge_required", status: "fail" }, "checkpoint"],
    [{ require_login: true, status: "fail" }, "login"],
    [{ message: "Please wait a few minutes before you try again.", status: "fail" }, "rate_limit"],
    [{ message: "feedback_required", spam: true, status: "fail" }, "rate_limit"],
  ])("%j → %s", (body, expected) => {
    expect(readInstagramJsonFailure(body)).toBe(expected);
  });

  it("returns null for a normal answer", () => {
    expect(readInstagramJsonFailure(fixture())).toBeNull();
    expect(readInstagramJsonFailure({ status: "ok" })).toBeNull();
    expect(readInstagramJsonFailure(null)).toBeNull();
  });
});
