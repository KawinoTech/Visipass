import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const ALLOWED_VISIT_OPERATION_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .nullable()
  .transform((s) => (s && s.length > 0 ? s : null));

const requiredIdType = z.string().trim().min(1, "Document type is required.").max(40);

const requiredIdNumber = z.string().trim().min(1, "Document number is required.").max(60);

const walkInBody = z.object({
  type: z.literal("walk_in"),
  fullName: z.string().trim().min(2, "Full name is required."),
  company: z.string().trim().min(1, "Company is required.").max(120),
  purpose: z.string().trim().min(3, "Purpose of visit is required."),
  personToVisit: z.string().trim().min(2, "Who is being visited is required.").max(120),
  visitFloor: z.enum(["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"]),
  phone: optionalPhone,
  idType: requiredIdType,
  idNumber: requiredIdNumber,
});

const preRegisteredBody = z.object({
  type: z.literal("pre_registered"),
  preRegistrationId: z.string().trim().min(1, "Pre-registration is required."),
  personToVisit: z.string().trim().min(2, "Who is being visited is required.").max(120),
  visitFloor: z.enum(["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"]),
  phone: optionalPhone,
  idType: requiredIdType,
  idNumber: requiredIdNumber,
});

const createVisitBody = z.discriminatedUnion("type", [walkInBody, preRegisteredBody]);

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireUser(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: "VISIT_CHECK_IN",
      status: "FAILURE",
      actorUserId: null,
      actorLoginId: null,
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_VISIT_OPERATION_ROLES.has(auth.user.role)) {
    await writeAuditLog({
      event: "VISIT_CHECK_IN",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Forbidden: insufficient role for visit check-in.",
      metadata: { role: auth.user.role },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Forbidden: only admin and receptionist can perform visit check-in." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await writeAuditLog({
      event: "VISIT_CHECK_IN",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createVisitBody.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await writeAuditLog({
      event: "VISIT_CHECK_IN",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
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
    if (data.type === "walk_in") {
      const visit = await prisma.$transaction(async (tx) => {
        const visitor = await tx.visitor.create({
          data: {
            fullName: data.fullName,
            company: data.company,
            phone: data.phone,
            email: null,
            idType: data.idType,
            idNumber: data.idNumber,
          },
          select: { id: true },
        });

        return tx.visit.create({
          data: {
            visitorId: visitor.id,
            hostUserId: auth.user.id,
            createdByUserId: auth.user.id,
            status: "CHECKED_IN",
            purpose: data.purpose,
            personToVisit: data.personToVisit,
            visitFloor: data.visitFloor,
            notes: null,
            expectedAt: null,
            checkInAt: new Date(),
          },
          select: {
            id: true,
            visitorId: true,
            status: true,
            purpose: true,
            personToVisit: true,
            visitFloor: true,
            expectedAt: true,
            checkInAt: true,
          },
        });
      });

      await writeAuditLog({
        event: "VISIT_CHECK_IN",
        status: "SUCCESS",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        targetUserId: visit.visitorId,
        message: "Walk-in visitor checked in.",
        metadata: {
          flow: "walk_in",
          visitId: visit.id,
          personToVisit: visit.personToVisit,
          visitFloor: visit.visitFloor,
        },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ visit }, { status: 201 });
    }

    const visit = await prisma.$transaction(async (tx) => {
      const pre = await tx.preRegistration.findFirst({
        where: { id: data.preRegistrationId, status: "PENDING" },
      });
      if (!pre) {
        throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      }
      if (!pre.visitorConsentAt) {
        throw Object.assign(new Error("CONSENT_REQUIRED"), { code: "CONSENT_REQUIRED" });
      }

      if (pre.visitorId) {
        await tx.visitor.update({
          where: { id: pre.visitorId },
          data: {
            ...(data.phone !== null ? { phone: data.phone } : {}),
            idType: data.idType,
            idNumber: data.idNumber,
          },
        });

        const v = await tx.visit.create({
          data: {
            visitorId: pre.visitorId,
            hostUserId: auth.user.id,
            createdByUserId: auth.user.id,
            status: "CHECKED_IN",
            purpose: pre.purpose,
            personToVisit: data.personToVisit,
            visitFloor: data.visitFloor,
            notes: pre.notes,
            expectedAt: pre.expectedAt,
            checkInAt: new Date(),
          },
          select: {
            id: true,
            visitorId: true,
            status: true,
            purpose: true,
            personToVisit: true,
            visitFloor: true,
            expectedAt: true,
            checkInAt: true,
          },
        });

        await tx.preRegistration.update({
          where: { id: pre.id },
          data: { status: "CONVERTED", convertedVisitId: v.id },
        });

        return v;
      }

      const visitor = await tx.visitor.create({
        data: {
          fullName: pre.fullName,
          company: pre.company,
          phone: data.phone ?? pre.phone,
          email: pre.email,
          idType: data.idType,
          idNumber: data.idNumber,
        },
        select: { id: true },
      });

      const v = await tx.visit.create({
        data: {
          visitorId: visitor.id,
          hostUserId: auth.user.id,
          createdByUserId: auth.user.id,
          status: "CHECKED_IN",
          purpose: pre.purpose,
          personToVisit: data.personToVisit,
          visitFloor: data.visitFloor,
          notes: pre.notes,
          expectedAt: pre.expectedAt,
          checkInAt: new Date(),
        },
        select: {
          id: true,
          visitorId: true,
          status: true,
          purpose: true,
          personToVisit: true,
          visitFloor: true,
          expectedAt: true,
          checkInAt: true,
        },
      });

      await tx.preRegistration.update({
        where: { id: pre.id },
        data: { status: "CONVERTED", convertedVisitId: v.id, visitorId: visitor.id },
      });

      return v;
    });

    await writeAuditLog({
      event: "VISIT_CHECK_IN",
      status: "SUCCESS",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      targetUserId: visit.visitorId,
      message: "Pre-registered visitor checked in.",
      metadata: {
        flow: "pre_registered",
        visitId: visit.id,
        preRegistrationId: data.preRegistrationId,
        personToVisit: visit.personToVisit,
        visitFloor: visit.visitFloor,
      },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ visit }, { status: 201 });
  } catch (e) {
    console.error("[api/visits][POST] Failed to check in visitor", {
      message: e instanceof Error ? e.message : "Unknown error",
      ...(e instanceof Prisma.PrismaClientKnownRequestError
        ? { prismaCode: e.code, clientVersion: e.clientVersion }
        : {}),
      ...(e instanceof Prisma.PrismaClientInitializationError
        ? { clientVersion: e.clientVersion }
        : {}),
      stack: e instanceof Error ? e.stack : undefined,
    });

    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "NOT_FOUND") {
      await writeAuditLog({
        event: "VISIT_CHECK_IN",
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Pre-registration not found or already checked in.",
        metadata: {
          flow: data.type,
          ...(data.type === "pre_registered" ? { preRegistrationId: data.preRegistrationId } : {}),
        },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Pre-registration not found or already checked in." }, { status: 404 });
    }
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "CONSENT_REQUIRED") {
      await writeAuditLog({
        event: "VISIT_CHECK_IN",
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Consent is required before checking in pre-registration.",
        metadata: {
          flow: data.type,
          ...(data.type === "pre_registered" ? { preRegistrationId: data.preRegistrationId } : {}),
        },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { message: "Visitor consent is required before receptionist check-in." },
        { status: 409 },
      );
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "VISIT_CHECK_IN",
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Database unavailable while checking in visitor.",
        metadata: { flow: data.type },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await writeAuditLog({
        event: "VISIT_CHECK_IN",
        status: "FAILURE",
        actorUserId: auth.user.id,
        actorLoginId: auth.user.userLoginId,
        message: "Unique constraint violation during visitor check-in.",
        metadata: { flow: data.type, code: e.code },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Duplicate document number or email on file." }, { status: 409 });
    }
    await writeAuditLog({
      event: "VISIT_CHECK_IN",
      status: "FAILURE",
      actorUserId: auth.user.id,
      actorLoginId: auth.user.userLoginId,
      message: "Unexpected failure while checking in visitor.",
      metadata: {
        flow: data.type,
        error: e instanceof Error ? e.message : "Unknown error",
      },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to check in visitor." }, { status: 500 });
  }
}
