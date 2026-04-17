import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const walkInSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  company: z.string().trim().min(1, "Company is required.").max(120),
  purpose: z.string().trim().min(3, "Purpose of visit is required."),
  phone: z.string().trim().max(30).optional().nullable(),
  idType: z.string().trim().min(1, "Document type is required.").max(40),
  idNumber: z.string().trim().min(1, "Document number is required.").max(60),
  hostUserId: z.string().trim().min(1, "Host selection is required."),
});

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = walkInSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return NextResponse.json(
      { message: "Validation failed.", fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const host = await prisma.user.findFirst({
      where: { id: data.hostUserId, isActive: true },
      select: { id: true, fullName: true },
    });
    if (!host) {
      return NextResponse.json({ message: "Selected host is not available." }, { status: 404 });
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
          hostUserId: host.id,
          createdByUserId: host.id,
          expectedAt: new Date(),
          purpose: data.purpose,
          personToVisit: null,
          visitFloor: null,
          notes: "Self-service desk pre-registration",
        },
        select: { id: true, status: true, visitorConsentAt: true },
      });
    });

    return NextResponse.json({ preRegistration }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Duplicate document number already exists." }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to capture self-service pre-registration." }, { status: 500 });
  }
}
