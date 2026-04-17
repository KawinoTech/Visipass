import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_PRE_REG_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

const createPreRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  company: z.string().trim().min(1, "Company is required.").max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Invalid email.").optional().nullable(),
  idType: z.string().trim().max(40).optional().nullable(),
  idNumber: z.string().trim().max(60).optional().nullable(),
  expectedAt: z.string().datetime("Invalid expected date/time."),
  purpose: z.string().trim().min(3, "Reason for visit is required."),
  personToVisit: z.string().trim().min(2, "Who is being visited is required.").max(120),
  visitFloor: z.enum(["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"]),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_PRE_REG_ROLES.has(auth.user.role)) {
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
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to fetch pre-registrations." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_PRE_REG_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { message: "Forbidden: only admin and receptionist can create pre-registrations." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createPreRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
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

  try {
    const item = await prisma.preRegistration.create({
      data: {
        visitorId: null,
        fullName: data.fullName,
        company: data.company,
        phone: data.phone || null,
        email: data.email || null,
        idType: data.idType || null,
        idNumber: data.idNumber || null,
        hostUserId: auth.user.id,
        createdByUserId: auth.user.id,
        expectedAt: new Date(data.expectedAt),
        purpose: data.purpose,
        personToVisit: data.personToVisit,
        visitFloor: data.visitFloor,
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

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Duplicate visitor identity detected." }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to create pre-registration." }, { status: 500 });
  }
}
