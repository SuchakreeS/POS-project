import { formatTHB, type Order } from "@pos/shared";

/*
 * Orders page and Bill detail wording (plan.md → Orders page, Bill detail dialog).
 */

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

/** "37 pcs (4 items)" — pieces are the quantities added up, items are the different products. */
export function piecesLabel(pieceCount: number, lineCount: number): string {
  return `${plural(pieceCount, "pc")} (${plural(lineCount, "item")})`;
}

/** The red banner in the void step: what will happen to stock and to the money. */
export function voidEffect(order: Order): string {
  const pieces = order.items.reduce((sum, line) => sum + line.qty, 0);
  const stock = `Voiding returns ${piecesLabel(pieces, order.items.length)} to stock`;
  const total = formatTHB(order.total);

  let money = ".";
  if (order.paymentMethod === "CREDIT") {
    money = ` and takes ${total} off what ${order.customer?.name ?? "the customer"} owes.`;
  } else if (order.promptpay?.status === "PENDING") {
    money = " and cancels the pending PromptPay payment.";
  } else if (order.total > 0 && order.paymentMethod === "PROMPTPAY") {
    money = `. The PromptPay payment was already received: send ${total} back to the customer.`;
  } else if (order.total > 0) {
    money = `. Give the customer back ${total} in cash.`;
  }
  return `${stock}${money} The bill stays in the list as Voided.`;
}
