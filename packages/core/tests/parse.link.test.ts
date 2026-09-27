import { describe, expect, it } from "vitest";
import { parseInstagramLink } from "../src/parse/link.ts";

describe("parseInstagramLink — recognized links", () => {
  it("positive control: /p/ABC/?igsh=x gives ABC", () => {
    expect(parseInstagramLink("https://www.instagram.com/p/ABC/?igsh=x")).toEqual({
      kind: "post",
      shortcode: "ABC",
      url: "https://www.instagram.com/p/ABC/",
    });
  });

  it.each([
    ["https://www.instagram.com/p/DAbc-12_xyZ/", "DAbc-12_xyZ"],
    ["https://instagram.com/p/DAbc-12_xyZ", "DAbc-12_xyZ"],
    ["https://www.instagram.com/reel/C9reel_01/?utm_source=ig_web_copy_link", "C9reel_01"],
    ["https://www.instagram.com/reels/C9reels02/", "C9reels02"],
    ["https://www.instagram.com/tv/B8tv00003/", "B8tv00003"],
    ["http://www.instagram.com/p/HTTP1/", "HTTP1"],
    ["https://instagr.am/p/SHORT1/", "SHORT1"],
    ["instagram.com/p/NOSCHEME/", "NOSCHEME"],
    ["  https://www.instagram.com/p/TRIM1/  ", "TRIM1"],
    ["https://www.instagram.com/p/IMG1/?img_index=2#frag", "IMG1"],
    ["https://www.instagram.com/compte_exemple/p/USERPOST1/", "USERPOST1"],
    ["https://www.instagram.com/compte.exemple/reel/USERREEL1/?igsh=abc", "USERREEL1"],
    ["https://WWW.INSTAGRAM.COM/p/UPPERHOST/", "UPPERHOST"],
  ])("%s → post %s", (url, shortcode) => {
    const link = parseInstagramLink(url);
    expect(link?.kind).toBe("post");
    expect(link && link.kind === "post" ? link.shortcode : null).toBe(shortcode);
    expect(link?.url).toBe(`https://www.instagram.com/p/${shortcode}/`);
  });

  it.each([
    ["https://www.instagram.com/explore/locations/264617522/cheverny/", "264617522"],
    ["https://www.instagram.com/explore/locations/264617522/", "264617522"],
    ["https://instagram.com/explore/locations/264617522?igsh=x", "264617522"],
  ])("%s → location %s", (url, id) => {
    expect(parseInstagramLink(url)).toEqual({
      kind: "location",
      locationId: id,
      url: `https://www.instagram.com/explore/locations/${id}/`,
    });
  });
});

describe("parseInstagramLink — refused links (null)", () => {
  it.each([
    // positive control counterpart: stories and other hosts are refused
    "https://www.instagram.com/stories/compte_exemple/3400000000000000000/",
    "https://www.facebook.com/p/ABC/",
    "https://facebook.com/somepage",
    // profiles, highlights, hashtags, feeds carry no readable place
    "https://www.instagram.com/compte_exemple/",
    "https://www.instagram.com/stories/highlights/17900000000000000/",
    "https://www.instagram.com/explore/tags/mercantour/",
    "https://www.instagram.com/reels/",
    "https://www.instagram.com/p/",
    // malformed ids / codes
    "https://www.instagram.com/explore/locations/cheverny/",
    "https://www.instagram.com/p/AB%20C/",
    // look-alike hosts and foreign schemes
    "https://instagram.com.evil.example/p/ABC/",
    "https://notinstagram.com/p/ABC/",
    "https://m.facebook.com/instagram.com/p/ABC/",
    "ftp://www.instagram.com/p/ABC/",
    "javascript:alert(1)",
    "",
    "   ",
    "not a url",
  ])("%s → null", (url) => {
    expect(parseInstagramLink(url)).toBeNull();
  });
});
