import { NextRequest, NextResponse } from "next/server";
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

function floorLabel(floor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR" | null) {
  if (floor === "GROUND_FLOOR") return "Ground Floor";
  if (floor === "FIRST_FLOOR") return "First Floor";
  if (floor === "SECOND_FLOOR") return "Second Floor";
  return "Unassigned";
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json({ message: "Forbidden: insufficient role for reports." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(params.get("days") ?? "30"), 1), 90);
  const fromParam = parseDateParam(params.get("from"));
  const toParam = parseDateParam(params.get("to"), true);
  const endDate = toParam ?? new Date();
  const startDate = fromParam ?? new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  if (!fromParam) startDate.setHours(0, 0, 0, 0);

  const visits = await prisma.visit.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      visitorId: true,
      status: true,
      visitFloor: true,
      createdAt: true,
      checkInAt: true,
      checkOutAt: true,
      visitorConsentAt: true,
      visitor: {
        select: {
          blacklisted: true,
        },
      },
    },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const blacklistedVisitors = await prisma.visitor.count({ where: { blacklisted: true } });
  const currentlyOnSite = await prisma.visit.count({
    where: {
      status: "CHECKED_IN",
      checkOutAt: null,
      cancelledAt: null,
    },
  });

  const activityByDayMap = new Map<string, number>();
  const timingByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const floorDistributionMap = new Map<string, number>();
  const uniqueVisitors = new Set<string>();

  let checkedIn = 0;
  let checkedOut = 0;
  let cancelled = 0;
  let pending = 0;
  let visitsWithConsent = 0;
  let visitsWithoutConsent = 0;
  let totalDurationMinutes = 0;
  let durationSamples = 0;
  let todayVisits = 0;

  for (const visit of visits) {
    uniqueVisitors.add(visit.visitorId);
    const dayKey = visit.createdAt.toISOString().slice(0, 10);
    activityByDayMap.set(dayKey, (activityByDayMap.get(dayKey) ?? 0) + 1);
    if (visit.createdAt >= todayStart) todayVisits += 1;

    if (visit.status === "CHECKED_IN") checkedIn += 1;
    if (visit.status === "CHECKED_OUT") checkedOut += 1;
    if (visit.status === "CANCELLED") cancelled += 1;
    if (visit.status === "PENDING") pending += 1;

    if (visit.visitorConsentAt) visitsWithConsent += 1;
    else visitsWithoutConsent += 1;

    const floor = floorLabel(visit.visitFloor);
    floorDistributionMap.set(floor, (floorDistributionMap.get(floor) ?? 0) + 1);

    if (visit.checkInAt) {
      timingByHour[visit.checkInAt.getHours()].count += 1;
    }

    if (visit.checkInAt && visit.checkOutAt && visit.checkOutAt > visit.checkInAt) {
      totalDurationMinutes += Math.round((visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / 60000);
      durationSamples += 1;
    }
  }

  const activityByDay = Array.from(activityByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const floorDistribution = Array.from(floorDistributionMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const totalVisits = visits.length;
  const consentRatePct = totalVisits > 0 ? Number(((visitsWithConsent / totalVisits) * 100).toFixed(1)) : 0;
  const avgVisitMinutes = durationSamples > 0 ? Math.round(totalDurationMinutes / durationSamples) : 0;

  return NextResponse.json(
    {
      range: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      totals: {
        totalVisits,
        todayVisits,
        currentlyOnSite,
        uniqueVisitors: uniqueVisitors.size,
        checkedIn,
        checkedOut,
        cancelled,
        pending,
      },
      timings: {
        avgVisitMinutes,
        timingByHour,
      },
      security: {
        blacklistedVisitors,
        visitsWithConsent,
        visitsWithoutConsent,
        consentRatePct,
      },
      activityByDay,
      floorDistribution,
    },
    { status: 200 },
  );
}
