"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./reports.module.css";

type SummaryResponse = {
  range: { from: string; to: string };
  totals: {
    totalVisits: number;
    todayVisits: number;
    currentlyOnSite: number;
    uniqueVisitors: number;
    checkedIn: number;
    checkedOut: number;
    cancelled: number;
    pending: number;
  };
  timings: {
    avgVisitMinutes: number;
    timingByHour: Array<{ hour: number; count: number }>;
  };
  security: {
    blacklistedVisitors: number;
    visitsWithConsent: number;
    visitsWithoutConsent: number;
    consentRatePct: number;
  };
  activityByDay: Array<{ date: string; count: number }>;
  floorDistribution: Array<{ label: string; count: number }>;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function ymdDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function barWidth(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [fromDate, setFromDate] = useState(ymdDaysAgo(29));
  const [toDate, setToDate] = useState(todayYmd());
  const [quickRange, setQuickRange] = useState<"7" | "30" | "90">("30");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    return p.toString();
  }, [fromDate, toDate]);

  async function loadReports() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/summary?${queryString}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/home");
          return;
        }
        setError(data?.message || "Failed to load reports.");
        setSummary(null);
        return;
      }
      setSummary(data as SummaryResponse);
    } catch {
      setError("Network error while loading reports.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [queryString]);

  const activityMax = Math.max(...(summary?.activityByDay.map((item) => item.count) ?? [0]));
  const hourlyMax = Math.max(...(summary?.timings.timingByHour.map((item) => item.count) ?? [0]));
  const floorMax = Math.max(...(summary?.floorDistribution.map((item) => item.count) ?? [0]));

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/home" className={styles.breadcrumbLink}>
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Back to Home
          </Link>
          <span className={styles.breadcrumbCurrent}>Reports and exports</span>
        </nav>
        <section className={`${styles.card} ${styles.hero}`}>
          <h1 className={styles.title}>Reports & Export</h1>
          <p className={styles.subtitle}>
            Visual reports for visitor activity, visit timing patterns, and security signals. Download raw data for compliance and operational analysis.
          </p>
          <div className={styles.row} style={{ marginTop: 10 }}>
            <a className={styles.buttonPrimary} href={`/api/reports/visits.csv?${queryString}`}>
              Download Visits CSV
            </a>
            <a className={styles.button} href={`/api/reports/visitors.csv?${queryString}`}>
              Download Visitors CSV
            </a>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Filter Range</h2>
          <div className={styles.filters}>
            <div>
              <p className={styles.label}>From date</p>
              <input className={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <p className={styles.label}>To date</p>
              <input className={styles.input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <p className={styles.label}>Quick range</p>
              <select
                className={styles.select}
                value={quickRange}
                onChange={(e) => {
                  const next = e.target.value as "7" | "30" | "90";
                  const days = Number(next);
                  setQuickRange(next);
                  setToDate(todayYmd());
                  setFromDate(ymdDaysAgo(days - 1));
                }}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </div>
        </section>

        {loading ? (
          <section className={styles.card}>
            <Preloader label="Loading reports..." size="lg" />
          </section>
        ) : error ? (
          <section className={styles.card}>
            <p className={styles.error}>{error}</p>
          </section>
        ) : summary ? (
          <>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Visitor Activity Snapshot</h2>
              <div className={styles.kpiGrid}>
                <article className={styles.kpi}><p className={styles.kpiLabel}>Total visits</p><p className={styles.kpiValue}>{summary.totals.totalVisits}</p></article>
                <article className={styles.kpi}><p className={styles.kpiLabel}>Unique visitors</p><p className={styles.kpiValue}>{summary.totals.uniqueVisitors}</p></article>
                <article className={styles.kpi}><p className={styles.kpiLabel}>Today visits</p><p className={styles.kpiValue}>{summary.totals.todayVisits}</p></article>
                <article className={styles.kpi}><p className={styles.kpiLabel}>Currently on site</p><p className={styles.kpiValue}>{summary.totals.currentlyOnSite}</p></article>
              </div>
            </section>

            <section className={styles.vizGrid}>
              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Daily Activity</h3>
                <div className={styles.bars}>
                  {summary.activityByDay.map((entry) => (
                    <div key={entry.date} className={styles.barRow}>
                      <span className={styles.barLabel}>{entry.date.slice(5)}</span>
                      <span className={styles.barTrack}><span className={styles.barFillBlue} style={{ width: barWidth(entry.count, activityMax) }} /></span>
                      <span className={styles.barValue}>{entry.count}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Status Mix</h3>
                <div className={styles.kpiGrid}>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Checked In</p><p className={styles.kpiValue}>{summary.totals.checkedIn}</p></article>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Checked Out</p><p className={styles.kpiValue}>{summary.totals.checkedOut}</p></article>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Pending</p><p className={styles.kpiValue}>{summary.totals.pending}</p></article>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Cancelled</p><p className={styles.kpiValue}>{summary.totals.cancelled}</p></article>
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Check-in Timing (By Hour)</h3>
                <div className={styles.bars}>
                  {summary.timings.timingByHour.map((entry) => (
                    <div key={entry.hour} className={styles.barRow}>
                      <span className={styles.barLabel}>{String(entry.hour).padStart(2, "0")}:00</span>
                      <span className={styles.barTrack}><span className={styles.barFillGreen} style={{ width: barWidth(entry.count, hourlyMax) }} /></span>
                      <span className={styles.barValue}>{entry.count}</span>
                    </div>
                  ))}
                </div>
                <p className={styles.muted} style={{ marginTop: 10 }}>Average visit duration: {summary.timings.avgVisitMinutes} minutes</p>
              </article>

              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Security Signals</h3>
                <div className={styles.kpiGrid}>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Blacklisted visitors</p><p className={styles.kpiValue}>{summary.security.blacklistedVisitors}</p></article>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>With consent</p><p className={styles.kpiValue}>{summary.security.visitsWithConsent}</p></article>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Without consent</p><p className={styles.kpiValue}>{summary.security.visitsWithoutConsent}</p></article>
                  <article className={styles.kpi}><p className={styles.kpiLabel}>Consent rate</p><p className={styles.kpiValue}>{summary.security.consentRatePct}%</p></article>
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.sectionTitle}>Floor Distribution</h3>
                <div className={styles.bars}>
                  {summary.floorDistribution.map((entry) => (
                    <div key={entry.label} className={styles.barRow}>
                      <span className={styles.barLabel}>{entry.label}</span>
                      <span className={styles.barTrack}><span className={styles.barFillOrange} style={{ width: barWidth(entry.count, floorMax) }} /></span>
                      <span className={styles.barValue}>{entry.count}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
