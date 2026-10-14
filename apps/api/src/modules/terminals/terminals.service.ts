import { formatBillNo, type Terminal, type terminalInputSchema } from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { Terminal as TerminalRow } from "../../generated/prisma/client";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation } from "../../lib/prisma-errors";
import type { RequestContext } from "../../lib/request-context";

export type TerminalInput = z.output<typeof terminalInputSchema>;

function toTerminal(row: TerminalRow): Terminal {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nextBillNo: formatBillNo(row.code, row.lastBillSeq + 1),
  };
}

/** Active checkout devices, by code. */
export async function listTerminals(): Promise<Terminal[]> {
  const rows = await prisma.terminal.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  return rows.map(toTerminal);
}

/** "+ Add terminal" on the Settings page. The code becomes the bill number prefix. */
export async function createTerminal(input: TerminalInput, ctx: RequestContext): Promise<Terminal> {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.terminal.create({ data: input });
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "TERMINAL_CREATE",
          entityType: "Terminal",
          entityId: row.id,
          after: { code: row.code, name: row.name },
        },
        ctx.meta,
      );
      return toTerminal(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw HttpError.duplicate("code", `There's already a terminal ${input.code}.`);
    }
    throw error;
  }
}
