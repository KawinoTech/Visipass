import Link from "next/link";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/db/prisma";
import styles from "./dashboard.module.css";

const FLOOR_ORDER = ["SECOND_FLOOR", "FIRST_FLOOR", "GROUND_FLOOR"] as const;
const MAX_VISIBLE_AVATARS_PER_FLOOR = 12;
const GROUND_FLOOR_ZONES = [
  "Marketing and Meeting Rooms",
  "Reception",
  "Town Hall",
  "Business Development, General Claims and Underwriting/Reinsurance",
] as const;
const FIRST_FLOOR_ZONES = ["ICT", "Boardroom (Mara)", "Reception", "Health and Finance"] as const;
const SECOND_FLOOR_ZONES = ["Audit and Actuarial", "Reception", "Executive Wing"] as const;

export default async function DashboardPage() {
  const activeVisits = await prisma.visit.findMany({
    where: {
      status: "CHECKED_IN",
      checkOutAt: null,
      cancelledAt: null,
    },
    orderBy: { checkInAt: "desc" },
    select: {
      id: true,
      visitFloor: true,
      checkInAt: true,
      personToVisit: true,
      visitor: {
        select: {
          fullName: true,
        },
      },
    },
  });
  const floorGroups = FLOOR_ORDER.map((floorKey) => ({
    floorKey,
    items: activeVisits.filter((visit) => visit.visitFloor === floorKey),
  }));

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "10px",
        background: "var(--vp-page-bg)",
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/home" className={styles.breadcrumbLink}>
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Back to Home
          </Link>
          <span className={styles.breadcrumbCurrent}>Dashboard</span>
        </nav>
        <p style={{ margin: 0, fontSize: 13, color: "var(--vp-subtitle)", fontWeight: 700 }}>
          Active checked-in visitors: {activeVisits.length}
        </p>
      </div>

      <section
        style={{
          position: "relative",
          width: "75vw",
          height: "75vh",
          margin: "0 auto",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--vp-card-border)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--brand-primary) 8%, var(--vp-card-bg)) 0%, var(--vp-card-bg) 100%)",
        }}
      >
        <div
          aria-label="Three story building layout"
          style={{
            position: "absolute",
            inset: "4% 6%",
            border: "3px solid color-mix(in srgb, var(--vp-title) 70%, transparent)",
            borderRadius: 14,
            background: "var(--vp-card-bg)",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--vp-card-border) 80%, transparent)",
          }}
        >
          {FLOOR_ORDER.map((floorKey, index) => {
            const floorItems = floorGroups.find((group) => group.floorKey === floorKey)?.items ?? [];
            const visibleItems = floorItems.slice(0, MAX_VISIBLE_AVATARS_PER_FLOOR);
            const overflowCount = Math.max(0, floorItems.length - visibleItems.length);
            const zoneLayout =
              floorKey === "GROUND_FLOOR"
                ? { zones: GROUND_FLOOR_ZONES, template: "1.2fr 1fr 1fr 1.6fr", receptionIndex: 1 }
                : floorKey === "FIRST_FLOOR"
                  ? { zones: FIRST_FLOOR_ZONES, template: "0.7fr 1.2fr 1fr 1.7fr", receptionIndex: 2 }
                  : floorKey === "SECOND_FLOOR"
                    ? { zones: SECOND_FLOOR_ZONES, template: "1fr 1.1fr 1fr", receptionIndex: 1 }
                  : null;
            return (
              <div
                key={floorKey}
                style={{
                  height: `${100 / FLOOR_ORDER.length}%`,
                  borderBottom:
                    index < FLOOR_ORDER.length - 1
                      ? "3px solid color-mix(in srgb, var(--vp-title) 70%, transparent)"
                      : "none",
                  position: "relative",
                  background: floorKey === "GROUND_FLOOR"
                    ? "color-mix(in srgb, var(--brand-primary) 10%, var(--vp-card-bg))"
                    : index % 2 === 0
                      ? "color-mix(in srgb, var(--brand-primary) 14%, var(--vp-card-bg))"
                      : "color-mix(in srgb, var(--brand-primary) 8%, var(--vp-card-bg))",
                }}
              >
              {zoneLayout ? (
                <div
                  aria-label={`${formatFloorLabel(floorKey)} zones`}
                  style={{
                    position: "absolute",
                    inset: "10% 4%",
                    display: "grid",
                    gridTemplateColumns: zoneLayout.template,
                    gap: 8,
                  }}
                >
                  {zoneLayout.zones.map((zone, zoneIndex) => (
                    <div
                      key={zone}
                      style={{
                        border: "1px solid color-mix(in srgb, var(--vp-card-border) 85%, transparent)",
                        borderRadius: 10,
                        background: "color-mix(in srgb, var(--vp-card-bg) 85%, var(--brand-primary) 15%)",
                        padding: "8px 10px",
                        color: "var(--vp-title)",
                        fontSize: 11,
                        fontWeight: 800,
                        lineHeight: 1.3,
                        display: "flex",
                        alignItems: zoneIndex === zoneLayout.receptionIndex ? "flex-start" : "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        textAlign: "center",
                        gap: 8,
                      }}
                    >
                      <span>{zone}</span>
                      {zoneIndex === zoneLayout.receptionIndex ? (
                        <div
                          style={{
                            width: "100%",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {visibleItems.map((visit) => (
                            <div
                              key={visit.id}
                              title={`${visit.visitor.fullName} (${formatFloorLabel(floorKey)})`}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: "var(--brand-primary)",
                                color: "var(--background)",
                                fontSize: 11,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "2px solid var(--vp-card-bg)",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                              }}
                            >
                              {getInitials(visit.visitor.fullName)}
                            </div>
                          ))}
                          {overflowCount > 0 ? (
                            <div
                              title={`${overflowCount} more visitors on ${formatFloorLabel(floorKey)}`}
                              style={{
                                minWidth: 32,
                                height: 30,
                                padding: "0 8px",
                                borderRadius: 999,
                                background: "var(--vp-title)",
                                color: "var(--background)",
                                fontSize: 11,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "2px solid var(--vp-card-bg)",
                              }}
                            >
                              +{overflowCount}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: 10,
                  fontWeight: 800,
                  fontSize: 13,
                  color: "var(--vp-title)",
                }}
              >
                {formatFloorLabel(floorKey)}
              </span>
              {!zoneLayout ? (
                <div
                  style={{
                    position: "absolute",
                    inset: "16% 36% 16% 36%",
                    border: "1px solid color-mix(in srgb, var(--vp-card-border) 85%, transparent)",
                    borderRadius: 10,
                    background: "color-mix(in srgb, var(--vp-card-bg) 85%, var(--brand-primary) 15%)",
                    padding: "8px 10px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ width: "100%", fontSize: 11, fontWeight: 800, color: "var(--vp-title)", textAlign: "center" }}>
                    Reception
                  </span>
                  {visibleItems.map((visit) => (
                    <div
                      key={visit.id}
                      title={`${visit.visitor.fullName} (${formatFloorLabel(floorKey)})`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--brand-primary)",
                        color: "var(--background)",
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--vp-card-bg)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                      }}
                    >
                      {getInitials(visit.visitor.fullName)}
                    </div>
                  ))}
                  {overflowCount > 0 ? (
                    <div
                      title={`${overflowCount} more visitors on ${formatFloorLabel(floorKey)}`}
                      style={{
                        minWidth: 34,
                        height: 32,
                        padding: "0 8px",
                        borderRadius: 999,
                        background: "var(--vp-title)",
                        color: "var(--background)",
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--vp-card-bg)",
                      }}
                    >
                      +{overflowCount}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          width: "75vw",
          margin: "12px auto 0",
          borderRadius: 12,
          border: "1px solid var(--vp-card-border)",
          background: "var(--vp-card-bg)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--vp-card-border)" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "var(--vp-title)" }}>Checked-in visitors list</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--vp-subtitle)" }}>
            Live list of visitors currently on site.
          </p>
        </div>
        {activeVisits.length === 0 ? (
          <p style={{ margin: 0, padding: "14px", color: "var(--vp-subtitle)", fontSize: 14 }}>
            No visitors are currently checked in.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: "color-mix(in srgb, var(--brand-primary) 8%, white)" }}>
                  <th style={thStyle}>Visitor</th>
                  <th style={thStyle}>Employee to be visited</th>
                  <th style={thStyle}>Floor</th>
                  <th style={thStyle}>Checked in at</th>
                </tr>
              </thead>
              <tbody>
                {activeVisits.map((visit) => (
                  <tr key={visit.id}>
                    <td style={tdStyle}>{visit.visitor.fullName}</td>
                    <td style={tdStyle}>{visit.personToVisit || "—"}</td>
                    <td style={tdStyle}>{visit.visitFloor ? formatFloorLabel(visit.visitFloor) : "—"}</td>
                    <td style={tdStyle}>{visit.checkInAt ? new Date(visit.checkInAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatFloorLabel(floor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR") {
  if (floor === "GROUND_FLOOR") return "Ground Floor";
  if (floor === "FIRST_FLOOR") return "First Floor";
  return "Second Floor";
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 800,
  color: "var(--vp-title)",
  borderBottom: "1px solid var(--vp-card-border)",
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--text)",
  borderBottom: "1px solid var(--vp-card-border)",
};
