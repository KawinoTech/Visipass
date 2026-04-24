import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const items = await prisma.visit.findMany({
    where: {
      status: "CHECKED_IN",
      checkOutAt: null,
      cancelledAt: null,
    },
    orderBy: { checkInAt: "desc" },
    select: {
      id: true,
      personToVisit: true,
      visitFloor: true,
      checkInAt: true,
      visitor: {
        select: {
          fullName: true,
        },
      },
    },
  });

  return NextResponse.json({ items }, { status: 200 });
}
