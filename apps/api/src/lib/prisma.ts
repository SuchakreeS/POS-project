import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../env";

// One Prisma client for the whole app, talking to Postgres through the `pg` driver.
// DATABASE_URL should be the Supabase transaction pooler URL (port 6543).
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
