import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const walkInSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  company: z.string().trim().max(120).optional().nullable().transform((s) => (s && s.length > 0 ? s : null)),
  purpose: z.string().trim().min(3, "Purpose of visit is required."),
  phone: z.string().trim().max(30).optional().nullable(),
  idType: z.string().trim().min(1, "Document type is required.").max(40),
  idNumber: z.string().trim().min(1, "Document number is required.").max(60),
});

async function resolveSelfServiceRoutingUser() {
  const preferredLoginId = process.env.SELF_SERVICE_ROUTING_USER_LOGIN_ID?.trim() || null;

  if (preferredLoginId) {
    const preferred = await prisma.user.findFirst({
      where: {
        userLoginId: preferredLoginId,
        isActive: true,
      },
      select: { id: true },
    });
    if (preferred) return preferred;
  }

  // Fallback: any active user account keeps the kiosk independent from role staffing.
  return prisma.user.findFirst({
    where: { isActive: true },
    orderBy: [{ fullName: "asc" }],
    select: { id: true },
  });
}

export async function GET() {
  try {
    const hosts = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        location: true,
        floor: true,
      },
    });
    return NextResponse.json({ hosts }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to load hosts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await writeAuditLog({
      event: "PUBLIC_WALK_IN_PREREGISTER",
      status: "FAILURE",
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = walkInSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await writeAuditLog({
      event: "PUBLIC_WALK_IN_PREREGISTER",
      status: "FAILURE",
      message: "Validation failed.",
      metadata: { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Validation failed.", fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const assignedDeskUser = await resolveSelfServiceRoutingUser();
    if (!assignedDeskUser) {
      await writeAuditLog({
        event: "PUBLIC_WALK_IN_PREREGISTER",
        status: "FAILURE",
        message: "No active account available for self-service routing.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "No active account available for self-service routing." }, { status: 503 });
    }

    const preRegistration = await prisma.$transaction(async (tx) => {
      const visitor = await tx.visitor.findFirst({
        where: { idNumber: data.idNumber },
        select: { id: true },
      });

      return tx.preRegistration.create({
        data: {
          visitorId: visitor?.id ?? null,
          fullName: data.fullName,
          company: data.company,
          phone: data.phone && data.phone.length > 0 ? data.phone : null,
          email: null,
          idType: data.idType,
          idNumber: data.idNumber,
          hostUserId: assignedDeskUser.id,
          createdByUserId: assignedDeskUser.id,
          expectedAt: new Date(),
          purpose: data.purpose,
          personToVisit: null,
          visitFloor: null,
          notes: "Self-service desk pre-registration",
        },
        select: { id: true, status: true, visitorConsentAt: true },
      });
    });

    await writeAuditLog({
      event: "PUBLIC_WALK_IN_PREREGISTER",
      status: "SUCCESS",
      targetUserId: preRegistration.id,
      message: "Self-service pre-registration captured.",
      metadata: { preRegistrationId: preRegistration.id, status: preRegistration.status },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ preRegistration }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "PUBLIC_WALK_IN_PREREGISTER",
        status: "FAILURE",
        message: "Database unavailable while capturing self-service pre-registration.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await writeAuditLog({
        event: "PUBLIC_WALK_IN_PREREGISTER",
        status: "FAILURE",
        message: "Duplicate document number already exists.",
        metadata: { code: e.code },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Duplicate document number already exists." }, { status: 409 });
    }
    await writeAuditLog({
      event: "PUBLIC_WALK_IN_PREREGISTER",
      status: "FAILURE",
      message: "Failed to capture self-service pre-registration.",
      metadata: { error: e instanceof Error ? e.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to capture self-service pre-registration." }, { status: 500 });
  }
}
