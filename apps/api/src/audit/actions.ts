/**
 * Fixed list of audit log actions (plan.md → Audit log).
 * Every write to AuditLog uses one of these, so filters and the future Activity page stay clean.
 */
export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "ORDER_CREATE",
  "DISCOUNT_APPLIED",
  "PROMPTPAY_RECEIVED",
  "PROMPTPAY_RECEIVED_UNDO",
  "ORDER_VOID",
  "PRODUCT_CREATE",
  "PRODUCT_UPDATE",
  "PRICE_CHANGE",
  "PRODUCT_DEACTIVATE",
  "PRODUCT_REACTIVATE",
  "CATEGORY_CREATE",
  "CATEGORY_UPDATE",
  "STOCK_RESTOCK",
  "STOCK_ADJUST",
  "CUSTOMER_CREATE",
  "CUSTOMER_UPDATE",
  "CREDIT_CHARGE",
  "CREDIT_REPAYMENT",
  "CREDIT_CHARGE_VOID",
  "USER_CREATE",
  "USER_UPDATE",
  "USER_DEACTIVATE",
  "ROLE_CHANGE",
  "SETTINGS_UPDATE",
  "TERMINAL_CREATE",
  "REPORT_GENERATED",
  "REPORT_SENT_LINE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
