import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Default bootstrap account (created once if `userLoginId` is not taken).
 * Change the password after first login in production.
 */
const DEFAULT_ADMIN = {
  userLoginId: "admin",
  password: "Mua@2020",
  fullName: "Administrator",
  email: "ke-ithelpdesk@mua.co.ke",
  role: "ADMIN" as const,
  location: "HEAD_OFFICE" as const,
  floor: "GROUND_FLOOR" as const,
};

const BCRYPT_ROUNDS = 12;

/**
 * Ensures the initial admin user exists. Idempotent: no-op if `admin` already exists.
 * Safe to call on every server start. Swallows DB init errors so the app can still boot when DB is down.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const existing = await prisma.user.findUnique({
      where: { userLoginId: DEFAULT_ADMIN.userLoginId },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, BCRYPT_ROUNDS);
    await prisma.user.create({
      data: {
        userLoginId: DEFAULT_ADMIN.userLoginId,
        fullName: DEFAULT_ADMIN.fullName,
        email: DEFAULT_ADMIN.email.trim().toLowerCase(),
        location: DEFAULT_ADMIN.location,
        floor: DEFAULT_ADMIN.floor,
        role: DEFAULT_ADMIN.role,
        passwordHash,
      },
    });

    console.info(
      `[visipass] Default admin created (userLoginId: ${DEFAULT_ADMIN.userLoginId}). Change password after first login.`,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.warn("[visipass] Database unavailable; skipped default admin bootstrap.");
      return;
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      console.warn(
        "[visipass] Default admin not created: userLoginId or email already in use (P2002).",
      );
      return;
    }
    // Schema not applied to this database (tables missing).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      console.warn(
        "[visipass] Default admin skipped: database has no `User` table yet. Apply the Prisma schema first, e.g. `npm run prisma:generate` then `npm run db:init` (MySQL) or `npm run db:init:postgres`.",
      );
      return;
    }
    console.error("[visipass] Default admin bootstrap failed:", e);
  }
}
