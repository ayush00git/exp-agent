export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 font-mono">
      <h1 className="text-2xl font-semibold tracking-tight">
        Autonomous Trade Finance Agent
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        An autonomous escrow agent for cross-border trade. It locks a buyer&apos;s
        funds, watches for proof of delivery, and releases payment to the
        exporter through the Terminal 3 TEE — so the agent never sees either
        party&apos;s raw banking details, and every step is written to an
        immutable audit ledger.
      </p>

      <div className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm">
        <p className="text-neutral-300">Step 1 — Scaffold + onboarding</p>
        <p className="mt-2 text-neutral-500">
          Verify the agent identity:{" "}
          <a
            className="text-emerald-400 underline underline-offset-4"
            href="/health"
          >
            GET /health
          </a>{" "}
          inits the Terminal 3 client and resolves the agent DID.
        </p>
      </div>
    </main>
  );
}
