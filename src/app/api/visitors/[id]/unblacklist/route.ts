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
      event: "VISITOR_UNBLACKLIST",
      status: "FAILURE",
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    await writeAuditLog({
      event: "VISITOR_UNBLACKLIST",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Forbidden: insufficient role for unblacklisting.",
      metadata: { role: auth.user.role },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Forbidden: only admin and receptionist can unblacklist visitors." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const visitorId = id?.trim();
  if (!visitorId) {
    await writeAuditLog({
      event: "VISITOR_UNBLACKLIST",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Invalid visitor id.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid visitor id." }, { status: 400 });
  }

  const visitor = await prisma.visitor.findUnique({ where: { id: visitorId }, select: { id: true } });
  if (!visitor) {
    await writeAuditLog({
      event: "VISITOR_UNBLACKLIST",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Visitor not found.",
      metadata: { visitorId },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Visitor not found." }, { status: 404 });
  }

  try {
    await prisma.visitor.update({
      where: { id: visitorId },
      data: {
        blacklisted: false,
        blacklistReason: null,
      },
    });
    await writeAuditLog({
      event: "VISITOR_UNBLACKLIST",
      status: "SUCCESS",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitorId,
      message: "Visitor unblacklisted successfully.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Visitor unblacklisted successfully." }, { status: 200 });
  } catch (error) {
    await writeAuditLog({
      event: "VISITOR_UNBLACKLIST",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitorId,
      message: "Unexpected failure while unblacklisting visitor.",
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to unblacklist visitor." }, { status: 500 });
  }
}
