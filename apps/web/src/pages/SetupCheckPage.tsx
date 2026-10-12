import { formatTHB } from "@pos/shared";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

interface Health {
  status: "ok";
  time: string;
  db?: "ok" | "error";
}

const POLL_MS = 3000;

/** /setup — checks that web → API → database are connected. Public, so it works before anyone can log in. */
export function SetupCheckPage() {
  // With `pnpm dev` the web app is up before the API, so keep checking until everything is connected.
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => api.get<Health>("/health?db=1", { auth: false, signal }),
    retry: false,
    refetchInterval: (query) => (query.state.data?.db === "ok" ? false : POLL_MS),
  });

  const apiOk = health.isSuccess;
  const dbOk = health.data?.db === "ok";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt p-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-border bg-page p-8">
        <p className="text-3xl font-semibold text-primary">POS</p>
        <h1 className="mt-2 text-2xl font-semibold">Setup check</h1>

        <ul className="mt-6 space-y-3">
          <StatusRow label="Web app" ok />
          <StatusRow
            label="API"
            ok={apiOk}
            pending={health.isPending}
            detail={health.isError ? errorMessage(health.error) : undefined}
          />
          <StatusRow label="Database" ok={dbOk} pending={health.isPending} />
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
  const [style, text] = pending
    ? ["bg-surface-alt text-text-muted", "Checking…"]
    : ok
      ? ["bg-success-tint text-success-text", "Connected"]
      : ["bg-danger-tint text-danger-text", "Not connected"];

  return (
    <li className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <span className={clsx("rounded-full px-3 py-0.5 text-sm font-medium", style)} title={detail}>
        ● {text}
      </span>
    </li>
  );
}
