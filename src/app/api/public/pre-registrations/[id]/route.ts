import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid pre-registration id." }, { status: 400 });
  }

  try {
    const row = await prisma.preRegistration.findFirst({
      where: { id: id.trim(), status: "PENDING" },
      select: { fullName: true, visitorConsentAt: true },
    });
    if (!row) {
      return NextResponse.json({ message: "Pre-registration not found or no longer available." }, { status: 404 });
    }
    return NextResponse.json(
      {
        fullName: row.fullName,
        consentRecorded: row.visitorConsentAt != null,
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to load pre-registration." }, { status: 500 });
  }
}
