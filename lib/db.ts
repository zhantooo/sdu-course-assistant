import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Lazily created so routes that never touch the database don't require DATABASE_URL. */
export function getDb(): PrismaClient {
  globalForPrisma.__prisma ??= createClient();
  return globalForPrisma.__prisma;
}
