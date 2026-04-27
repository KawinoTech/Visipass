import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireUser(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: "VISIT_CHECK_OUT",
      status: "FAILURE",
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    await writeAuditLog({
      event: "VISIT_CHECK_OUT",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Forbidden: insufficient role for visit check-out.",
      metadata: { role: auth.user.role },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const visitId = id?.trim();
  if (!visitId) {
    await writeAuditLog({
      event: "VISIT_CHECK_OUT",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Invalid visit id.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid visit id." }, { status: 400 });
  }

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, status: true, checkOutAt: true, cancelledAt: true },
    });
    if (!visit) {
      await writeAuditLog({
        event: "VISIT_CHECK_OUT",
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Visit not found.",
        metadata: { visitId },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Visit not found." }, { status: 404 });
    }
    if (visit.cancelledAt || visit.status !== "CHECKED_IN" || visit.checkOutAt) {
      await writeAuditLog({
        event: "VISIT_CHECK_OUT",
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Visit is not currently checked in.",
        metadata: { visitId, status: visit.status },
        ipAddress,
        userAgent,
      });
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

    await writeAuditLog({
      event: "VISIT_CHECK_OUT",
      status: "SUCCESS",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Visit checked out successfully.",
      metadata: { visitId: updated.id, status: updated.status },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ visit: updated }, { status: 200 });
  } catch (error) {
    await writeAuditLog({
      event: "VISIT_CHECK_OUT",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Unexpected failure while checking out visit.",
      metadata: { visitId, error: error instanceof Error ? error.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to check out visit." }, { status: 500 });
  }
}
