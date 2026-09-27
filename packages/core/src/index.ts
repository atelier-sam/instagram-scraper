/**
 * @atelier/instagram-scraper-core
 *
 * Public API barrel. Phase 0 bootstrap — only auth + types are wired up.
 * Parsers (profile / post / reel / story) land in subsequent phases.
 */

export type { AuthStrategy } from "./auth/strategy.ts";
export {
  CookieImportAuth,
  serializeCookies,
} from "./auth/cookieImport.ts";
export type { CookieImportAuthOptions } from "./auth/cookieImport.ts";
export { PersistentContextAuth } from "./auth/persistentContext.ts";
export type { PersistentContextAuthOptions } from "./auth/persistentContext.ts";

export {
  AuthError,
  CheckpointRequiredError,
  LoginRequiredError,
  RateLimitedError,
} from "./types/auth.ts";
export type { InstagramSessionCookies } from "./types/auth.ts";
export type { InstagramProfile } from "./types/profile.ts";
export type {
  InstagramLocation,
  InstagramPost,
  InstagramPostMedia,
  InstagramStoryItem,
} from "./types/post.ts";

export {
  extractApolloCache,
  extractApolloCacheAll,
} from "./parse/apolloCache.ts";
export type { ApolloExtractOptions } from "./parse/apolloCache.ts";

export { parseProfileFromHtml } from "./parse/profile.ts";
export { parseProfilePostsFromHtml } from "./parse/profilePosts.ts";
export type { ProfilePostRef } from "./parse/profilePosts.ts";
export {
  parsePostFromHtml,
  postFromWebInfoItem,
  extractHashtags,
  extractMentions,
} from "./parse/post.ts";
export {
  parseStoriesFromReelsResponse,
  parseStoriesByUser,
} from "./parse/stories.ts";
export { scrapeStoriesForUser } from "./scrape/stories.ts";
export { scrapeHighlightById } from "./scrape/highlight.ts";
export { scrapeHighlightsTray } from "./scrape/highlightsTray.ts";
export { parseHighlightsTray } from "./parse/highlightsTray.ts";
export type { HighlightAlbum } from "./parse/highlightsTray.ts";

export { parseHashtagFromHtml } from "./parse/hashtag.ts";
export type {
  HashtagPostSummary,
  InstagramHashtag,
} from "./parse/hashtag.ts";
export { parseLocationFromHtml, parseLocationFromJson } from "./parse/location.ts";
export type { InstagramLocationPage } from "./parse/location.ts";
export { scrapePostByShortcode } from "./scrape/post.ts";
export type { HtmlFetcher } from "./scrape/post.ts";
export { scrapeLocationById } from "./scrape/location.ts";
export type {
  LocationSurface,
  ScrapedLocation,
  ScrapeLocationOptions,
} from "./scrape/location.ts";

export { parseInstagramLink } from "./parse/link.ts";
export { readLinkPlace } from "./scrape/link.ts";
export type { ReadLinkPlaceOptions } from "./scrape/link.ts";
export { InstagramLinkError } from "./types/link.ts";
export type {
  InstagramLink,
  InstagramLinkErrorCode,
  LinkPlace,
  LinkPlaceCoordinatesSource,
  LinkPlaceLocation,
  LinkPlacePrecision,
} from "./types/link.ts";

export {
  downloadMediaToFile,
  downloadMediaSlots,
} from "./download/media.ts";
export type { DownloadResult } from "./download/media.ts";

export { HttpClient } from "./http/client.ts";
export type {
  CapturedResponse,
  HttpClientOptions,
} from "./http/client.ts";
