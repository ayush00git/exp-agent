# AGENTS.md — Agentic Corporate Procurement / Expense Agent

> Build target: **Terminal 3 ADK Bounty Challenge** (primary track — "Best Agent utilising Terminal 3 Agent Auth SDK").
> Scoring it's optimized for: **SDK Integration 40% · Completeness 30% · Creativity 30%.**
> One-line pitch: *An autonomous expense/procurement agent that pays vendors on a company's behalf without the LLM ever seeing the corporate card or employee PII — every action verified, scoped, and written to an immutable audit ledger.*

---

## 0. Ground rules for the coding agent (read first)

- **The SDK is the backbone, not a login wall.** Every outbound money/PII action MUST route through `@terminal3/t3n-sdk`. If you can remove the SDK and the app still "works," you've built it wrong.
- **The agent/LLM context must never contain raw sensitive values.** Card numbers, account numbers, employee PII = placeholders only (e.g. `{{corp.card}}`, `{{employee.email}}`). Real values are resolved inside the TEE at the last mile.
- **The exact SDK API surface is not fully known from memory.** Before writing SDK calls, fetch and read the live docs at `https://docs.terminal3.io` and inspect the installed package (`npm view @terminal3/t3n-sdk`, then read its README/types). Verify every method name against the real package. Do NOT invent API signatures — if unsure, stub behind an adapter (see Step 3) and leave a `// TODO: confirm against docs` marker.
- **README is graded.** Maintain a `README.md` section called "Where the SDK fires" that lists exact file paths + line numbers for each SDK operation (identity, policy, TEE resolution, ledger write). Update it as you build.
- **Keep scope tight:** one transaction type (pay a vendor invoice), two roles (Employee, Finance Admin). Do not add features that don't show off the SDK.

Stack: **Next.js (App Router) + TypeScript** frontend & API routes · Node runtime · `@terminal3/t3n-sdk` · Stripe test merchant (provided by T3 sandbox) · lightweight store (SQLite/Prisma or even JSON for the demo).

---

## STEP 1 — Project scaffold + onboarding

**Prompt:**
"Scaffold a Next.js 14+ App Router project in TypeScript with Tailwind. Create folders: `/app` (UI + API routes), `/lib/t3` (SDK adapter), `/lib/agent` (agent logic), `/lib/store` (policy + ledger persistence). Add `.env.local` with `T3N_API_KEY` and set the SDK to testnet. Install `@terminal3/t3n-sdk`. Add a `/health` API route that initializes the T3 client with `setEnvironment('testnet')` and returns whether the client + API key resolve correctly."

**Before coding:** claim the API key + DID + test tokens at `https://www.terminal3.io/claim-page`, then read the ADK quickstart in the docs.

**Acceptance:** `GET /health` returns 200 with the agent's DID confirmed. Log every onboarding friction point to `BUGS.md` (this doubles as your bug-track submission).

---

## STEP 2 — Domain model + seed data

**Prompt:**
"Define TypeScript types and seed data for: `Vendor` (id, name, payee reference as a PLACEHOLDER token, not a raw account), `Invoice` (id, vendorId, amount, currency, status), `SpendPolicy` (per-employee tier, per-transaction cap, per-vendor allowlist), and `AuditEntry` (id, agentDid, action, scopeProof, timestamp, result, txRef). Seed 3 vendors, 4 invoices (one over-cap, one off-allowlist to force edge cases), and 2 policies. Persist via Prisma+SQLite. NEVER store raw card/account numbers in this DB — those live only as references the TEE resolves."

**Acceptance:** seed runs; one invoice deliberately violates the cap and one violates the allowlist (these drive the edge-case demo).

---

## STEP 3 — T3 SDK adapter (the core 40%)

**Prompt:**
"In `/lib/t3/adk.ts`, build a thin typed adapter exposing exactly four functions, each wrapping a real `@terminal3/t3n-sdk` call (verify method names against the live docs first):
1. `verifyAgentIdentity(agentDid)` → confirms the agent's verifiable identity / DID.
2. `authorizeAction(agentDid, employeeId, intent)` → checks the scoped policy/data-token (tier, cap, allowlist); returns a signed authorization or a typed rejection.
3. `resolveAndExecuteInTEE(authorizedIntent)` → submits the payment intent with placeholders (`{{corp.card}}`, vendor payee ref) so the real values are substituted **inside the TEE** and the request reaches the Stripe test merchant. The raw values must never return to app/LLM context.
4. `writeAuditRow(entry)` → writes the immutable audit record to the T3 ledger and returns its reference.
Each function returns a structured `{ ok, proof, error }` result. Throw typed errors (`PolicyViolation`, `IdentityError`, `ResolutionError`) so the UI can fail gracefully."

