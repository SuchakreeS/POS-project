import { clsx } from "clsx";
import { LinkButton } from "@/components/ui/LinkButton";
import { openBill } from "../bill-viewer";

/** "Bill T1-000124" that opens the bill on top of the current screen. */
export function BillLink({
  order,
  prefix = "Bill ",
  className,
}: {
  order: { id: string; billNo: string };
  prefix?: string;
  className?: string;
}) {
  return (
    <LinkButton
      className={clsx("font-normal", className)}
      onClick={(event) => {
        event.stopPropagation(); // rows that open something themselves
        openBill(order.id);
      }}
    >
      {prefix}
      {order.billNo}
    </LinkButton>
  );
}
