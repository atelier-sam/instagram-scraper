/**
 * Instagram session cookies. Only `sessionid` is strictly required for
 * authenticated requests; `csrftoken` is required for POSTs (likes,
 * comments, follows — out of scope for a read-only scraper). `ds_user_id`
 * is the numeric user id of the logged-in account, useful for sanity
 * checks against the URL the session resolves to.
 */
export type InstagramSessionCookies = {
  sessionid: string;
  csrftoken?: string;
  ds_user_id?: string;
  ig_did?: string;
  mid?: string;
};

export class AuthError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AuthError";
    if (cause !== undefined) this.cause = cause;
  }
}

export class LoginRequiredError extends AuthError {
  constructor(message = "Instagram redirected to login — session is invalid or expired") {
    super(message);
    this.name = "LoginRequiredError";
  }
}

export class CheckpointRequiredError extends AuthError {
  constructor(
    message = "Instagram requires a checkpoint (suspicious-activity verification) — manual login needed",
  ) {
    super(message);
    this.name = "CheckpointRequiredError";
  }
}

/**
 * Instagram is throttling the session (HTTP 429, "Please wait a few
 * minutes", `feedback_required`).
 *
 * Extends {@link AuthError} on purpose: a caller that stops everything on
 * an auth failure must stop on throttling too — retrying or falling back to
 * another surface is exactly what turns a rate limit into a checkpoint.
 */
export class RateLimitedError extends AuthError {
  constructor(message = "Instagram is rate-limiting this session — stop and retry much later") {
    super(message);
    this.name = "RateLimitedError";
  }
}
