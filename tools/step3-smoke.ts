/**
 * Step 3 smoke test — exercises all four T3 adapter functions end-to-end.
 * Run: node --env-file=.env.local --env-file=.env --import tsx tools/step3-smoke.ts
 */
import {
  mintBuyerAuthorization,
  verifyAgentIdentity,
  resolveAndPayoutInTEE,
  writeAuditRow,
  getAgentAddress,
} from "../lib/t3/adk";
import { createAuthenticatedClient } from "../lib/t3/client";
import { onStep } from "../lib/t3/events";
import { IdentityError } from "../lib/t3/errors";

const LC_ID = "smoke-lc-001";

async function main() {
  onStep((e) => console.log(`  [step] ${e.kind} ok=${e.ok} :: ${e.message}`));

  // Resolve the real agent DID so we can assert verifyAgentIdentity matches it.
  const { did: agentDid } = await createAuthenticatedClient();
  console.log("agent DID:", agentDid, "addr:", getAgentAddress());

  // Demo buyer DID derived from the demo buyer address (did:t3n:<40hex>).
  const { Wallet } = await import("ethers");
  const buyerAddr = new Wallet(process.env.T3N_DEMO_BUYER_PRIVATE_KEY!).address;
  const buyerDid = "did:t3n:" + buyerAddr.slice(2).toLowerCase();

  console.log("\n1) mintBuyerAuthorization");
  const mint = await mintBuyerAuthorization(buyerDid, LC_ID);
  console.log("   ok:", mint.ok, "placeholder:", mint.proof);

  console.log("\n2) verifyAgentIdentity (match)");
  const id = await verifyAgentIdentity(agentDid);
  console.log("   ok:", id.ok, "did:", id.data?.did);

  console.log("\n2b) verifyAgentIdentity (mismatch -> should throw IdentityError)");
  try {
    await verifyAgentIdentity("did:t3n:" + "00".repeat(20));
    console.log("   ERROR: expected throw");
  } catch (e) {
    console.log("   threw:", e instanceof IdentityError ? `IdentityError(${e.code})` : String(e));
  }

  console.log("\n3) resolveAndPayoutInTEE (default simulator)");
  const payout = await resolveAndPayoutInTEE({
    buyerPlaceholder: mint.data!.buyerPlaceholder,
    exporterRef: "exporter-ref:acme-textiles-001",
    amountCents: 2_500_000,
    lcId: LC_ID,
  });
  console.log("   ok:", payout.ok, "agentSig proof:", payout.proof?.slice(0, 16) + "...", "payoutRef:", payout.data?.payoutRef);

  console.log("\n4) writeAuditRow");
  const audit = await writeAuditRow({
    agentDid,
    fromState: "EXECUTED",
    toState: "SETTLED",
    proof: payout.proof!,
    txRef: payout.data!.payoutRef,
  });
  console.log("   ok:", audit.ok, "receiptHash:", audit.proof, "id:", audit.data?.id);

  console.log("\n5) redaction guard (raw account number -> should throw)");
  try {
    await writeAuditRow({
      agentDid,
      fromState: "EXECUTED",
      toState: "SETTLED",
      proof: "account 4111111111111111 routing 021000021",
    });
    console.log("   ERROR: expected throw");
  } catch (e) {
    console.log("   threw:", (e as Error).name, "-", (e as Error).message.slice(0, 60));
  }

  console.log("\nSMOKE OK");
}

main()
  .catch((e) => {
    console.error("SMOKE FAILED:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
