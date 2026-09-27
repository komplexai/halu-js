import type { DetectResult } from "./types";

/** Base class for all halu errors (transport / timeout / unexpected). */
export class HaluError extends Error {
  readonly requestId?: string;
  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "HaluError";
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Missing or invalid API key (HTTP 401). */
export class HaluAuthError extends HaluError {
  constructor(message: string, requestId?: string) {
    super(message, requestId);
    this.name = "HaluAuthError";
  }
}

/** Quota exceeded (HTTP 402). */
export class HaluQuotaError extends HaluError {
  readonly quotaPeriod?: string;
  readonly upgradeUrl?: string;
  constructor(message: string, requestId?: string, quotaPeriod?: string, upgradeUrl?: string) {
    super(message, requestId);
    this.name = "HaluQuotaError";
    this.quotaPeriod = quotaPeriod;
    this.upgradeUrl = upgradeUrl;
  }
}

/** Rate limited (HTTP 429). */
export class HaluRateLimitError extends HaluError {
  readonly retryAfter?: number;
  constructor(message: string, requestId?: string, retryAfter?: number) {
    super(message, requestId);
    this.name = "HaluRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Malformed request — empty response, bad task, input too long (HTTP 400). */
export class HaluInputError extends HaluError {
  readonly errorCode?: string;
  constructor(message: string, requestId?: string, errorCode?: string) {
    super(message, requestId);
    this.name = "HaluInputError";
    this.errorCode = errorCode;
  }
}

/** Upstream / handler failure (HTTP 5xx) or malformed response body. */
export class HaluServerError extends HaluError {
  readonly statusCode?: number;
  readonly upstreamMessage?: string;
  constructor(message: string, requestId?: string, statusCode?: number, upstreamMessage?: string) {
    super(message, requestId);
    this.name = "HaluServerError";
    this.statusCode = statusCode;
    this.upstreamMessage = upstreamMessage;
  }
}

/** Thrown by `detectOrThrow` when a response is flagged. Carries the full result. */
export class HaluHallucinationFlagged extends HaluError {
  readonly result: DetectResult;
  constructor(message: string, result: DetectResult) {
    super(message, result.requestId);
    this.name = "HaluHallucinationFlagged";
    this.result = result;
  }
}
