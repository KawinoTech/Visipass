import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid visit id." }, { status: 400 });
  }

  try {
    const visit = await prisma.visit.findFirst({
      where: {
        id: id.trim(),
        status: { in: ["PENDING", "CHECKED_IN"] },
      },
      select: {
        visitorConsentAt: true,
        visitor: { select: { fullName: true } },
      },
    });
    if (!visit) {
      return NextResponse.json({ message: "Visit not found or no longer active." }, { status: 404 });
    }
    return NextResponse.json(
      {
        fullName: visit.visitor.fullName,
        consentRecorded: visit.visitorConsentAt != null,
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to load visit." }, { status: 500 });
  }
}
