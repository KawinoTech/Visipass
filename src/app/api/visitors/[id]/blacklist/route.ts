import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { message: "Forbidden: only admin and receptionist can blacklist visitors." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const visitorId = id?.trim();
  if (!visitorId) return NextResponse.json({ message: "Invalid visitor id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const blacklistReason =
    typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : "Marked by reception";

  const visitor = await prisma.visitor.findUnique({ where: { id: visitorId }, select: { id: true } });
  if (!visitor) return NextResponse.json({ message: "Visitor not found." }, { status: 404 });

  await prisma.visitor.update({
    where: { id: visitorId },
    data: {
      blacklisted: true,
      blacklistReason,
    },
  });

  return NextResponse.json({ message: "Visitor blacklisted successfully." }, { status: 200 });
}
