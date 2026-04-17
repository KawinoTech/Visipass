"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppHeader from "../../components/header/AppHeader";
import { Preloader } from "../../components/ui/Preloader";
import styles from "../home-page.module.css";

export default function HomePage() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const FRONT_DESK_ROLES = new Set(["ADMIN", "RECEPTIONIST"]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) {
          router.replace("/login");
          return;
        }
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

  if (checkingAuth) {
    return (
      <main className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Preloader label="Checking session..." size="lg" />
      </main>
    );
  }

  if (!authenticated) return null;

  async function goToUserManagement() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.user?.role === "ADMIN") {
        router.push("/users/new");
        return;
      }
      setToast("Unauthorised");
      window.setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Unauthorised");
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  async function goToPreRegistration() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && FRONT_DESK_ROLES.has(data?.user?.role)) {
        router.push("/preregistration");
        return;
      }
      setToast("Unauthorised");
      window.setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Unauthorised");
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  async function goToVisitOperations() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && FRONT_DESK_ROLES.has(data?.user?.role)) {
        router.push("/visits");
        return;
      }
      setToast("Unauthorised");
      window.setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Unauthorised");
      window.setTimeout(() => setToast(null), 3000);
    }
  }

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
            Access visitor operations, security workflows, pre-registration, and admin tools from one place.
          </p>
        </section>

        <section className={styles.stats}>
          <article className={styles.stat}>
            <p className={styles.statLabel}>👥 Currently On Site</p>
            <p className={styles.statValue}>24</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>📅 Expected Today</p>
            <p className={styles.statValue}>41</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>📝 Pre-registrations</p>
            <p className={styles.statValue}>13</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>🚨 Alerts</p>
            <p className={styles.statValue}>2</p>
          </article>
        </section>

        <h2 className={styles.sectionTitle}>System Functions</h2>
        <section className={styles.grid}>
          <button className={styles.card} onClick={() => void goToUserManagement()} type="button">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Admin</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>👤 User Management</h3>
            <p className={styles.cardText}>Create and manage staff accounts, roles, and branch assignments.</p>
          </button>

          <button className={styles.card} onClick={() => void goToPreRegistration()} type="button">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Front Desk</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>🧾 Pre-registration</h3>
            <p className={styles.cardText}>
              Register name, company, arrival time, and purpose. Check-in and consent happen at Visit operations.
            </p>
          </button>

          <a className={styles.card} href="/visitors">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Reception</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>🙋 Visitors</h3>
            <p className={styles.cardText}>Maintain visitor profiles, blacklist checks, and visit histories.</p>
          </a>

          <button className={styles.card} onClick={() => void goToVisitOperations()} type="button">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Reception</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>🛂 Visit operations</h3>
            <p className={styles.cardText}>
              Check in walk-ins and pre-registered guests, add ID details at the desk, and show the QR code for data
              consent.
            </p>
          </button>

          <a className={styles.card} href="/dashboard">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Insights</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>📊 Dashboard</h3>
            <p className={styles.cardText}>Real-time snapshot of active visitors, expected arrivals, and site activity.</p>
          </a>

          <a className={styles.card} href="/reports">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Reporting</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>📁 Reports & Export</h3>
            <p className={styles.cardText}>Generate operational reports and export filtered data to CSV.</p>
          </a>

          <a className={styles.card} href="/audit-logs">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Admin</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>🧾 Audit Logs</h3>
            <p className={styles.cardText}>Track login and user-management activities with rich filters.</p>
          </a>
        </section>
      </div>
    </main>
  );
}
