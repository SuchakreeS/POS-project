import { TERMINAL_HEADER } from "@pos/shared";
import type { Request } from "express";

/** Request details stored with audit entries and sessions. */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  terminalId: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  const terminal = req.get(TERMINAL_HEADER);
  return {
    ip: req.ip ?? null,
    userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
    terminalId: terminal ? terminal.slice(0, 100) : null,
  };
}
