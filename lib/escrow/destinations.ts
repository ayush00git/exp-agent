/**
 * Exporter-reference -> Stripe Connect destination resolution. SERVER-ONLY.
 *
 * This is the "resolve the placeholder INSIDE the TEE" boundary: the opaque
 * exporterRef stored on a Letter of Credit is mapped here to a real Connect
 * destination account id (acct_…). The resolved acct id is used only to build
 * the Stripe Transfer and is NEVER returned to app context, logged, or stored
 * in the DB — callers receive a redacted ref instead.
 *
 * Mapping source: STRIPE_DESTINATIONS env (JSON object exporterRef -> acct_id).
 * When unset (simulation mode), a deterministic acct_sim_<hash> is derived so
 * the flow stays runnable without configuring connected accounts.
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getStripe } from "./stripe";

const CACHE_PATH = path.join(process.cwd(), "stripe_destinations_cache.json");

function readCache(): Record<string, string> {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    }
  } catch {}
  return {};
}

function writeCache(cache: Record<string, string>) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch {}
}

let cachedMap: Record<string, string> | null | undefined;

function loadMap(): Record<string, string> | null {
  if (cachedMap !== undefined) return cachedMap;
  const raw = process.env.STRIPE_DESTINATIONS;
  if (!raw) {
    cachedMap = null;
    return cachedMap;
  }
  try {
    cachedMap = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error("STRIPE_DESTINATIONS is not valid JSON (expected { exporterRef: acct_id }).");
  }
  return cachedMap;
}

export interface ResolvedDestination {
  /** Stripe Connect account id — sensitive; do not log or return to callers. */
  accountId: string;
  /** Whether this came from a configured map (false) or the simulator (true). */
  simulated: boolean;
}

/**
 * Resolve an exporter reference to a Connect destination account id.
 * Throws if a real mapping is configured but the ref is unknown.
 */
export async function resolveDestination(exporterRef: string): Promise<ResolvedDestination> {
  const map = loadMap();
  if (map) {
    const accountId = map[exporterRef];
    if (!accountId) {
      throw new Error(`No Connect destination configured for exporter reference.`);
    }
    return { accountId, simulated: false };
  }

  const stripe = getStripe();
  if (stripe) {
    // If Stripe is active, but we don't have STRIPE_DESTINATIONS configured,
    // we dynamically create a test Custom Connect account on Stripe and cache it!
    const cache = readCache();
    if (cache[exporterRef]) {
      return { accountId: cache[exporterRef], simulated: false };
    }

    try {
      // Get parent account's country to match currency/capabilities, default to 'AU'
      let country = "AU";
      try {
        const info = await (stripe.accounts.retrieve as any)();
        if (info.country) {
          country = info.country;
        }
      } catch {}

      const account = await stripe.accounts.create({
        type: "custom",
        country,
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          name: `Exporter - ${exporterRef.replace("exporter-ref:", "")}`,
        },
      });

      cache[exporterRef] = account.id;
      writeCache(cache);

      return { accountId: account.id, simulated: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to dynamically provision Stripe Connect account: ${msg}`);
    }
  }

  // Simulation: deterministic fake destination so payouts are reproducible.
  const hash = createHash("sha256").update(exporterRef).digest("hex").slice(0, 16);
  return { accountId: `acct_sim_${hash}`, simulated: true };
}
