import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

/** Either the main client or a transaction client, so helpers can join a caller's transaction. */
export type Db = typeof prisma | Prisma.TransactionClient;
