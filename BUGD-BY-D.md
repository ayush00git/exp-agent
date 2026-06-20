# Terminal 3 ADK Bug Bounty — Consolidated Submission Pack

**Track:** Most bugs during onboarding + documentation gaps  
**SDK version tested:** `@terminal3/t3n-sdk@3.9.0`  
**Audit date:** 2026-06-19

This document consolidates the unique, reproducible SDK and onboarding issues in the `reports/` directory. Submit each numbered section as a separate report; each has its own reproduction and required code/documentation change.

## Submission order

| # | Issue | Severity |
|---|---|---|
| 01 | CJS `require` entry is broken | Critical |
| 02 | Walkthrough omits KV maps and secret provisioning | Critical |
| 03 | Invoke walkthrough uses undefined `userClient` | Critical |
| 04 | npm README contradicts ADK onboarding | High |
| 05 | ESM imports lack module configuration guidance | High |
| 06 | OpenAPI specs in `llms.txt` return 404 | High |
| 07 | Placeholder Rust sample mismatches walkthrough bindings | High |
| 08 | Seed-key guide specifies the wrong KV map path | High |
| 09 | Node requirement differs between docs and package | Medium |
| 10 | Registration guide refers to nonexistent setup steps | Medium |
| 11 | Write-contract guide names a sample repo but provides no URL | Medium |
| 12 | Onboarding omits tenant claim | Medium |
| 13 | `contracts.register()` has an undocumented `unknown` return type | Medium |
| 18 | npm README OTP example calls browser-only `prompt()` in Node | Medium |
| 14 | DID documentation link is broken | Medium |
| 15 | “Developer key” obscures required Ethereum private-key format | Medium |
| 16 | `publish` and `register` terminology is inconsistent | Low |
| 17 | Telegram support channel is not linked | Low |

---

## Bug #01: `require("@terminal3/t3n-sdk")` fails — CJS entry broken

**Severity:** Critical  
**Category:** Onboarding bug (SDK)  
**Component:** `@terminal3/t3n-sdk@3.9.0`

The package advertises a CommonJS `require` entry in `exports`, but requiring it throws `exports is not defined`. This breaks the default Node onboarding path, since `npm init -y` creates a CommonJS project.

### Reproduction

```bash
mkdir t3-cjs-test && cd t3-cjs-test
npm init -y
npm install @terminal3/t3n-sdk
node -e "require('@terminal3/t3n-sdk')"
```

**Actual:** `Error: exports is not defined`.

**Expected:** `require()` resolves and returns SDK exports, as documented by `package.json` `exports.require`.

### Root cause

`package.json` sets `"type": "module"`, so Node treats `dist/index.js` as ESM. That file uses CommonJS `exports.*` assignments. In ESM scope, `exports` is undefined.

Verified locally:

- `package.json` has `"type": "module"` and maps `exports.".".require` to `./dist/index.js`.
- `dist/index.js` contains `exports[...]` assignments.
- `require("@terminal3/t3n-sdk")` fails as above.

### Suggested fix

Ship a true dual package: use an `.cjs` build for `exports.require` and an `.mjs`/proper ESM build for `import`, or remove the incompatible module declaration.

### Impact

Developers using CommonJS or following ordinary Node setup cannot import the SDK.

---

## Bug #02: Numbered walkthrough skips mandatory KV map and secret setup

**Severity:** Critical  
**Category:** Onboarding / documentation gap

The official path is Write → Build → Register → Invoke, but the contract cannot run until the tenant creates the `secrets` KV map and seeds an API key. Those requirements are only on separate tips pages.

### Reproduction

