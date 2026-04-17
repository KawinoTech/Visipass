import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "25");
  const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

  try {
    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ fullName: "asc" }],
      take,
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    return NextResponse.json({ employees }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }

    return NextResponse.json({ message: "Failed to load employees." }, { status: 500 });
  }
}
