import { formatTHB } from "@pos/shared";
import { IconQrcode } from "@tabler/icons-react";
import { Alert } from "@/components/ui/Alert";

/** The customer scans the printed shop QR (plan.md → Payment dialog → PromptPay). */
export function PromptPayPanel({ total }: { total: number }) {
  return (
    <>
      <div className="flex items-center gap-4 rounded-2xl border-2 border-border px-5 py-4">
        <IconQrcode size={48} aria-hidden className="shrink-0 text-text-soft" />
        <div className="min-w-0 flex-1">
          <p>Ask the customer to scan the shop QR at the counter, and pay exactly</p>
          <p className="text-3xl font-semibold">{formatTHB(total)}</p>
        </div>
      </div>
      <Alert tone="warning">
        The bill is saved as Pending. Check the bank app later and mark it received on the PromptPay
        page.
      </Alert>
    </>
  );
}
