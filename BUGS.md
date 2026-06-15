# BUGS.md — Terminal 3 SDK / docs friction log

Parallel bug-bounty track. Every claim-flow / SDK / docs friction encountered
while building gets logged here (severity, repro, expected vs actual).

> TODO: email `devrel@terminal3.io` to confirm where bug submissions should go.

---

## #1 — Spec says "API key", SDK has no API-key concept

- **Severity:** Low (docs / onboarding friction)
- **Where:** Onboarding, `@terminal3/t3n-sdk@3.5.2`
- **Repro:** Following an "agent" mental model, you look for `T3N_API_KEY` to
  authenticate the client. There is no such parameter.
- **Expected:** A documented API-key or token to identify the agent.
- **Actual:** The agent authenticates with an **Ethereum private key** (or OIDC).
  The DID is *derived* from the key via `eth_get_address` →
  `createEthAuthInput` → `client.authenticate`. There is no API key.
- **Resolution in this repo:** env var is `T3N_AGENT_PRIVATE_KEY`; the secret
  never leaves the server and only the public DID/address is exposed.

## #2 — No single end-to-end quickstart (API key -> first resolved DID)

- **Severity:** Medium (docs gap, known)
- **Where:** `https://docs.terminal3.io` + package README
- **Repro:** As a newcomer, there is no one page that walks from
  "I have credentials" to "I authenticated and resolved my first DID".
- **Expected:** A copy-paste quickstart that ends in a printed DID.
- **Actual:** You assemble it from the README snippets:
  `setEnvironment` → `loadWasmComponent` → `eth_get_address` →
  `new T3nClient({ handlers: { EthSign: metamask_sign(...) } })` →
  `handshake()` → `authenticate(createEthAuthInput(address))` → `getDid()`.
  Verified working against `testnet` (node `cn-api.sg.testnet.t3n.terminal3.io`).

## #3 — `handshake()` returns `did: null` / `authenticated: false`

- **Severity:** Low (mild surprise, not a blocker)
- **Where:** `T3nClient.handshake()` return value
- **Repro:** `const hr = await client.handshake()` →
  `{ sessionId, expiry: 0, authenticated: false, did: null }`.
- **Expected (naively):** handshake yields the identity.
- **Actual:** Identity only appears after the separate `authenticate()` call.
  This is correct (handshake = encrypted session; authenticate = identity), but
  the `did?: Did` field on `HandshakeResult` invites the wrong assumption.
