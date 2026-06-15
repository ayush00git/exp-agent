/**
 * Terminal 3 Agent Auth SDK adapter — client bootstrap + key material.
 *
 * SERVER-ONLY. The agent's secret (an Ethereum private key that derives its
 * DID) is read here from the environment and MUST never reach the browser,
 * the LLM context, app logs, or the DB. This module only ever exposes the
 * derived public DID / address / pubkey + an authenticated client.
 *
 * NOTE on the spec/SDK mismatch: AGENTS.md says "load T3N_API_KEY". The real
 * @terminal3/t3n-sdk has no API-key concept — agents authenticate with an
 * Ethereum private key (or OIDC) via handshake() -> authenticate(). We use
 * T3N_AGENT_PRIVATE_KEY. See BUGS.md (#1).
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
import { SigningKey } from "ethers";

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
 * on each call (a fresh handshake + authenticate).
 */
let wasmPromise: Promise<WasmComponent> | null = null;

function getWasm(): Promise<WasmComponent> {
  if (!wasmPromise) {
    setEnvironment(ENVIRONMENT);
    wasmPromise = loadWasmComponent();
  }
  return wasmPromise;
}

/** Read the agent's private key (server-side only). Throws if missing. */
export function getAgentPrivateKey(): string {
  const key = process.env.T3N_AGENT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "T3N_AGENT_PRIVATE_KEY is not set. Add it to .env.local (server-side only).",
    );
  }
  return key;
}

/** The agent secret as raw 32 bytes — for signCredential / signAgentInvocation. */
export function getAgentSecretBytes(): Uint8Array {
  const hex = getAgentPrivateKey().replace(/^0x/, "");
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/** The agent's 0x ETH address (public). */
export function getAgentAddress(): string {
  return eth_get_address(getAgentPrivateKey());
}

/**
 * The agent's 33-byte compressed secp256k1 public key — the `agent_pubkey`
 * a delegation credential authorises (matches SDK's AGENT_PUBKEY_LEN === 33).
 */
export function getAgentCompressedPubkey(): Uint8Array {
  const sk = new SigningKey(getAgentPrivateKey());
  return Uint8Array.from(Buffer.from(sk.compressedPublicKey.slice(2), "hex"));
}

/**
 * Construct, handshake, and authenticate a T3 client for the agent.
 * Returns the live client plus the resolved public identity.
 */
export async function createAuthenticatedClient(): Promise<{
  client: T3nClient;
  did: string;
  address: string;
}> {
  setEnvironment(ENVIRONMENT);
  const privateKey = getAgentPrivateKey();
  const address = eth_get_address(privateKey);
  const wasmComponent = await getWasm();

  const client = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, privateKey) },
  });

  await client.handshake();
  const did = await client.authenticate(createEthAuthInput(address));

  return { client, did: did.toString(), address };
}

/**
 * Init the Terminal 3 client and resolve the agent DID. Returns ONLY public
 * identity fields. Used by GET /health.
 */
export async function resolveAgentIdentity(): Promise<AgentIdentity> {
  const { did, address } = await createAuthenticatedClient();
  return {
    did,
    address,
    environment: getEnvironmentName(),
    node: getNodeUrl(),
  };
}
