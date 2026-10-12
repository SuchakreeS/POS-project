import { formatTHB } from "@pos/shared";
import { useEffect, useState } from "react";
import { api } from "./lib/api";

type Health = { status: "ok"; time: string; db?: "ok" | "error" };
type CheckState =
  { state: "loading" } | { state: "ok"; health: Health } | { state: "error"; message: string };

/** Step 1 placeholder: checks that web → API → database are connected. Replaced by real pages from step 2. */
export default function App() {
  const [check, setCheck] = useState<CheckState>({ state: "loading" });

  useEffect(() => {
    api<Health>("/health?db=1")
      .then((health) => setCheck({ state: "ok", health }))
      .catch((error: Error) => setCheck({ state: "error", message: error.message }));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-page p-8">
        <p className="text-3xl font-semibold text-primary">POS</p>
        <h1 className="mt-2 text-2xl font-semibold">Setup check</h1>
        <p className="text-text-muted">Phase 1 · step 1</p>

        <ul className="mt-6 space-y-3">
          <StatusRow label="Web app" ok />
          <StatusRow
            label="API"
            ok={check.state === "ok"}
            pending={check.state === "loading"}
            detail={check.state === "error" ? check.message : undefined}
          />
          <StatusRow
            label="Database"
            ok={check.state === "ok" && check.health.db === "ok"}
            pending={check.state === "loading"}
          />
        </ul>

        <p className="mt-6 text-sm text-text-muted">
          Money format check: <span className="font-medium text-text">{formatTHB(124500)}</span>
        </p>
      </div>
    </main>
  );
}

function StatusRow({
  label,
  ok,
  pending,
  detail,
}: {
  label: string;
  ok: boolean;
  pending?: boolean;
  detail?: string;
}) {
  const style = pending
    ? "bg-surface-alt text-text-muted"
    : ok
      ? "bg-success-tint text-success-text"
      : "bg-danger-tint text-danger-text";
  const text = pending ? "Checking…" : ok ? "Connected" : "Not connected";
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${style}`} title={detail}>
        ● {text}
      </span>
    </li>
  );
}