**Acceptance:** each function calls a real SDK method (or is clearly marked `TODO: confirm` if the API differs), and emits a `step` event the dashboard can subscribe to. Record file + line of each SDK call in README "Where the SDK fires."

---

## STEP 4 — Agent core loop (placeholders only)

**Prompt:**
"In `/lib/agent/run.ts`, implement the agent loop that takes an employee intent ('pay invoice X for vendor Y') and orchestrates: parse intent → build a payment request using ONLY placeholder references → call the adapter in order: `verifyAgentIdentity` → `authorizeAction` → `resolveAndExecuteInTEE` → `writeAuditRow`. The LLM/reasoning step may decide WHICH invoice/vendor and validate the request shape, but must operate purely on placeholders and policy metadata — assert in code that no raw card/account string ever enters the agent's message context. Emit a structured event after each stage: `{ stage, status, proof, redactedPayload }`."

**Acceptance:** running the loop on a valid invoice produces a successful Stripe test payment + a ledger entry; running it on the over-cap and off-allowlist invoices halts at `authorizeAction` with a clean `PolicyViolation` and still writes a "denied" audit row.

---

## STEP 5 — API routes + event stream

**Prompt:**
"Expose API routes: `POST /api/intent` (kick off an agent run), `GET /api/ledger` (read audit entries), `GET /api/policies`. Stream the agent's per-stage events to the client via Server-Sent Events (`/api/stream`) so the dashboard can render the cryptographic trail in real time. Ensure responses are fully redacted — no raw sensitive value is ever serialized to the client."

**Acceptance:** hitting `/api/intent` streams stage events live; `/api/ledger` shows the immutable trail.

---

## STEP 6 — Dashboard (the 30% completeness shot)

**Prompt:**
"Build a clean two-pane dashboard. Left: Employee view — pick an invoice, submit 'Pay'. Right: a live **Verification Trail** that animates each stage as SSE events arrive — `Identity verified (DID) → Policy + token authorized → Resolved inside TEE → Paid (Stripe) → Recorded on ledger` — each with a green check, a short proof/hash snippet, and a timestamp. Add a Finance Admin tab showing the full immutable audit ledger as a table and a policy editor. Show denied transactions in red with the violated rule. Make it look enterprise-grade: muted palette, monospace for hashes, no clutter."

**Acceptance:** a non-technical viewer can watch one payment flow through all five cryptographic steps and immediately understand that the agent never touched the card. Denied cases render distinctly.

---

## STEP 7 — Edge cases + resilience

**Prompt:**
"Handle and visibly surface: policy cap exceeded, vendor not on allowlist, invalid/expired agent identity, TEE resolution failure, Stripe decline, duplicate intent (idempotency key). Each must fail gracefully in the UI with a clear reason and still produce an audit row. Add retry only where safe (never retry a resolved payment without idempotency)."

**Acceptance:** every edge case has a deterministic, demoable outcome. No uncaught errors, no spinner-of-death.

---

## STEP 8 — README + submission polish

**Prompt:**
"Write `README.md` with: the one-line pitch, an architecture diagram, a 60-second demo script, and the **'Where the SDK fires'** table mapping each of the four SDK operations to its file + line. Add a `DEMO.md` with exact click-by-click steps for judges. Record a < 3 min screen capture: submit an invoice, watch the trail, show the ledger, then trigger a denied transaction."

**Acceptance:** a judge can clone, `npm i`, add the test API key, `npm run dev`, and reproduce the demo in under 5 minutes.

---

## Parallel track — bug bounty (free extra prize)

Throughout Steps 1–3 you'll hit real friction (claim flow, key/DID mismatches, doc gaps, SDK type holes). Log each in `BUGS.md` with: severity · where · steps to reproduce · expected vs actual · screenshot. Email `devrel@terminal3.io` to confirm whether bugs go in the BUIDL or a separate form. This is low-effort, low-competition, and plays to a documentation-gap finding you already have (no single end-to-end quickstart from API key → first resolved placeholder).

---

## Scoring self-check before you submit

- [ ] Remove the SDK → app breaks. (SDK is load-bearing, not bolted on.)
- [ ] grep the agent's LLM context for any raw card/account string → zero hits.
- [ ] README "Where the SDK fires" points to real files + lines.
- [ ] Dashboard renders all 5 cryptographic steps live + denied cases.
- [ ] All 6 edge cases demoable.
- [ ] < 5 min clone-to-demo.
- [ ] `BUGS.md` filed for the second track.