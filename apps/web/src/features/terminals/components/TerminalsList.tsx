import { IconDeviceDesktop, IconPlus } from "@tabler/icons-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { useThisTerminal } from "../queries";
import { useThisPc } from "../this-pc";

/**
 * Settings → Terminals: every checkout device, which one this PC is, and the next bill number.
 * Picking is saved in this browser only, so do it once on each PC.
 */
export function TerminalsList({ onAdd }: { onAdd: () => void }) {
  const terminals = useThisTerminal();
  const pickedId = useThisPc((state) => state.terminalId);
  const setTerminalId = useThisPc((state) => state.setTerminalId);
  const currentId = terminals.current?.status === "ready" ? terminals.current.terminal.id : null;

  if (terminals.isPending) return <Skeleton className="h-24 w-full" />;
  if (terminals.isError) return <Alert tone="danger">{errorMessage(terminals.error)}</Alert>;

  return (
    <div className="flex flex-col gap-3">
      {terminals.current?.status === "unpicked" && (
        <Alert tone="warning">This PC isn't a checkout device yet. Pick one below.</Alert>
      )}
      <ul className="flex flex-col rounded-2xl border-2 border-border">
        {terminals.data.map((terminal) => (
          <li
            key={terminal.id}
            className="flex items-center gap-3 border-b-2 border-border px-4 py-3 last:border-b-0"
          >
            <IconDeviceDesktop size={22} aria-hidden className="shrink-0 text-text-soft" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {terminal.code} · {terminal.name}
              </span>
              <span className="block text-sm text-text-muted">Next bill {terminal.nextBillNo}</span>
            </span>
            {terminal.id === currentId ? (
              <Badge tone="success">This PC</Badge>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTerminalId(terminal.id);
                  toast.success(`This PC is now ${terminal.code} · ${terminal.name}`);
                }}
              >
                Use on this PC
              </Button>
            )}
          </li>
        ))}
      </ul>
      {/* The only terminal is used automatically; saying so avoids "why isn't it picked?" */}
      {terminals.data.length === 1 && pickedId === null && (
        <p className="text-sm text-text-muted">
          With one terminal, every PC uses it. Add another to run two checkouts with their own bill
          numbers.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<IconPlus size={16} aria-hidden />}
        onClick={onAdd}
        className="self-start"
      >
        Add terminal
      </Button>
    </div>
  );
}
