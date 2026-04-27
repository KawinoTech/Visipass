"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./audit-logs.module.css";

type AuditRow = {
  id: string;
  event: string;
  status: "SUCCESS" | "FAILURE";
  actorUserId: string | null;
  actorLoginId: string | null;
  targetUserId: string | null;
  targetLoginId: string | null;
  message: string | null;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [event, setEvent] = useState("");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<"ALL" | "SUCCESS" | "FAILURE">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (event.trim()) p.set("event", event.trim());
    if (actor.trim()) p.set("actor", actor.trim());
    if (target.trim()) p.set("target", target.trim());
    if (status !== "ALL") p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("take", "200");
    return p.toString();
  }, [event, actor, target, status, from, to]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?${queryString}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/home");
          return;
        }
        setLogs([]);
        return;
      }
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [queryString]);

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/home" className={styles.breadcrumbLink}>
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Back to Home
          </Link>
          <span className={styles.breadcrumbCurrent}>Audit logs</span>
        </nav>

        <section>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>Admin view for system activity: login, user create, and user update.</p>
        </section>

        <section className={styles.card}>
          <div className={styles.grid}>
            <input className={styles.input} value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Filter by event (e.g. USER_CREATE)" />
            <input className={styles.input} value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Filter by actor (login/user id)" />
            <input className={styles.input} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Filter by target (login/user id)" />
            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as "ALL" | "SUCCESS" | "FAILURE")}>
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
            <input className={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </section>

        <section className={styles.card}>
          {loading ? (
            <Preloader label="Loading audit logs..." size="lg" />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Message</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>{log.event}</td>
                      <td className={log.status === "SUCCESS" ? styles.success : styles.failure}>{log.status}</td>
                      <td>{log.actorLoginId || log.actorUserId || <span className={styles.muted}>-</span>}</td>
                      <td>{log.targetLoginId || log.targetUserId || <span className={styles.muted}>-</span>}</td>
                      <td>{log.message || <span className={styles.muted}>-</span>}</td>
                      <td>{log.ipAddress || <span className={styles.muted}>-</span>}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.muted}>No audit logs found for current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