1. Follow the walkthrough in order: [Write contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract.md), [Build contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/build-contract.md), [Register contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract.md), then [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract.md).
2. Registration explicitly says it does not create maps or seed secrets.
3. Required setup appears separately in [Create Tenant KV Maps](https://docs.terminal3.io/developers/adk/tips/create-kv-maps.md) and [Seed API key](https://docs.terminal3.io/developers/adk/tips/seed-api-key.md).
4. The invoked `book-offer` contract reads `duffel_api_key` from the secrets map.

**Actual:** Runtime error: `duffel_api_key not found in z::secrets — populate it via the tenant SDK`.

**Expected:** The numbered walkthrough includes KV-map creation and secret seeding before invocation.

### Suggested fix

Add a provisioning page between Register and Invoke, and link it from both steps.

### Impact

The literal happy path cannot complete.

---

## Bug #03: `invoke-contract.md` uses undefined `userClient`

**Severity:** Critical  
**Category:** Documentation gap  
**Doc:** [Invoke contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract.md)

The egress-authorization example calls `userClient.execute(...)`, but the client is never imported, constructed, or defined in this page or earlier onboarding material.

### Reproduction

The development-environment guide creates `t3n` (`T3nClient`) and `tenant` (`TenantClient`), but no `userClient`. Then copy the invoke snippet:

```typescript
const userContractVersion = await getScriptVersion(getNodeUrl(), "tee:user/contracts");
await userClient.execute({
  script_name: "tee:user/contracts",
  script_version: userContractVersion,
  function_name: "agent-auth-update",
  input: { /* ... */ },
});
```

**Actual:** Copy-pasted code is a compile/runtime dead end.

**Expected:** The guide explains how to authenticate the data owner and construct the appropriate user client, including the source of `agentDid`, `TENANT_SCRIPT`, and `scriptVersion`.

### Suggested fix

Add a complete user-session-client prerequisite or a direct link to a working auth example.

### Impact

Developers cannot complete the required authorization for the sample contract’s outbound HTTP call.

---

## Bug #04: npm README contradicts official ADK onboarding docs

**Severity:** High  
**Category:** Onboarding / documentation gap

The package README and ADK quickstart present incompatible first-client configuration.

| Topic | npm README | ADK setup guide |
|---|---|---|
| Installation | `pnpm add @terminal3/t3n-sdk` | `npm install @terminal3/t3n-sdk` |
| Key environment variable | `T3N_DEMO_KEY` | `T3N_API_KEY` |
| Node URL | `https://t3n-node.example.com` | `setEnvironment("testnet")` |
| Token claim | terminal3.io claim page | ADK Request Test Tokens flow |

### Reproduction

```bash
npm install @terminal3/t3n-sdk
```

Compare `node_modules/@terminal3/t3n-sdk/README.md` with [Set up the SDK](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env.md).

**Actual:** Two incompatible quickstarts.

**Expected:** One canonical setup that uses the current API key variable and environment resolution.

### Suggested fix

Update the package README to match ADK docs, or make it link exclusively to the canonical quickstart.

### Impact

First-touch npm users use a wrong variable and unroutable example URL.

---

## Bug #05: ESM `import` samples lack module-type guidance

**Severity:** High  
**Category:** Onboarding / documentation gap

ADK setup samples use ESM imports but do not explain that a default Node project must be configured for ESM.

### Reproduction

```bash
mkdir t3-new-dev && cd t3-new-dev
npm init -y
npm install @terminal3/t3n-sdk
```

Create `index.js`:

```javascript
import { T3nClient, setEnvironment, loadWasmComponent } from "@terminal3/t3n-sdk";
```

Run `node index.js`.

**Actual:** `SyntaxError: Cannot use import statement outside a module`.

**Expected:** The guide explains how to use `"type": "module"`, `.mts`/`tsx`, or dynamic `import()` for CommonJS projects.

### Suggested fix

Add an ESM configuration step and a copy-paste project template.

### Impact

The first code paste fails for default Node projects.

---

## Bug #06: OpenAPI specifications in `llms.txt` return 404

**Severity:** High  
**Category:** Documentation gap

`llms.txt` advertises two OpenAPI specifications that do not exist.

### Reproduction

```bash
curl -I https://docs.terminal3.io/terminal-3-openapi.yml
curl -I https://docs.terminal3.io/api-reference/openapi.json
```

**Actual:** Both endpoints return HTTP 404.

**Expected:** Live OpenAPI files, or no links in the documentation index.

### Suggested fix

Publish the specs or correct/remove the paths in `llms.txt`/Mintlify configuration.

### Impact

Blocks automated client generation and API discovery tooling.

---

## Bug #07: Placeholder outbound-call Rust sample is incompatible with the walkthrough

**Severity:** High  
**Category:** Documentation gap

The Rust snippets in [Placeholders outbound calls](https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls.md) and the [write-contract walkthrough](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract.md) use incompatible bindings for the same API.

| Aspect | Tips page | Walkthrough |
|---|---|---|
| Import | `crate::bindings::t3n::host::http_with_placeholders` | `crate::host::interfaces::http_with_placeholders as hwp` |
| Method | `"POST".to_string()` | `hwp::Verb::Post` |
| Body field | `body` | `payload` |

### Reproduction

Build the walkthrough’s flight sample, replace its HTTP call with the tips-page snippet, and run:

```bash
cargo build --target wasm32-wasip2 --release
```

**Actual:** Unresolved `bindings` module, unknown `body` field, and HTTP-method type errors.

**Expected:** The snippets compile together against the same generated bindings.

### Suggested fix

Use the walkthrough’s `hwp::Request`, `Verb`, and `payload` pattern in the tips page, or clearly identify a distinct binding generator.

### Impact

Developers cannot add the core PII-placeholder feature to the official sample.

---

## Bug #08: Seed-key guide documents the wrong KV map name

**Severity:** High  
**Category:** Documentation gap

The seed-key tip says contracts use `kv_store::get("secrets", ...)`, while the walkthrough uses the canonical tenant-qualified map name.

### Reproduction

The [seed API key](https://docs.terminal3.io/developers/adk/tips/seed-api-key.md) guide says:

```rust
kv_store::get("secrets", "duffel_api_key")
```

The [write-contract walkthrough](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract.md) uses:

```rust
let map_name = format!("z:{}:secrets", hex::encode(&tid));
let bytes = kv_store::get(&map_name, b"duffel_api_key");
```

Implement the short-map version in a tenant contract.

**Actual:** The key is not found at runtime.

**Expected:** The seed-key guide states the same tenant-qualified map construction.

### Suggested fix

Document `tenant_context::tenant_did()` and `format!("z:{}:secrets", hex::encode(&tid))`.

### Impact

Correctly seeded secrets appear absent at runtime.

---

## Bug #09: Node.js requirement differs between docs and package (unconfirmed)

**Severity:** Medium  
**Category:** Documentation gap

ADK docs require Node `>=18`, while package metadata declares `>=16.0.0`.

### Reproduction

Read the setup guide’s Node requirement, then inspect:

```bash
npm install @terminal3/t3n-sdk
node -p "require('./node_modules/@terminal3/t3n-sdk/package.json').engines"
```

**Actual:** Docs state `>=18`; `engines.node` states `>=16.0.0`.

**Expected:** A single, tested minimum version.

### Suggested fix

Raise package metadata to `>=18` or revise the docs after validating Node 16–17.

### Impact

Teams receive inconsistent compatibility guidance.

---

## Bug #10: Registration guide references nonexistent setup “steps 4 and 5”

**Severity:** Medium  
**Category:** Documentation gap

The register guide tells readers to complete “step 4 and 5” of development setup, but the referenced guide has unnumbered headings.

### Reproduction

Open [register contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract.md), then [set up dev environment](https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env.md).

**Actual:** No explicit steps 4 or 5 are available to follow.

**Expected:** Linked named prerequisites such as “Set up the SDK” and “Authenticate to T3N testnet.”

### Suggested fix

Replace the numeric reference with anchored links.

### Impact

Registration prerequisites are ambiguous.

---

## Bug #11: Write-contract guide references a sample repo without a URL (unconfirmed)

**Severity:** Medium  
**Category:** Onboarding / documentation gap

The write-contract page suggests following a “sample flight booking project” but gives no repository URL, clone command, or package location.

### Reproduction

Read [Write contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract.md) and search the page/ADK index for a GitHub link or clone command.

**Actual:** No sample repository is linked.

**Expected:** A direct project URL and quick-start command.

### Suggested fix

Add a sample-repository callout that matches the documented project layout.

### Impact

Developers must reconstruct project structure from fragments.

---

## Bug #12: Onboarding does not document `tenant.tenant.claim()`

**Severity:** Medium  
**Category:** Onboarding / documentation gap

The ADK overview identifies `claim()` as tenant onboarding, but the setup guide constructs a `TenantClient` without calling or explaining this required admission step.

### Reproduction

The overview’s capability table documents `client.tenant.claim()`. The SDK declares:

```typescript
declare class TenantNamespace {
  claim(): Promise<unknown>;
  me(): Promise<unknown>;
}
```

Follow setup, then proceed to `tenant.contracts.register(...)` without claiming.

**Actual:** Registration troubleshooting identifies `tenant not found` when admission is incomplete.

**Expected:** Setup calls `await tenant.tenant.claim()` and verifies with `me()`, or explicitly explains automatic admission.

### Suggested fix

Add a post-authentication tenant-admission step.

### Impact

First registration can fail after apparently successful setup.

---

## Bug #13: `contracts.register()` return shape is undocumented and typed as `unknown`

**Severity:** Medium  
**Category:** SDK / documentation gap

The registration walkthrough accesses `result.contract_id`, but the SDK types `register()` as `Promise<unknown>` and exports no response interface.

### Reproduction

```typescript
const result = await tenant.contracts.register({ tail, version, wasm });
const contractId = result.contract_id;
```

In a strict TypeScript project, this produces: `'result' is of type 'unknown'`.

**Expected:** A typed exported response, for example `{ contract_id: number; ... }`.

### Suggested fix

Add typed return interfaces for `register()`/`publish()` and document the wire shape.

### Impact

The official TypeScript example does not type-check without an unsafe cast.

---

## Bug #14: Internal link to DID documentation returns 404

**Severity:** Medium  
**Category:** Documentation gap

The Smart VCs intro links to a nonexistent DID page.

### Reproduction

```bash
curl -I https://docs.terminal3.io/documentation/preliminaries/web-standards/dids
```

The link originates from [Smart VCs intro](https://docs.terminal3.io/intro/components/vc.md).

**Actual:** HTTP 404.

**Expected:** A valid DID-documentation page or redirect.

### Suggested fix

Update `vc.md` to the current DID documentation path.

### Impact

Breaks navigation for developers learning the DID/VC model.

---

## Bug #15: “Developer key” naming hides the Ethereum private-key requirement

**Severity:** Medium  
**Category:** Onboarding / documentation gap

The token claim flow calls the credential a “developer key,” while SDK setup passes it to Ethereum-address and signing functions that require a secp256k1 private key.

### Reproduction

The setup snippet uses:

```typescript
const T3N_API_KEY = process.env.T3N_API_KEY!;
const address = eth_get_address(T3N_API_KEY);
handlers: { EthSign: metamask_sign(address, undefined, T3N_API_KEY) },
```

Supply an opaque API token rather than a `0x`-prefixed 32-byte private key.

**Actual:** `Invalid Ethereum private key`.

**Expected:** Claim and setup docs consistently identify the credential as an Ethereum wallet private key, state its format, and provide security guidance.

### Suggested fix

Rename it to “Ethereum private key (hex)” and distinguish it from rotatable API tokens.

### Impact

Developers may both misconfigure authentication and mishandle a high-value private key.

---

## Bug #16: `publish` and `register` terminology is inconsistent

**Severity:** Low  
**Category:** Documentation gap

The ADK overview tells developers to `publish` contracts, while the walkthrough uses `register`. Both SDK methods exist but their equivalence is not explained.

### Reproduction

Compare [What is ADK?](https://docs.terminal3.io/developers/adk/overview/what-is-adk.md) with [Register contract](https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract.md). SDK declarations include both:

```typescript
publish(input: ContractPublishInput): Promise<unknown>;
register(input: ContractPublishInput): Promise<unknown>;
```

**Actual:** Two unexplained primary verbs for the same operation.

**Expected:** One canonical term and an alias note in reference documentation.

### Suggested fix

Use `register` throughout, or state that `register` is an alias of `publish`.

### Impact

Causes search and navigation confusion.

---

## Bug #17: Telegram support channel is plain text, not a link (unconfirmed)

**Severity:** Low  
**Category:** Documentation gap

The [Dev Community Support](https://docs.terminal3.io/developers/adk/support/t3-builder-tg.md) page mentions `terminal3developer` as plain text instead of linking to the Telegram channel.

### Reproduction

Open the support page and compare it with the linked channel in `llms.txt`: [Developer TG](https://t.me/terminal3developer).

**Actual:** The support-page channel name is not clickable.

**Expected:** A direct Markdown link, such as:

```markdown
Join [Terminal 3 Developer Telegram](https://t.me/terminal3developer)
```

### Suggested fix

Replace the bare channel name with the working Telegram link.

### Impact

Adds friction when users seek onboarding support.

---

## Bug #18: npm README OTP example crashes in Node because `prompt()` is undefined

**Severity:** Medium  
**Category:** Onboarding / documentation gap  
**Component:** `@terminal3/t3n-sdk@3.9.0` README

The Node SDK README's OTP flow uses the browser-only global `prompt()` to obtain the OTP. Node scripts have no global `prompt`, so the supplied example fails before calling `otpVerify()`.

### Reproduction

```bash
mkdir t3-otp-readme-test && cd t3-otp-readme-test
npm init -y
npm install @terminal3/t3n-sdk@3.9.0
node -e "console.log(process.version, typeof prompt)"
```

**Actual output (Node v22.16.0):**

```text
v22.16.0 undefined
```

The README code is:

```typescript
const code = await prompt(`Code sent to ${requested.contact}: `);
await client.otpVerify({ otpCode: code, /* ... */ });
```

Executing the line in Node returns `ReferenceError: prompt is not defined`.

**Expected:** A Node-compatible code-collection path, such as `readline/promises`, an application callback, or a full `runOtpThenUserInput({ getOtpCode })` example.

### Suggested fix

Replace `prompt()` with Node `readline/promises`, or use an app-supplied `getOtpCode` callback and clearly identify `window.prompt` as browser-only.

### Impact

The documented OTP-backed user flow fails immediately in the package's supported Node environment.

---

## Local verification

```bash
cd t3-audit
npm install
node verify-cjs-bug.mjs
node audit-links.mjs
node audit-imports.mjs
```

## Duplicate caution

Avoid submitting issues already reported publicly, including the package rename, generic 404 lists, or `authenticate()` DID type, unless their current testnet status is independently confirmed.
