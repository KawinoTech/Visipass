import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST", "SECURITY"]);

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

function escapeCsvCell(value: string | null | undefined) {
  const raw = value ?? "";
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return new Response("Unauthorised\n", { status: auth.status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return new Response("Forbidden\n", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const params = req.nextUrl.searchParams;
  const from = parseDateParam(params.get("from"));
  const to = parseDateParam(params.get("to"), true);

  const visitRange = from || to
    ? {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      }
    : undefined;

  const visitors = await prisma.visitor.findMany({
    where: {
      ...(visitRange ? { visits: { some: visitRange } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      company: true,
      phone: true,
      email: true,
      idType: true,
      idNumber: true,
      blacklisted: true,
      blacklistReason: true,
      createdAt: true,
      visits: {
        where: visitRange,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          checkInAt: true,
          checkOutAt: true,
        },
      },
    },
    take: 10000,
  });

  const header = [
    "Visitor ID",
    "Full Name",
    "Company",
    "Phone",
    "Email",
    "ID Type",
    "ID Number",
    "Blacklisted",
    "Blacklist Reason",
    "Visitor Created At",
    "Visits In Range",
    "First Visit In Range",
    "Last Visit In Range",
    "Last Visit Status",
    "Last Check In At",
    "Last Check Out At",
  ];

  const rows = visitors.map((visitor) => {
    const visitsCount = visitor.visits.length;
    const firstVisit = visitsCount > 0 ? visitor.visits[0] : null;
    const lastVisit = visitsCount > 0 ? visitor.visits[visitsCount - 1] : null;
    return [
      visitor.id,
      visitor.fullName,
      visitor.company,
      visitor.phone,
      visitor.email,
      visitor.idType,
      visitor.idNumber,
      visitor.blacklisted ? "Yes" : "No",
      visitor.blacklistReason,
      visitor.createdAt.toISOString(),
      String(visitsCount),
      firstVisit?.createdAt.toISOString() ?? "",
      lastVisit?.createdAt.toISOString() ?? "",
      lastVisit?.status ?? "",
      lastVisit?.checkInAt?.toISOString() ?? "",
      lastVisit?.checkOutAt?.toISOString() ?? "",
    ].map((cell) => escapeCsvCell(cell)).join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="visipass-visitors-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
