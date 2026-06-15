import { NextResponse } from "next/server";
import { resolveAgentIdentity } from "@/lib/t3/client";

// The T3 SDK loads a WASM component and opens a network session — must run on
// the Node.js runtime, never the Edge runtime. Always evaluate fresh.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /health — inits the Terminal 3 client and confirms the agent DID resolves.
 * Accept criteria (AGENTS.md Step 1): returns 200 + DID.
 */
export async function GET() {
  try {
    const identity = await resolveAgentIdentity();
    return NextResponse.json(
      {
        status: "ok",
        did: identity.did,
        address: identity.address,
        environment: identity.environment,
        node: identity.node,
        ts: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { status: "error", error: message, ts: new Date().toISOString() },
      { status: 500 },
    );
  }
}
