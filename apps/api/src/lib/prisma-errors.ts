import { Prisma } from "../generated/prisma/client";

/** A unique constraint failed (two requests raced past our own duplicate check). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
