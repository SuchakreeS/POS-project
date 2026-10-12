import type { Request } from "express";
import type { AuditActor } from "../audit/audit";
import { getAuth } from "../middleware/require-auth";
import { requestMeta, type RequestMeta } from "./request-meta";

/** Who is acting and from where. Services take this instead of the Express request. */
export interface RequestContext {
  actor: AuditActor & { userId: string };
  meta: RequestMeta;
}

/** For routes behind requireAuth. */
export function requestContext(req: Request): RequestContext {
  const auth = getAuth(req);
  return {
    actor: { userId: auth.userId, userName: auth.displayName, role: auth.role },
    meta: requestMeta(req),
  };
}
