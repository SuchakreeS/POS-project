import { useBillViewer } from "../bill-viewer";
import { BillDetailDialog } from "./BillDetailDialog";

/** Shows the bill opened with `openBill()` (see bill-viewer.ts). */
export function BillViewer() {
  const orderId = useBillViewer((state) => state.orderId);
  const close = useBillViewer((state) => state.close);
  return <BillDetailDialog key={orderId} orderId={orderId} onClose={close} />;
}
