import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = new Set(["ADMIN", "RECEPTIONIST", "SECURITY"]);

function escapeCsvCell(value: string | null | undefined) {
  const raw = value ?? "";
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
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

  const where = from || to
    ? {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      }
    : undefined;

  const visits = await prisma.visit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      purpose: true,
      personToVisit: true,
      visitFloor: true,
      expectedAt: true,
      checkInAt: true,
      checkOutAt: true,
      cancelledAt: true,
      visitorConsentAt: true,
      createdAt: true,
      visitor: {
        select: {
          fullName: true,
          company: true,
          idType: true,
          idNumber: true,
          blacklisted: true,
        },
      },
    },
    take: 10000,
  });

  const header = [
    "Visit ID",
    "Visitor Name",
    "Company",
    "Status",
    "Purpose",
    "Person To Visit",
    "Visit Floor",
    "ID Type",
    "ID Number",
    "Expected At",
    "Check In At",
    "Check Out At",
    "Cancelled At",
    "Visitor Consent At",
    "Created At",
    "Blacklisted Visitor",
  ];

  const rows = visits.map((visit) =>
    [
      visit.id,
      visit.visitor.fullName,
      visit.visitor.company,
      visit.status,
      visit.purpose,
      visit.personToVisit,
      visit.visitFloor,
      visit.visitor.idType,
      visit.visitor.idNumber,
      visit.expectedAt?.toISOString() ?? null,
      visit.checkInAt?.toISOString() ?? null,
      visit.checkOutAt?.toISOString() ?? null,
      visit.cancelledAt?.toISOString() ?? null,
      visit.visitorConsentAt?.toISOString() ?? null,
      visit.createdAt.toISOString(),
      visit.visitor.blacklisted ? "Yes" : "No",
    ].map((cell) => escapeCsvCell(cell === null ? "" : String(cell))).join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="visipass-visits-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
