import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST", "EMPLOYEE"]);

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { message: "Forbidden: only admin, receptionist, and employee can access returning visitors." },
      { status: 403 },
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const records = await prisma.preRegistration.findMany({
    where: {
      createdByUserId: auth.user.id,
      visitorId: { not: null },
      ...(q
        ? {
            fullName: {
              contains: q,
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    distinct: ["visitorId"],
    take: 30,
    select: {
      createdAt: true,
      visitor: {
        select: {
          id: true,
          fullName: true,
          company: true,
          idNumber: true,
        },
      },
    },
  });

  const items = records
    .filter((row) => Boolean(row.visitor))
    .map((row) => ({
      id: row.visitor!.id,
      fullName: row.visitor!.fullName,
      company: row.visitor!.company,
      idNumber: row.visitor!.idNumber,
      lastRegisteredAt: row.createdAt,
    }));

  return NextResponse.json({ items }, { status: 200 });
}
