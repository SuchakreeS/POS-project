import { HttpError } from "./http-error";

/** Where a newest-first page stopped: time + id, so rows with equal times still sort the same way. */
export interface CursorPosition {
  createdAt: Date;
  id: string;
}

/** Opaque `nextCursor` for the last row shown. */
export function encodeCursor(row: CursorPosition): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}

export function decodeCursor(cursor: string): CursorPosition {
  const [time, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const createdAt = new Date(time ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) throw HttpError.badRequest("Invalid cursor");
  return { createdAt, id };
}
