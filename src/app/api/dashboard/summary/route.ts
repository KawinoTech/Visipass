import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [currentlyOnSite, expectedToday, preRegistrations] = await Promise.all([
    prisma.visit.count({
      where: {
        status: "CHECKED_IN",
        checkOutAt: null,
        cancelledAt: null,
      },
    }),
    prisma.preRegistration.count({
      where: {
        status: "PENDING",
        expectedAt: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
    }),
    prisma.preRegistration.count({
      where: {
        status: "PENDING",
      },
    }),
  ]);

  return NextResponse.json(
    {
      currentlyOnSite,
      expectedToday,
      preRegistrations,
    },
    { status: 200 },
  );
}
