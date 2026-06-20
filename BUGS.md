# BUGS.md — Terminal 3 SDK / docs friction log

Verified against the [official ADK docs](https://docs.terminal3.io/developers/adk/overview/what-is-adk). Only confirmed issues listed.
For detailed reproduction steps and full write-ups, see [BUGD-BY-D.md](./BUGD-BY-D.md).

---

## #1 — `agent_pubkey` format undocumented; no SDK pubkey helper

`buildDelegationCredential({ agent_pubkey })` expects a `Uint8Array` but the
required encoding (33-byte compressed secp256k1) is nowhere in the docs. The SDK
exports `eth_get_address` (20-byte address) but no public-key helper — we had to
derive it via ethers `new SigningKey(pk).compressedPublicKey` and reverse-engineer
the `AGENT_PUBKEY_LEN === 33` constant.

**Proof:** `buildDelegationCredential` and `agent_pubkey` return zero results
across the entire [docs index](https://docs.terminal3.io/llms.txt). The
[Delegate Access](https://docs.terminal3.io/t3n/data-owner-guide/delegate-access)
page only covers the GUI dashboard flow. The
[Invoke Contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract)
walkthrough uses `agentDid` (a DID string via `agent-auth-update`), which is a
different delegation model.

## #2 — No worked example for the delegate → invoke crypto flow

The SDK ships five delegation primitives (`buildDelegationCredential`,
`canonicaliseCredential`, `signCredential`, `buildInvocationPreimage`,
`signAgentInvocation`) but no end-to-end example tying "user signs credential →
agent signs invocation → contract submit". We assembled the flow from type defs
and captured it in `tools/step3-smoke.ts`.

**Proof:** None of the five functions appear in any page listed in the
[docs index](https://docs.terminal3.io/llms.txt). The
[walkthrough](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract)
covers `execute()` / `executeAndDecode()` but not the underlying crypto
primitives.

## #3 — `require("@terminal3/t3n-sdk")` fails — CJS entry broken

`package.json` declares `"type": "module"` **and** maps
`exports["."].require` → `./dist/index.js`. Node therefore treats that file as
ESM, but the file uses CJS `exports[…]` assignments — producing
`ReferenceError: exports is not defined` on `require()`. Since `npm init -y`
creates CJS projects by default, the standard Node onboarding path is broken
out of the box.

**Proof:** Inspected locally installed `@terminal3/t3n-sdk` (v3.5.2, same
structure in 3.9.0). `package.json` contains `"type": "module"` alongside
`"exports": { ".": { "require": "./dist/index.js" } }`. The tail of
`dist/index.js` confirms `exports[_0x2eb335(…)]=…` CJS-style assignments,
while `dist/index.esm.js` uses `export { … }` ESM syntax — confirming they
are meant to be separate module formats, but `"type": "module"` forces Node to
evaluate both as ESM.

## #4 — Numbered walkthrough skips mandatory KV map and secret setup

The official 4-step walkthrough (Write → Build → Register → Invoke) never
includes creating the `secrets` KV map or seeding the API key. The contract's
`book-offer` function reads `duffel_api_key` from `z:<tid>:secrets`, so
following the walkthrough literally yields a runtime error:
`duffel_api_key not found in z:<tid>:secrets`.

The required setup lives only in the Quick Tips sidebar pages
([Create Tenant KV Maps](https://docs.terminal3.io/developers/adk/tips/create-kv-maps),
[Seed API key](https://docs.terminal3.io/developers/adk/tips/seed-api-key)),
which are not referenced in the numbered flow.

**Proof:** The
[register-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract)
page mentions `secrets` and `contractId` only in the troubleshooting section at
the bottom and links to the tips pages — but does not include an actual
provisioning step. The
[invoke-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract)
page jumps straight to `executeAndDecode()`. Meanwhile, the
[write-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract)
page's Rust sample (`get_api_key()`) will error if the map is not pre-populated.

## #5 — `invoke-contract.md` uses undefined `userClient`

The egress-authorization snippet on the
[invoke-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract)
page calls `userClient.execute(...)`, but `userClient` is never imported,
constructed, or defined on this page or in any earlier walkthrough/setup page.
The
[dev-env setup](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env)
guide creates only `t3n` (`T3nClient`) and `tenant` (`TenantClient`). Section 2
of the same invoke page creates `agentClient` — still not `userClient`.
Additionally, `agentDid`, `TENANT_SCRIPT`, and `scriptVersion` are used without
any prior definition or import guidance.

**Proof:** Searched all four walkthrough pages (write, build, register, invoke)
and the dev-env setup page for `userClient` — zero definitions. The only
clients ever constructed are `t3n`, `tenant`, and `agentClient`. Copy-pasting
the egress-authorization snippet is a compile/runtime dead end.

## #6 — npm README contradicts official ADK onboarding docs

The `@terminal3/t3n-sdk` package README and the ADK
[setup guide](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env)
present incompatible first-client configurations:

| Topic | npm README | ADK setup guide |
|---|---|---|
| Install cmd | `pnpm add @terminal3/t3n-sdk` | `npm install @terminal3/t3n-sdk` |
| Key env var | `T3N_DEMO_KEY` | `T3N_API_KEY` |
| Node URL | `baseUrl: "https://t3n-node.example.com"` (hardcoded) | `setEnvironment("testnet")` (no baseUrl) |
| Token claim | not mentioned | ADK [claim page](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens) |

**Proof:** Compared `node_modules/@terminal3/t3n-sdk/README.md` (locally
installed v3.5.2) with the ADK setup guide. The README's Quick Start uses
`process.env.T3N_DEMO_KEY!` and passes a placeholder `baseUrl`, while the ADK
guide uses `process.env.T3N_API_KEY!` with `setEnvironment("testnet")` and no
`baseUrl`. A developer following the README will use the wrong env var and an
unroutable example URL.

## #7 — ESM `import` samples lack module-type guidance

The ADK
[setup guide](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env)
uses `import { T3nClient, … } from "@terminal3/t3n-sdk"` (ESM syntax) but
never explains that a default Node project (`npm init -y`) is CommonJS. Running
the sample verbatim in a fresh project produces
`SyntaxError: Cannot use import statement outside a module`. The page contains
no mention of `"type": "module"`, `.mts`, `.mjs`, or any ESM configuration step.

**Proof:** Searched the full
[set-up-dev-env](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env)
page for `"type"`, `module`, `esm`, `.mts`, `.mjs`, and `import statement` —
zero results. The code samples use `import { … }` and top-level `await`, both
of which require ESM mode, but no configuration guidance is provided.

## #8 — OpenAPI specifications in `llms.txt` return 404

The [llms.txt](https://docs.terminal3.io/llms.txt) documentation index
advertises two OpenAPI spec URLs that do not resolve:

| URL | Status |
|---|---|
| `https://docs.terminal3.io/terminal-3-openapi.yml` | **404** |
| `https://docs.terminal3.io/api-reference/openapi.json` | **404** |

**Proof:** Verified with `curl -s -o /dev/null -w "%{http_code}"` against both
endpoints — both return HTTP 404. The `llms.txt` file lists them under an
`## OpenAPI Specs` heading, implying they should be live specs for automated
client generation and API discovery.

## #9 — Placeholder outbound-call Rust sample is incompatible with the walkthrough

The Rust snippet on the
[placeholders-outbound-calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls)
tips page uses different bindings, types, and field names than the
[write-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract)
walkthrough for the same `http-with-placeholders` API:

| Aspect | Tips page | Walkthrough |
|---|---|---|
| Import | `crate::bindings::t3n::host::http_with_placeholders` | `crate::host::interfaces::http_with_placeholders as hwp` |
| HTTP method | `method: "POST".to_string()` (String) | `method: hwp::Verb::Post` (enum) |
| Body field | `body: Some(...)` | `payload: Some(...)` |
| Headers | `headers: vec![...]` (Vec) | `headers: Some(duffel_headers(...))` (Option) |

**Proof:** Compared the code blocks on both pages side-by-side. The tips page
snippet will not compile against the bindings generated by the walkthrough's
`wit_bindgen::generate!` macro — it produces unresolved-module, wrong-field,
and type-mismatch errors. These are fundamentally incompatible Rust type
signatures for the same host interface.

## #10 — Seed-key guide documents the wrong KV map read path

The [seed-api-key](https://docs.terminal3.io/developers/adk/tips/seed-api-key)
tips page states that the contract reads the key back with
`kv_store::get("secrets", "duffel_api_key")` (using the short map name
`"secrets"`). However, the
[write-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract)
walkthrough uses the tenant-qualified name:

```rust
let map_name = format!("z:{}:secrets", hex::encode(&tid));
let bytes = kv_store::get(&map_name, b"duffel_api_key");
```

The walkthrough's own design rules state: _"kv-store calls take the full
`z:<tid>:<map>` name. Build it at runtime from `tenant_context::tenant_did()`."_
The short `"secrets"` name in the tips page will not resolve at runtime.

**Proof:** The same tips page's *seeding* snippet correctly uses
`tenant.canonicalName("secrets")` (which produces `z:<tid>:secrets`), but then
documents the *read* path as the bare string `"secrets"` — contradicting both
itself and the walkthrough.

## #11 — Registration guide references nonexistent "steps 4 and 5"

The [register-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract)
page says: _"If you have not created one yet, complete step 4 and 5 of
[set up the dev environment](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env)
first."_ However, the setup page uses unnumbered section headings ("Get your API
key and DID", "Install Rust + WASM toolchain", "Install the SDK", "Set up the
SDK", "Authenticate to T3N testnet") — there are no explicit steps 4 or 5 to
follow.

**Proof:** The dev-env page's subtitle is "Quick 4 steps" (implying 4 sections,
not 5), but the body presents them as unnumbered headings. A developer reading
"complete step 4 and 5" has to guess that these probably mean "Set up the SDK"
and "Authenticate to T3N testnet" — but the numbering doesn't align (4 steps
total, not 5+).

## #12 — Onboarding does not document `tenant.tenant.claim()`

The ADK [overview](https://docs.terminal3.io/developers/adk/overview/what-is-adk)
lists `claim()` as a key capability, and the SDK type declarations expose it:

```typescript
declare class TenantNamespace {
  claim(): Promise<unknown>;
  me(): Promise<unknown>;
}
```

However, the
[dev-env setup](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env)
guide goes straight from `t3n.authenticate()` to constructing a `TenantClient`
without ever calling `await tenant.tenant.claim()`. The register-contract
troubleshooting section warns about `tenant not found` errors — the exact
symptom of skipping the admission step — but neither page explains how or when
to call `claim()`.

**Proof:** Searched the full dev-env setup page for `claim` — the only match is
a link to the "claim page" for API keys, not the `tenant.tenant.claim()` SDK
call. The SDK's `TenantClient` exposes `this.tenant = new TenantNamespace(this)`
with a `claim()` method, but no onboarding step invokes it. A developer who
follows the setup literally may hit `tenant not found` at registration time.

## #13 — `contracts.register()` return type is `unknown`; walkthrough accesses `.contract_id`

The SDK types `register()` (and `publish()`) as `Promise<unknown>`:

```typescript
publish(input: ContractPublishInput): Promise<unknown>;
register(input: ContractPublishInput): Promise<unknown>;
```

But the [register-contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract)
walkthrough does `const contractId = result.contract_id;` — which is a
TypeScript strict-mode error (`'result' is of type 'unknown'`). No response
interface is exported.

**Proof:** Inspected `node_modules/@terminal3/t3n-sdk/dist/index.d.ts`. Both
`publish` and `register` return `Promise<unknown>`. The type exports list
includes `ContractPublishInput` (the input) but no corresponding response type.
The walkthrough's `result.contract_id` access requires an unsafe `as any` cast
to compile.

## #14 — npm README OTP example calls browser-only `prompt()` in Node

The `@terminal3/t3n-sdk` README's OTP flow uses `prompt()` to collect the
verification code:

```typescript
const code = await prompt(`Code sent to ${requested.contact}: `);
await client.otpVerify({ otpCode: code, ... });
```

Node.js has no global `prompt` — verified locally:

```
$ node -e "console.log(typeof prompt)"
undefined
```

The example crashes with `ReferenceError: prompt is not defined` before
`otpVerify()` is ever called.

**Proof:** Tested on the current system's Node. The README does mention
`runOtpThenUserInput` with a `getOtpCode` callback as an alternative at the
bottom, but the primary copy-paste example uses `prompt()` which is
browser-only. A Node-compatible approach (`readline/promises` or an explicit
callback) should be the primary example in an SDK README that targets Node.

## #15 — Internal link to DID documentation returns 404

The [Smart VCs](https://docs.terminal3.io/intro/components/vc) intro page links
to `https://docs.terminal3.io/documentation/preliminaries/web-standards/dids`
for DID background. That URL returns HTTP 404.

**Proof:** `curl -s -o /dev/null -w "%{http_code}"` against the DID URL returns
`404`. The VC page itself (HTTP 200) contains the link text _"DIDs are used to
represent credential subjects"_ pointing to the broken path. No redirect or
alternative DID page exists at the legacy `/documentation/` prefix.

## #16 — "Developer key" naming hides the Ethereum private-key requirement

The [claim page](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens)
says _"Copy and store your developer key"_, and the setup guide stores it as
`T3N_API_KEY`. But the code immediately passes it to Ethereum cryptographic
functions:

```typescript
const address = eth_get_address(T3N_API_KEY);
handlers: { EthSign: metamask_sign(address, undefined, T3N_API_KEY) },
```

Neither the claim page nor the setup guide explains that this "key" is a
secp256k1 Ethereum private key (32-byte hex), not a rotatable API token. A
developer supplying an opaque token or non-hex string gets
`Invalid Ethereum private key` with no diagnostic context.

**Proof:** Searched the claim page and dev-env setup page for "private key",
"Ethereum", "secp256k1", "hex", and "0x" — zero results. The only descriptor
is "developer key" / "API key", which conventionally implies a revocable
service credential, not a cryptographic signing key requiring custody
precautions.

## #17 — `publish` and `register` terminology is inconsistent

The ADK [overview](https://docs.terminal3.io/developers/adk/overview/what-is-adk)
lists `publish` as the key capability for deploying contracts, while the
[walkthrough step 3](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract)
is titled "Register your TEE contract" and calls `tenant.contracts.register()`.
The SDK exports both methods with the identical input type and no explanation of
their relationship:

```typescript
publish(input: ContractPublishInput): Promise<unknown>;
register(input: ContractPublishInput): Promise<unknown>;
```

**Proof:** The overview's capability table shows `publish` (no mention of
`register`). The walkthrough exclusively uses `register`. The SDK type
declarations export both on `TenantContractsNamespace` with the same
`ContractPublishInput` signature. No docs page explains whether they are
aliases, sequential operations, or distinct actions.
