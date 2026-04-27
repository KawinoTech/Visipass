import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const { id } = await ctx.params;
  if (!id?.trim()) {
    await writeAuditLog({
      event: "PUBLIC_PREREG_CONSENT",
      status: "FAILURE",
      message: "Invalid pre-registration id.",
      ipAddress,
      userAgent,
    });
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
        await writeAuditLog({
          event: "PUBLIC_PREREG_CONSENT",
          status: "FAILURE",
          message: "Pre-registration not found.",
          metadata: { preRegistrationId: id.trim() },
          ipAddress,
          userAgent,
        });
        return NextResponse.json({ message: "Pre-registration not found." }, { status: 404 });
      }
      if (exists.status !== "PENDING") {
        await writeAuditLog({
          event: "PUBLIC_PREREG_CONSENT",
          status: "FAILURE",
          message: "Pre-registration no longer active.",
          metadata: { preRegistrationId: id.trim(), status: exists.status },
          ipAddress,
          userAgent,
        });
        return NextResponse.json({ message: "This pre-registration is no longer active." }, { status: 410 });
      }
      await writeAuditLog({
        event: "PUBLIC_PREREG_CONSENT",
        status: "SUCCESS",
        message: "Consent already recorded for pre-registration.",
        metadata: { preRegistrationId: id.trim() },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Consent was already recorded." }, { status: 200 });
    }
    await writeAuditLog({
      event: "PUBLIC_PREREG_CONSENT",
      status: "SUCCESS",
      message: "Consent recorded for pre-registration.",
      metadata: { preRegistrationId: id.trim() },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Consent recorded. Thank you." }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "PUBLIC_PREREG_CONSENT",
        status: "FAILURE",
        message: "Service unavailable while recording pre-registration consent.",
        metadata: { preRegistrationId: id.trim() },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    await writeAuditLog({
      event: "PUBLIC_PREREG_CONSENT",
      status: "FAILURE",
      message: "Failed to record pre-registration consent.",
      metadata: { preRegistrationId: id.trim(), error: e instanceof Error ? e.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to record consent." }, { status: 500 });
  }
}
