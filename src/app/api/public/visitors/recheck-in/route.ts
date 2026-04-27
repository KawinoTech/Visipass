import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const bodySchema = z.object({
  visitorId: z.string().trim().min(1, "Visitor id is required."),
});

const consentExpiryDaysRaw = Number(process.env.CONSENT_EXPIRY_DAYS ?? "90");
const CONSENT_EXPIRY_DAYS = Number.isFinite(consentExpiryDaysRaw) && consentExpiryDaysRaw > 0 ? consentExpiryDaysRaw : 90;

async function resolveSelfServiceRoutingUser() {
  const preferredLoginId = process.env.SELF_SERVICE_ROUTING_USER_LOGIN_ID?.trim() || null;

  if (preferredLoginId) {
    const preferred = await prisma.user.findFirst({
      where: {
        userLoginId: preferredLoginId,
        isActive: true,
      },
      select: { id: true, fullName: true, floor: true },
    });
    if (preferred) return preferred;
  }

  return prisma.user.findFirst({
    where: { isActive: true },
    orderBy: [{ fullName: "asc" }],
    select: { id: true, fullName: true, floor: true },
  });
}

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    await writeAuditLog({
      event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
      status: "FAILURE",
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    await writeAuditLog({
      event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
      status: "FAILURE",
      message: "Validation failed.",
      metadata: { fieldErrors: parsed.error.flatten().fieldErrors },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Validation failed." }, { status: 400 });
  }

  const { visitorId } = parsed.data;

  try {
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
      },
    });

    if (!visitor) {
      await writeAuditLog({
        event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
        status: "FAILURE",
        targetUserId: visitorId,
        message: "Visitor not found.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Visitor not found." }, { status: 404 });
    }

    if (visitor.blacklisted) {
      await writeAuditLog({
        event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
        status: "FAILURE",
        targetUserId: visitor.id,
        message: "Blacklisted visitor attempted self-service check-in.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        {
          code: "BLACKLISTED",
          message: "Unable to check you in, please seek assistance from our Reception Desk.",
          messageSw: "Hatuwezi kukusajili kwa sasa, tafadhali pata msaada kutoka dawati la mapokezi.",
        },
        { status: 403 },
      );
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
        event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
        status: "FAILURE",
        targetUserId: visitor.id,
        message: "Visitor already checked in.",
        metadata: { activeVisitId: activeVisit.id },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { message: "You are currently checked in. Please seek assistance from our Reception Desk." },
        { status: 409 },
      );
    }

    const latestConsentVisit = await prisma.visit.findFirst({
      where: {
        visitorId: visitor.id,
        visitorConsentAt: { not: null },
      },
      orderBy: { visitorConsentAt: "desc" },
      select: { visitorConsentAt: true },
    });
    const latestConsentAt = latestConsentVisit?.visitorConsentAt ?? null;
    const consentValid = latestConsentAt
      ? new Date(latestConsentAt.getTime() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) > new Date()
      : false;

    const existingPending = await prisma.preRegistration.findFirst({
      where: {
        visitorId: visitor.id,
        status: "PENDING",
        notes: { contains: "self-service" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, visitorConsentAt: true },
    });

    if (existingPending) {
      await writeAuditLog({
        event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
        status: "SUCCESS",
        targetUserId: visitor.id,
        message: "Reused existing pending self-service preregistration.",
        metadata: { preRegistrationId: existingPending.id, consentValid },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        {
          preRegistration: { id: existingPending.id, status: existingPending.status },
          consentRequired: !consentValid,
        },
        { status: 200 },
      );
    }

    const routingUser = await resolveSelfServiceRoutingUser();
    if (!routingUser) {
      await writeAuditLog({
        event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
        status: "FAILURE",
        targetUserId: visitor.id,
        message: "No active routing account available.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "No active account available for self-service routing." }, { status: 503 });
    }

    const preRegistration = await prisma.preRegistration.create({
      data: {
        visitorId: visitor.id,
        fullName: visitor.fullName,
        company: visitor.company,
        phone: visitor.phone,
        email: visitor.email,
        idType: visitor.idType,
        idNumber: visitor.idNumber,
        hostUserId: routingUser.id,
        createdByUserId: routingUser.id,
        expectedAt: new Date(),
        purpose: "Returning visitor check-in",
        personToVisit: null,
        visitFloor: null,
        notes: "Self-service returning visitor pre-registration",
        visitorConsentAt: consentValid ? new Date() : null,
      },
      select: { id: true, status: true },
    });

    await writeAuditLog({
      event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
      status: "SUCCESS",
      targetUserId: visitor.id,
      message: "Created self-service preregistration for returning visitor.",
      metadata: { preRegistrationId: preRegistration.id, consentValid },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      {
        preRegistration,
        consentRequired: !consentValid,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
        status: "FAILURE",
        targetUserId: visitorId,
        message: "Database unavailable.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }

    await writeAuditLog({
      event: "PUBLIC_RETURNING_VISITOR_RECHECK_IN",
      status: "FAILURE",
      targetUserId: visitorId,
      message: "Unexpected failure during returning visitor self-service check-in.",
      metadata: { error: e instanceof Error ? e.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to process returning visitor check-in." }, { status: 500 });
  }
}
