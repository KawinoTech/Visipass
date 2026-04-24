import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const AUDIT_EVENT_PRE_REG = "PRE_REGISTRATION_CREATE";
const AUDIT_EVENT_PRE_REG_LIST = "PRE_REGISTRATION_LIST";

const ALLOWED_PRE_REG_LIST_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);
const ALLOWED_PRE_REG_CREATE_ROLES = new Set(["ADMIN", "RECEPTIONIST", "EMPLOYEE"]);
const DEFAULT_COMPANY_NAME = "Not specified";

const createPreRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  company: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Invalid email.").optional().nullable(),
  idType: z.string().trim().max(40).optional().nullable(),
  idNumber: z.string().trim().max(60).optional().nullable(),
  expectedAt: z.string().datetime("Invalid expected date/time."),
  purpose: z.string().trim().min(3, "Reason for visit is required."),
  personToVisit: z.string().trim().min(2, "Who is being visited is required.").max(120),
  personToVisitUserId: z.string().trim().min(1, "Selected employee is required."),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireUser(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG_LIST,
      status: "FAILURE",
      actorUserId: null,
      actorLoginId: null,
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_PRE_REG_LIST_ROLES.has(auth.user.role)) {
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG_LIST,
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Forbidden: insufficient role for pre-registration list.",
      metadata: { role: auth.user.role },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Forbidden: only admin and receptionist can access pre-registrations." },
      { status: 403 },
    );
  }

  try {
    const items = await prisma.preRegistration.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        fullName: true,
        company: true,
        phone: true,
        email: true,
        idType: true,
        idNumber: true,
        expectedAt: true,
        purpose: true,
        personToVisit: true,
        visitFloor: true,
        notes: true,
        status: true,
        visitorConsentAt: true,
        createdAt: true,
        visitorId: true,
      },
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: AUDIT_EVENT_PRE_REG_LIST,
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Database unavailable while listing pre-registrations.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG_LIST,
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Failed to fetch pre-registrations.",
      metadata: { error: e instanceof Error ? e.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to fetch pre-registrations." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireUser(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG,
      status: "FAILURE",
      actorUserId: null,
      actorLoginId: null,
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_PRE_REG_CREATE_ROLES.has(auth.user.role)) {
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG,
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Forbidden: insufficient role to create pre-registration.",
      metadata: { role: auth.user.role },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Forbidden: only admin, receptionist, and employee can create pre-registrations." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG,
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createPreRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG,
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Validation failed.",
      metadata: { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      {
        message: "Validation failed.",
        fieldErrors: flat.fieldErrors,
        formErrors: flat.formErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const normalizedCompany = data.company?.trim() ? data.company.trim() : DEFAULT_COMPANY_NAME;

  try {
    const targetEmployee = await prisma.user.findFirst({
      where: {
        id: data.personToVisitUserId,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        floor: true,
      },
    });
    if (!targetEmployee) {
      await writeAuditLog({
        event: AUDIT_EVENT_PRE_REG,
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Selected employee is not available.",
        metadata: { personToVisitUserId: data.personToVisitUserId },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Selected employee is not available." }, { status: 404 });
    }
    if (!targetEmployee.floor) {
      await writeAuditLog({
        event: AUDIT_EVENT_PRE_REG,
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Selected employee has no assigned floor.",
        metadata: { personToVisitUserId: data.personToVisitUserId },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Selected employee has no assigned floor." }, { status: 400 });
    }

    const item = await prisma.preRegistration.create({
      data: {
        visitorId: null,
        fullName: data.fullName,
        company: normalizedCompany,
        phone: data.phone || null,
        email: data.email || null,
        idType: data.idType || null,
        idNumber: data.idNumber || null,
        hostUserId: targetEmployee.id,
        createdByUserId: auth.user.id,
        expectedAt: new Date(data.expectedAt),
        purpose: data.purpose,
        personToVisit: targetEmployee.fullName,
        visitFloor: targetEmployee.floor,
        notes: data.notes || null,
      },
      select: {
        id: true,
        fullName: true,
        status: true,
        expectedAt: true,
        visitorId: true,
      },
    });

    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG,
      status: "SUCCESS",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Pre-registration created.",
      metadata: {
        preRegistrationId: item.id,
        visitorFullName: item.fullName,
        personToVisit: data.personToVisit,
        hostUserId: targetEmployee.id,
        expectedAt: item.expectedAt.toISOString(),
        source: "desk_preregistration",
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: AUDIT_EVENT_PRE_REG,
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Database unavailable while creating pre-registration.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await writeAuditLog({
        event: AUDIT_EVENT_PRE_REG,
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Duplicate visitor identity detected.",
        metadata: { code: e.code },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Duplicate visitor identity detected." }, { status: 409 });
    }
    await writeAuditLog({
      event: AUDIT_EVENT_PRE_REG,
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Failed to create pre-registration.",
      metadata: { error: e instanceof Error ? e.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to create pre-registration." }, { status: 500 });
  }
}
