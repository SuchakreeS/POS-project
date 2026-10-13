import { formatSatang, formatTHB } from "@pos/shared";
import { ResultBox } from "@/components/ui/ResultBox";
import { CustomerPicker } from "@/features/credit/components/CustomerPicker";
import { balanceOf, nameOf, type CustomerChoice } from "@/features/credit/customer-choice";

/** Add the bill to what a customer owes (plan.md → Payment dialog → Credit). */
export function CreditPanel({
  total,
  customer,
  onChange,
  error,
}: {
  total: number;
  customer: CustomerChoice | null;
  onChange: (customer: CustomerChoice | null) => void;
  error?: string;
}) {
  return (
    <>
      <CustomerPicker value={customer} onChange={onChange} error={error} />
      {customer && (
        <ResultBox label={`${nameOf(customer)} will owe`}>
          <span className="font-normal text-text-muted">
            {formatSatang(balanceOf(customer))} →{" "}
          </span>
          {formatTHB(balanceOf(customer) + total)}
        </ResultBox>
      )}
    </>
  );
}
