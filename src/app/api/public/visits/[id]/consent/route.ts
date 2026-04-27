import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const { id } = await ctx.params;
  if (!id?.trim()) {
    await writeAuditLog({
      event: "PUBLIC_VISIT_CONSENT",
      status: "FAILURE",
      message: "Invalid visit id.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid visit id." }, { status: 400 });
  }

  try {
    const updated = await prisma.visit.updateMany({
      where: {
        id: id.trim(),
        status: { in: ["PENDING", "CHECKED_IN"] },
        visitorConsentAt: null,
      },
      data: { visitorConsentAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await prisma.visit.findFirst({
        where: { id: id.trim() },
        select: { visitorConsentAt: true, status: true },
      });
      if (!exists) {
        await writeAuditLog({
          event: "PUBLIC_VISIT_CONSENT",
          status: "FAILURE",
          message: "Visit not found.",
          metadata: { visitId: id.trim() },
          ipAddress,
          userAgent,
        });
        return NextResponse.json({ message: "Visit not found." }, { status: 404 });
      }
      if (exists.status === "CHECKED_OUT" || exists.status === "CANCELLED") {
        await writeAuditLog({
          event: "PUBLIC_VISIT_CONSENT",
          status: "FAILURE",
          message: "Visit no longer active.",
          metadata: { visitId: id.trim(), status: exists.status },
          ipAddress,
          userAgent,
        });
        return NextResponse.json({ message: "This visit is no longer active." }, { status: 410 });
      }
      await writeAuditLog({
        event: "PUBLIC_VISIT_CONSENT",
        status: "SUCCESS",
        message: "Consent already recorded for visit.",
        metadata: { visitId: id.trim() },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Consent was already recorded." }, { status: 200 });
    }
    await writeAuditLog({
      event: "PUBLIC_VISIT_CONSENT",
      status: "SUCCESS",
      message: "Consent recorded for visit.",
      metadata: { visitId: id.trim() },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Consent recorded. Thank you." }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "PUBLIC_VISIT_CONSENT",
        status: "FAILURE",
        message: "Service unavailable while recording visit consent.",
        metadata: { visitId: id.trim() },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    await writeAuditLog({
      event: "PUBLIC_VISIT_CONSENT",
      status: "FAILURE",
      message: "Failed to record visit consent.",
      metadata: { visitId: id.trim(), error: e instanceof Error ? e.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to record consent." }, { status: 500 });
  }
}
