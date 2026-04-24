import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const visitId = id?.trim();
  if (!visitId) {
    return NextResponse.json({ message: "Invalid visit id." }, { status: 400 });
  }

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, status: true, checkOutAt: true, cancelledAt: true },
  });
  if (!visit) {
    return NextResponse.json({ message: "Visit not found." }, { status: 404 });
  }
  if (visit.cancelledAt || visit.status !== "CHECKED_IN" || visit.checkOutAt) {
    return NextResponse.json({ message: "Visit is not currently checked in." }, { status: 409 });
  }

  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "CHECKED_OUT",
      checkOutAt: new Date(),
    },
    select: { id: true, status: true, checkOutAt: true },
  });

  return NextResponse.json({ visit: updated }, { status: 200 });
}
