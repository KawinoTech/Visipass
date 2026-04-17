import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid visit id." }, { status: 400 });
  }

  try {
    const visit = await prisma.visit.findFirst({
      where: { id: id.trim() },
      select: {
        id: true,
        status: true,
        visitorConsentAt: true,
        checkInAt: true,
        visitor: { select: { fullName: true } },
      },
    });
    if (!visit) {
      return NextResponse.json({ message: "Visit not found." }, { status: 404 });
    }
    return NextResponse.json({ visit }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Database unavailable." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to load visit." }, { status: 500 });
  }
}
