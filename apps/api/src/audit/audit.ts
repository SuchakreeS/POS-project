import type { Prisma } from "../generated/prisma/client";
import type { Db } from "../lib/db";
import type { RequestMeta } from "../lib/request-meta";
import type { AuditAction } from "./actions";

/** Who did it. Name and role are snapshots, so the log still reads right after a rename. */
export interface AuditActor {
  userId: string | null;
  userName: string;
  role: string;
}

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string | null;
}

/**
 * Append one entry to the audit log (plan.md → Audit log).
 * Pass the transaction client so the entry is written in the same transaction as the action.
 */
export async function writeAudit(db: Db, actor: AuditActor, entry: AuditEntry, meta: RequestMeta) {
  await db.auditLog.create({
    data: {
      userId: actor.userId,
      userName: actor.userName,
      role: actor.role,
      terminalId: meta.terminalId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before,
      after: entry.after,
      reason: entry.reason ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}
