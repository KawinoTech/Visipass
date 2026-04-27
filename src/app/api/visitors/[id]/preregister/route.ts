import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST", "EMPLOYEE"]);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireUser(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Forbidden: insufficient role for visitor preregistration.",
      metadata: { role: auth.user.role },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Forbidden: only admin, receptionist, and employee can create pre-registrations." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const visitorId = id?.trim();
  if (!visitorId) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Invalid visitor id.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid visitor id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const expectedAtRaw = typeof body?.expectedAt === "string" ? body.expectedAt.trim() : "";
  if (!expectedAtRaw) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitorId,
      message: "Expected date/time is required.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Expected date and time is required." }, { status: 400 });
  }
  const expectedAt = new Date(expectedAtRaw);
  if (Number.isNaN(expectedAt.getTime())) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitorId,
      message: "Invalid expected date/time.",
      metadata: { expectedAtRaw },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid expected date and time." }, { status: 400 });
  }

  const visitor = await prisma.visitor.findUnique({
    where: { id: visitorId },
    select: {
      id: true,
      fullName: true,
      company: true,
      phone: true,
      email: true,
      idType: true,
      idNumber: true,
      blacklisted: true,
      visits: {
        orderBy: [{ checkInAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          hostUserId: true,
          purpose: true,
          personToVisit: true,
          visitFloor: true,
        },
      },
    },
  });
  if (!visitor) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitorId,
      message: "Visitor not found.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Visitor not found." }, { status: 404 });
  }
  if (!visitor.idNumber) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "Visitor has no document number.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Visitor has no document number. Cannot preregister safely." }, { status: 409 });
  }
  if (visitor.blacklisted) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "Blacklisted visitors cannot be preregistered.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Blacklisted visitors cannot be pre-registered." }, { status: 409 });
  }
  const activeVisit = await prisma.visit.findFirst({
    where: {
      visitorId: visitor.id,
      status: "CHECKED_IN",
      checkOutAt: null,
      cancelledAt: null,
    },
    select: { id: true },
  });
  if (activeVisit) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "Visitor currently checked in; preregistration blocked.",
      metadata: { activeVisitId: activeVisit.id },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      {
        code: "ACTIVE_VISIT",
        message: "This guest is currently checked in. Check out first before pre-registering.",
      },
      { status: 409 },
    );
  }

  const lastVisit = visitor.visits[0];
  if (!lastVisit) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "No previous visit found to derive host details.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "No previous visit found to derive host details for pre-registration." },
      { status: 400 },
    );
  }

  const host = await prisma.user.findFirst({
    where: {
      id: lastVisit.hostUserId,
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      floor: true,
    },
  });
  if (!host || !host.floor) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "Previous host unavailable or has no assigned floor.",
      metadata: { hostUserId: lastVisit.hostUserId },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Previous host is unavailable or has no assigned floor." }, { status: 400 });
  }

  try {
    const item = await prisma.preRegistration.create({
      data: {
        visitorId: visitor.id,
        fullName: visitor.fullName,
        company: visitor.company?.trim() ? visitor.company : "Not specified",
        phone: visitor.phone,
        email: visitor.email,
        idType: visitor.idType,
        idNumber: visitor.idNumber,
        hostUserId: host.id,
        createdByUserId: auth.user.id,
        expectedAt,
        purpose: lastVisit.purpose || "Return visit",
        personToVisit: host.fullName || lastVisit.personToVisit || "Host",
        visitFloor: host.floor || lastVisit.visitFloor || null,
        notes: "visitor_directory_preregister",
      },
      select: {
        id: true,
        fullName: true,
        expectedAt: true,
        status: true,
        idNumber: true,
      },
    });

    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "SUCCESS",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "Visitor preregistration created from directory.",
      metadata: { preRegistrationId: item.id, expectedAt: item.expectedAt.toISOString() },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    await writeAuditLog({
      event: "VISITOR_PREREGISTER",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visitor.id,
      message: "Unexpected failure while creating visitor preregistration.",
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to create pre-registration." }, { status: 500 });
  }
}
