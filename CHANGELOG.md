# Changelog

All notable changes to `instagram-scraper`. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are shared
across the monorepo packages.

## Unreleased

### Fixed
- Location page: Instagram renamed its payload to `xdt_location_get_web_info`
  (`native_location_data.location_info`: `location_id`, `name`, `lat`,
  `lng`, `slug`, `location_address`, `location_city`…), next to the post
  grid in `xdt_location_get_web_info_tab.edges[].node`. The 2026-05 field
  `xdt_api__v1__locations__web_info` is still read as a fallback. Measured
  2026-09-27 with a logged-in session; `location <id>` works again.
- A post's place keeps its coordinates: `mapLocation` keeps `lat` / `lng`
  (both or neither, WGS84-checked, `(0, 0)` refused) and `address` /
  `city` when present. `InstagramLocation` gains these optional fields.

### Added
- `scrapeLocationById(http, id)` — location page first, the JSON surface
  `?__a=1&__d=dis` (instaloader's) in fallback only (on 2026-09-27 it
  answered a browser navigation with the HTML app shell, no payload).
  Resolves null when unreadable; throws the typed stop errors (checkpoint,
  login page, rate limit) and never falls back after one. CLI `location`
  goes through it.
- `scrapePostByShortcode(http, shortcode)`; CLI `post` goes through it.
- `RateLimitedError` (extends `AuthError`) for HTTP 429 and throttling
  envelopes.
- CLI global options `--min-delay <ms>` (pause between two requests) and
  `--verbose` (one stderr line per request and per miss: URLs and payload
  field names, never cookies or bodies).

## 0.3.0 — 2026-05-17

### Added
- CLI `highlights <username>` gains filter flags:
  - `--album <titles>` — only albums whose title contains one of these
    (comma-separated, case-insensitive substring match).
  - `--since <date>` / `--until <date>` — keep only items posted within
    the date window (a bare `YYYY-MM-DD` for `--until` covers the day).
- A privacy-oriented `pre-push` git hook (`.githooks/pre-push`) — blocks
  pushes that introduce secrets or denylisted identifiers; `--scan-all`
  audits the whole tree before publishing. Denylist stays local, never
  committed (see `.githooks/denylist.sample`).

## 0.2.0 — 2026-05-17

### Added
- **Highlights-tray discovery** — `scrapeHighlightsTray(http, username)`
  lists every permanent Highlights album of a profile. The tray is not
  in the profile SSR; it loads via the
  `PolarisProfileStoryHighlightsTrayContentQuery` GraphQL XHR, which the
  scraper intercepts.
- CLI `highlights <username>` — discovers and scrapes all of a profile's
  highlight albums in a single pass.
- `HttpClient.captureXhr` accepts an optional `requestPattern` that
  matches the request body — required to disambiguate the shared
  `/graphql/query` endpoint by GraphQL friendly name.

### Fixed
- `scrapeHighlightById` returned nothing: Instagram renamed the album
  SSR field to `xdt_api__v1__feed__reels_media__connection` (a GraphQL
  connection). The stories parser now reads both the connection
  (`edges[].node`) shape and the legacy field.
- `captureXhr` navigates with `domcontentloaded` instead of
  `networkidle`, which never settles on Instagram and caused spurious
  navigation timeouts.

## 0.1.0

Initial monorepo: Playwright auth (persistent context + cookie import),
HTTP client with jitter and checkpoint detection, Apollo-cache extractor,
parsers (profile / post / reel / stories / highlight / hashtag /
location), media downloader with atomic writes, the `instagram-scraper`
CLI, and the FilesystemAdapter storage tree.
