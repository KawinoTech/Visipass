import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);
const consentExpiryDaysRaw = Number(process.env.CONSENT_EXPIRY_DAYS ?? "90");
const CONSENT_EXPIRY_DAYS = Number.isFinite(consentExpiryDaysRaw) && consentExpiryDaysRaw > 0 ? consentExpiryDaysRaw : 90;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { message: "Forbidden: only admin and receptionist can check in visitors." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const visitorId = id?.trim();
  if (!visitorId) return NextResponse.json({ message: "Invalid visitor id." }, { status: 400 });

  const visitor = await prisma.visitor.findUnique({
    where: { id: visitorId },
    select: {
      id: true,
      blacklisted: true,
      visits: {
        orderBy: [{ checkInAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          hostUserId: true,
          purpose: true,
          personToVisit: true,
          visitFloor: true,
          notes: true,
          visitorConsentAt: true,
        },
      },
    },
  });
  if (!visitor) return NextResponse.json({ message: "Visitor not found." }, { status: 404 });
  if (visitor.blacklisted) {
    return NextResponse.json({ message: "Blacklisted visitors cannot be checked in." }, { status: 409 });
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
      { message: "This guest is already checked in and has not been checked out yet." },
      { status: 409 },
    );
  }

  const lastVisit = visitor.visits[0];
  if (!lastVisit) {
    return NextResponse.json(
      { message: "No prior visit found for this visitor. Use Visit operations form for the first check-in." },
      { status: 400 },
    );
  }

  const host = await prisma.user.findFirst({
    where: { id: lastVisit.hostUserId, isActive: true },
    select: { id: true, fullName: true, floor: true },
  });
  if (!host || !host.floor) {
    return NextResponse.json({ message: "Previous host is unavailable or has no assigned floor." }, { status: 400 });
  }
  const latestConsentAt = visitor.visits
    .map((v) => v.visitorConsentAt)
    .filter((v): v is Date => Boolean(v))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const hasValidConsent = latestConsentAt
    ? new Date(latestConsentAt.getTime() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) > new Date()
    : false;

  const visit = await prisma.visit.create({
    data: {
      visitorId: visitor.id,
      hostUserId: host.id,
      createdByUserId: auth.user.id,
      status: "CHECKED_IN",
      purpose: lastVisit.purpose || "Repeat check-in",
      personToVisit: host.fullName || lastVisit.personToVisit || null,
      visitFloor: host.floor || lastVisit.visitFloor || null,
      notes: lastVisit.notes || "Quick check-in from Visitors directory.",
      expectedAt: null,
      checkInAt: new Date(),
      visitorConsentAt: hasValidConsent ? new Date() : null,
    },
    select: { id: true, visitorId: true, visitorConsentAt: true },
  });

  return NextResponse.json(
    { message: "Visitor checked in successfully.", visit, consentRequired: visit.visitorConsentAt == null },
    { status: 201 },
  );
}
