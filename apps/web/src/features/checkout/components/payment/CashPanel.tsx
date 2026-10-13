import { cashQuickAmounts, formatSatang, formatTHB } from "@pos/shared";
import { useRef } from "react";
import { Chip } from "@/components/ui/Chip";
import { ResultBox } from "@/components/ui/ResultBox";
import { TextField } from "@/components/ui/TextField";
import { readCash } from "./cash";

const chipLabel = (satang: number) => formatSatang(satang).replace(/\.00$/, "");

export function CashPanel({
  total,
  text,
  onChange,
}: {
  total: number;
  text: string;
  onChange: (text: string) => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const { received, cash } = readCash(total, text);

  return (
    <>
      <div className="flex flex-col gap-3">
        <TextField
          ref={amountRef}
          label="Amount received"
          unit="฿"
          inputMode="decimal"
          autoFocus
          autoComplete="off"
          placeholder={`${formatSatang(total)} (exact)`}
          value={text}
          error={
            received === null
              ? "Enter an amount like 100 or 52.50"
              : cash && cash.short > 0
                ? `Short by ${formatTHB(cash.short)}`
                : undefined
          }
          hint="Leave it empty if the customer paid exactly."
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {cashQuickAmounts(total).map((amount, index) => (
            <Chip
              key={amount}
              selected={received === amount}
              onClick={() => {
                onChange(index === 0 ? "" : chipLabel(amount));
                amountRef.current?.focus(); // so Enter completes the sale next
              }}
            >
              {index === 0 ? "Exact" : chipLabel(amount)}
            </Chip>
          ))}
        </div>
      </div>
      <ResultBox label="Change">
        {cash && cash.short === 0 ? formatTHB(cash.change) : "—"}
      </ResultBox>
    </>
  );
}
