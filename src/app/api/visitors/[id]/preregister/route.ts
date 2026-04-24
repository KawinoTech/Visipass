import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST", "EMPLOYEE"]);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { message: "Forbidden: only admin, receptionist, and employee can create pre-registrations." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const visitorId = id?.trim();
  if (!visitorId) return NextResponse.json({ message: "Invalid visitor id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const expectedAtRaw = typeof body?.expectedAt === "string" ? body.expectedAt.trim() : "";
  if (!expectedAtRaw) {
    return NextResponse.json({ message: "Expected date and time is required." }, { status: 400 });
  }
  const expectedAt = new Date(expectedAtRaw);
  if (Number.isNaN(expectedAt.getTime())) {
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
  if (!visitor) return NextResponse.json({ message: "Visitor not found." }, { status: 404 });
  if (!visitor.idNumber) {
    return NextResponse.json({ message: "Visitor has no document number. Cannot preregister safely." }, { status: 409 });
  }
  if (visitor.blacklisted) {
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
    return NextResponse.json(
      { message: "This guest is currently checked in. Check out first before pre-registering." },
      { status: 409 },
    );
  }

  const lastVisit = visitor.visits[0];
  if (!lastVisit) {
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
    return NextResponse.json({ message: "Previous host is unavailable or has no assigned floor." }, { status: 400 });
  }

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

  return NextResponse.json({ item }, { status: 201 });
}
