/**
 * Typed errors + the shared result envelope for the T3 SDK adapter.
 *
 * Every adapter function returns an {@link AdkResult} on the happy path and
 * throws one of these typed errors on failure, so callers (the agent loop in
 * Step 5, the API in Step 6) can branch on the failure class.
 */

/** Base class for all adapter errors. */
export class AdkError extends Error {
  constructor(
    message: string,
    /** Machine-readable code, e.g. "IDENTITY_MISMATCH". */
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The agent's identity could not be confirmed (DID mismatch / unauthenticated). */
export class IdentityError extends AdkError {
  constructor(message: string, code = "IDENTITY_ERROR") {
    super(message, code);
  }
}

/** A placeholder could not be resolved inside the TEE. */
export class ResolutionError extends AdkError {
  constructor(message: string, code = "RESOLUTION_ERROR") {
    super(message, code);
  }
}

/** A payout (Stripe Connect transfer) failed. */
export class PayoutError extends AdkError {
  constructor(message: string, code = "PAYOUT_ERROR") {
    super(message, code);
  }
}

/** The agent is not authorised to act (no/expired/invalid delegation). */
export class AuthorizationError extends AdkError {
  constructor(message: string, code = "AUTHORIZATION_ERROR") {
    super(message, code);
  }
}

/**
 * Uniform return envelope. `proof` is a public, non-sensitive artifact
 * (a credential id, signature, or receipt hash) suitable for the audit ledger
 * and the dashboard — never raw account data.
 */
export interface AdkResult<T = unknown> {
  ok: boolean;
  proof?: string;
  error?: string;
  data?: T;
}
