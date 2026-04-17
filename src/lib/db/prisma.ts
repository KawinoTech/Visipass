import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const databaseUrl =
  process.env.DATABASE_URL_MYSQL ??
  process.env.DATABASE_URL ??
  process.env.DATABASE_URL_POSTGRES;

if (!databaseUrl) {
  throw new Error(
    "No database URL set. Expected DATABASE_URL_MYSQL (preferred) or DATABASE_URL or DATABASE_URL_POSTGRES."
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
