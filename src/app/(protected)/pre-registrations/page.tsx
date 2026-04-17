"use client";

import { useEffect, useState } from "react";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./pre-registrations.module.css";

type Item = {
  id: string;
  fullName: string;
  company: string | null;
  expectedAt: string;
  purpose: string | null;
  status: "PENDING" | "CONVERTED" | "CANCELLED";
  visitorId: string | null;
};

export default function PreRegistrationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [purpose, setPurpose] = useState("");

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/pre-registrations", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast("error", data?.message || "Failed to load pre-registrations.");
        return;
      }
      setItems((data?.items ?? []) as Item[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !company.trim() || !expectedAt || !purpose.trim()) {
      showToast("error", "Full name, company, expected date/time, and purpose are required.");
      return;
    }

    setSaving(true);
    try {
      const dt = new Date(expectedAt);
      const res = await fetch("/api/pre-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim(),
          expectedAt: dt.toISOString(),
          purpose: purpose.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast("error", data?.message || "Failed to create pre-registration.");
        return;
      }
      showToast("success", "Pre-registration created. Check in at Visit operations when the guest arrives.");
      setFullName("");
      setCompany("");
      setExpectedAt("");
      setPurpose("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      {toast ? (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.text}
        </div>
      ) : null}
      <section className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Pre-registration</h1>
          <p className={styles.subtitle}>
            Expected visitors are checked in under Visit operations, where a visitor profile and consent QR are handled.
          </p>
        </section>

        <section className={styles.card}>
          <form className={styles.grid} onSubmit={onSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>Visitor full name</label>
              <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Company</label>
              <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Expected date/time</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Purpose of visit</label>
              <textarea className={styles.textarea} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => void load()} disabled={loading}>
                Refresh
              </button>
              <button type="submit" className={styles.buttonPrimary} disabled={saving}>
                {saving ? "Saving..." : "Create pre-registration"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          {loading ? (
            <Preloader label="Loading pre-registrations..." size="lg" />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Expected at</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th>Visitor profile</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.fullName}</td>
                      <td>{new Date(it.expectedAt).toLocaleString()}</td>
                      <td>{it.purpose || "—"}</td>
                      <td
                        className={
                          it.status === "PENDING"
                            ? styles.pending
                            : it.status === "CONVERTED"
                              ? styles.converted
                              : styles.cancelled
                        }
                      >
                        {it.status}
                      </td>
                      <td>{it.visitorId ? "Created at check-in" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
