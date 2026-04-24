"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import AppHeader from "../../components/header/AppHeader";
import { Preloader } from "../../components/ui/Preloader";
import styles from "../home-page.module.css";

type UserRole = "ADMIN" | "RECEPTIONIST" | "SECURITY" | "EMPLOYEE";
type ActiveVisitRow = {
  id: string;
  personToVisit: string | null;
  visitFloor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR" | null;
  checkInAt: string | Date | null;
  visitor: { fullName: string };
};

type FunctionCard = {
  key: string;
  title: string;
  text: string;
  badge: string;
  href?: string;
  action?: () => void;
  roles: UserRole[];
};

export default function HomePage() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [stats, setStats] = useState<{
    currentlyOnSite: number;
    expectedToday: number;
    preRegistrations: number;
  } | null>(null);
  const [activeVisits, setActiveVisits] = useState<ActiveVisitRow[]>([]);
  const [loadingActiveVisits, setLoadingActiveVisits] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const canManageCheckouts = userRole === "ADMIN" || userRole === "RECEPTIONIST";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        setUserRole((data?.user?.role as UserRole | undefined) ?? null);
        setAuthenticated(true);
      } catch {
        if (!alive) return;
        router.replace("/login");
      } finally {
        if (alive) setCheckingAuth(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok) return;
        setStats({
          currentlyOnSite: Number(data?.currentlyOnSite ?? 0),
          expectedToday: Number(data?.expectedToday ?? 0),
          preRegistrations: Number(data?.preRegistrations ?? 0),
        });
      } catch {
        // Keep cards rendered even if stats call fails.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!canManageCheckouts) return;
    let alive = true;
    (async () => {
      setLoadingActiveVisits(true);
      try {
        const res = await fetch("/api/dashboard/active-visits", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok) return;
        setActiveVisits((data?.items ?? []) as ActiveVisitRow[]);
      } catch {
        // Keep home usable if active visits loading fails.
      } finally {
        if (alive) setLoadingActiveVisits(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canManageCheckouts]);

  async function checkOutVisit(visitId: string) {
    if (!canManageCheckouts || checkingOutId) return;
    setCheckingOutId(visitId);
    try {
      const res = await fetch(`/api/visits/${encodeURIComponent(visitId)}/check-out`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast(data?.message || "Failed to check out visitor.");
        return;
      }
      setActiveVisits((prev) => prev.filter((visit) => visit.id !== visitId));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              currentlyOnSite: Math.max(0, prev.currentlyOnSite - 1),
            }
          : prev,
      );
    } catch {
      setToast("Network error while checking out visitor.");
    } finally {
      setCheckingOutId(null);
    }
  }

  if (checkingAuth) {
    return (
      <main className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Preloader label="Checking session..." size="lg" />
      </main>
    );
  }

  if (!authenticated) return null;

  const cards: FunctionCard[] = [
    {
      key: "users",
      title: "👤 User Management",
      text: "Create and manage staff accounts, roles, and branch assignments.",
      badge: "Admin",
      action: () => router.push("/users/new"),
      roles: ["ADMIN"],
    },
    {
      key: "prereg",
      title: "🧾 Pre-registration",
      text: "Record an expected guest before they arrive. They are not a visitor on file until reception checks them in at Visit operations.",
      badge: "Front Desk",
      action: () => router.push("/preregistration"),
      roles: ["ADMIN", "RECEPTIONIST", "EMPLOYEE"],
    },
    {
      key: "visitors",
      title: "🙋 Visitors",
      text: "Checked-in people only: profiles created at Visit operations (walk-in, pre-registered, or self-service). View histories and details here-not pre-arrival lists.",
      badge: "Reception",
      href: "/visitors",
      roles: ["ADMIN", "RECEPTIONIST"],
    },
    {
      key: "visit-operations",
      title: "🛂 Visit operations",
      text: "Check in walk-ins, pre-registered guests, and self-service entries. Check-in creates the visitor profile you see under Visitors; finish ID details and consent QR here.",
      badge: "Reception",
      action: () => router.push("/visits"),
      roles: ["ADMIN", "RECEPTIONIST"],
    },
    {
      key: "dashboard",
      title: "📊 Dashboard",
      text: "Real-time snapshot of active visitors, expected arrivals, and site activity.",
      badge: "Insights",
      href: "/dashboard",
      roles: ["ADMIN", "RECEPTIONIST", "SECURITY"],
    },
    {
      key: "reports",
      title: "📁 Reports & Export",
      text: "Generate operational reports and export filtered data to CSV.",
      badge: "Reporting",
      href: "/reports",
      roles: ["ADMIN", "RECEPTIONIST"],
    },
    {
      key: "audit-logs",
      title: "🧾 Audit Logs",
      text: "Track login and user-management activities with rich filters.",
      badge: "Admin",
      href: "/audit-logs",
      roles: ["ADMIN", "SECURITY"],
    },
  ];

  const visibleCards = cards.filter((card) => (userRole ? card.roles.includes(userRole) : false));

  return (
    <main className={styles.page}>
      <AppHeader />
      {toast ? (
        <div style={{ position: "fixed", top: 80, right: 16, zIndex: 200 }}>
          <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 12px", fontWeight: 700 }}>
            {toast}
          </div>
        </div>
      ) : null}
      <div className={styles.shell}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Visipass Command Center</h1>
          <p className={styles.heroSub}>
            People become visitors only after check-in at Visit operations (walk-in, pre-registered, or self-service).
            Their profiles then appear under Visitors; earlier steps are expected arrivals, not visitor records.
          </p>
        </section>

        <section className={styles.stats}>
          <article className={styles.stat}>
            <p className={styles.statLabel}>👥 Currently On Site</p>
            <p className={styles.statValue}>{stats ? stats.currentlyOnSite : "—"}</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>📅 Expected Today</p>
            <p className={styles.statValue}>{stats ? stats.expectedToday : "—"}</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>📝 Pre-registrations</p>
            <p className={styles.statValue}>{stats ? stats.preRegistrations : "—"}</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>🚨 Alerts</p>
            <p className={styles.statValue}>2</p>
          </article>
        </section>

        {canManageCheckouts ? (
          <section
            style={{
              marginTop: 16,
              border: "1px solid var(--vp-card-border)",
              borderRadius: 12,
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
            {loadingActiveVisits ? (
              <div style={{ padding: 14 }}>
                <Preloader label="Loading visitors..." size="md" />
              </div>
            ) : activeVisits.length === 0 ? (
              <p style={{ margin: 0, padding: "14px", color: "var(--vp-subtitle)", fontSize: 14 }}>
                No visitors are currently checked in.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: "color-mix(in srgb, var(--brand-primary) 8%, white)" }}>
                      <th style={tableThStyle}>Visitor</th>
                      <th style={tableThStyle}>Employee to be visited</th>
                      <th style={tableThStyle}>Floor</th>
                      <th style={tableThStyle}>Checked in at</th>
                      <th style={tableThStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVisits.map((visit) => (
                      <tr key={visit.id}>
                        <td style={tableTdStyle}>{visit.visitor.fullName}</td>
                        <td style={tableTdStyle}>{visit.personToVisit || "—"}</td>
                        <td style={tableTdStyle}>{visit.visitFloor ? formatFloorLabel(visit.visitFloor) : "—"}</td>
                        <td style={tableTdStyle}>{visit.checkInAt ? new Date(visit.checkInAt).toLocaleString() : "—"}</td>
                        <td style={tableTdStyle}>
                          <button
                            type="button"
                            onClick={() => void checkOutVisit(visit.id)}
                            disabled={checkingOutId === visit.id}
                            style={checkOutButtonStyle}
                          >
                            {checkingOutId === visit.id ? "Checking out..." : "Check out"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        <h2 className={styles.sectionTitle}>System Functions</h2>
        <section className={styles.grid}>
          {visibleCards.map((card) =>
            card.href ? (
              <a key={card.key} className={styles.card} href={card.href}>
                <div className={styles.cardTop}>
                  <span className={styles.badge}>{card.badge}</span>
                  <span className={styles.arrow}>→</span>
                </div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardText}>{card.text}</p>
              </a>
            ) : (
              <button key={card.key} className={styles.card} onClick={card.action} type="button">
                <div className={styles.cardTop}>
                  <span className={styles.badge}>{card.badge}</span>
                  <span className={styles.arrow}>→</span>
                </div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardText}>{card.text}</p>
              </button>
            ),
          )}
        </section>
      </div>
    </main>
  );
}

function formatFloorLabel(floor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR") {
  if (floor === "GROUND_FLOOR") return "Ground Floor";
  if (floor === "FIRST_FLOOR") return "First Floor";
  return "Second Floor";
}

const tableThStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 800,
  color: "var(--vp-title)",
  borderBottom: "1px solid var(--vp-card-border)",
};

const tableTdStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--text)",
  borderBottom: "1px solid var(--vp-card-border)",
};

const checkOutButtonStyle: CSSProperties = {
  border: "1px solid var(--vp-card-border)",
  background: "var(--brand-primary)",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
