/**
 * Terminal 3 Agent Auth SDK adapter — client bootstrap.
 *
 * SERVER-ONLY. The agent's secret (an Ethereum private key that derives its
 * DID) is read here from the environment and MUST never reach the browser,
 * the LLM context, app logs, or the DB. This module only ever exposes the
 * derived public DID + address.
 *
 * NOTE on the spec/SDK mismatch: AGENTS.md Step 1 says "load T3N_API_KEY".
 * The real @terminal3/t3n-sdk has no API-key concept — agents authenticate
 * with an Ethereum private key (or OIDC) via handshake() -> authenticate().
 * We therefore use T3N_AGENT_PRIVATE_KEY. See BUGS.md (#1).
 *
 * The richer four-function adapter (mint authorization, verify identity,
 * resolve+payout in TEE, write audit row) lands in Step 3 — see /lib/t3/adk.ts.
 */
import {
  setEnvironment,
  getEnvironmentName,
  getNodeUrl,
  loadWasmComponent,
  T3nClient,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  type WasmComponent,
} from "@terminal3/t3n-sdk";

const ENVIRONMENT = "testnet" as const;

export interface AgentIdentity {
  /** The agent's resolved Terminal 3 DID, e.g. did:t3n:<40-hex>. */
  did: string;
  /** The Ethereum address that derives the DID (public, safe to expose). */
  address: string;
  /** The active T3 network. */
  environment: string;
  /** The T3 node the client is pinned to. */
  node: string;
}

/**
 * Loading the WASM component is comparatively expensive, so cache it across
 * requests. The authenticated *session* is short-lived and is re-established
 * on each call (a fresh handshake + authenticate), which is fine for /health.
 */
let wasmPromise: Promise<WasmComponent> | null = null;

function getWasm(): Promise<WasmComponent> {
  if (!wasmPromise) {
    setEnvironment(ENVIRONMENT);
    wasmPromise = loadWasmComponent();
  }
  return wasmPromise;
}

function readPrivateKey(): string {
  const key = process.env.T3N_AGENT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "T3N_AGENT_PRIVATE_KEY is not set. Add it to .env.local (server-side only).",
    );
  }
  return key;
}

/**
 * Init the Terminal 3 client, perform the SDK handshake, authenticate the
 * agent, and resolve its DID. Returns ONLY public identity fields.
 */
export async function resolveAgentIdentity(): Promise<AgentIdentity> {
  setEnvironment(ENVIRONMENT);

  const privateKey = readPrivateKey();
  const address = eth_get_address(privateKey);
  const wasmComponent = await getWasm();

  const client = new T3nClient({
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, privateKey),
    },
  });

  await client.handshake();
  const did = await client.authenticate(createEthAuthInput(address));

  return {
    did: did.toString(),
    address,
    environment: getEnvironmentName(),
    node: getNodeUrl(),
  };
}
