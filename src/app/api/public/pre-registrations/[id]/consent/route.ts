import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid pre-registration id." }, { status: 400 });
  }

  try {
    const updated = await prisma.preRegistration.updateMany({
      where: {
        id: id.trim(),
        status: "PENDING",
        visitorConsentAt: null,
      },
      data: { visitorConsentAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await prisma.preRegistration.findFirst({
        where: { id: id.trim() },
        select: { visitorConsentAt: true, status: true },
      });
      if (!exists) {
        return NextResponse.json({ message: "Pre-registration not found." }, { status: 404 });
      }
      if (exists.status !== "PENDING") {
        return NextResponse.json({ message: "This pre-registration is no longer active." }, { status: 410 });
      }
      return NextResponse.json({ message: "Consent was already recorded." }, { status: 200 });
    }
    return NextResponse.json({ message: "Consent recorded. Thank you." }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to record consent." }, { status: 500 });
  }
}
