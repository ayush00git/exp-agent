/**
 * Redaction guard enforcing the core invariant (AGENTS.md §0 / state machine):
 * no raw account / routing / card / IBAN value may appear in the agent's
 * message context, the audit ledger, or any serialized API response.
 *
 * This is a defensive last line — placeholders (vcId, exporter-ref:*) are used
 * by construction, but every payload that crosses a trust boundary (a `step`
 * event, an audit row, an HTTP response) is run through {@link assertNoRawAccountData}
 * so a regression surfaces loudly instead of leaking.
 */

// Heuristics for raw financial credentials. Deliberately conservative — the
// app's own placeholders (cuid ids, "exporter-ref:*", base64url vcIds, DIDs)
// must NOT match these.
const PATTERNS: { name: string; re: RegExp }[] = [
  // 13-19 digit card-like / long account numbers (allowing spaces or dashes).
  { name: "card/account number", re: /\b(?:\d[ -]?){13,19}\b/ },
  // ABA routing numbers: exactly 9 digits standing alone.
  { name: "routing number", re: /\b\d{9}\b/ },
  // IBAN: 2 letters, 2 digits, then 11-30 alphanumerics.
  { name: "IBAN", re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/ },
  // Stripe live/test secret keys.
  { name: "Stripe secret key", re: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}\b/ },
];

export class RawDataLeakError extends Error {
  constructor(readonly kind: string) {
    super(
      `Redaction guard: a value resembling a raw ${kind} was about to cross a trust boundary. ` +
        `Only opaque placeholders may leave the TEE.`,
    );
    this.name = "RawDataLeakError";
  }
}

/**
 * Throw if `value`, serialized, contains anything resembling raw account data.
 * Call before emitting an event, writing an audit row, or returning a response.
 */
export function assertNoRawAccountData(value: unknown): void {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      throw new RawDataLeakError(name);
    }
  }
}

/** Mask the middle of a reference for display, keeping a short head/tail. */
export function maskRef(ref: string): string {
  if (ref.length <= 8) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-4)}`;
}
