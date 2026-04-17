import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const params = req.nextUrl.searchParams;
  const event = params.get("event")?.trim();
  const status = params.get("status")?.trim();
  const actor = params.get("actor")?.trim();
  const target = params.get("target")?.trim();
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"), true);
  const take = Math.min(Math.max(Number(params.get("take") ?? "100"), 1), 300);

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(event ? { event: { contains: event } } : {}),
        ...(status === "SUCCESS" || status === "FAILURE" ? { status } : {}),
        ...(actor
          ? {
              OR: [
                { actorLoginId: { contains: actor } },
                { actorUserId: { contains: actor } },
              ],
            }
          : {}),
        ...(target
          ? {
              AND: [
                {
                  OR: [
                    { targetLoginId: { contains: target } },
                    { targetUserId: { contains: target } },
                  ],
                },
              ],
            }
          : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({ logs }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Failed to fetch audit logs." }, { status: 500 });
  }
}
