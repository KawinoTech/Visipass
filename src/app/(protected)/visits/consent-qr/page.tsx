"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./consent-qr.module.css";

const TEST_PUBLIC_BASE_URL = "http://10.10.3.12:3000";

function ConsentQrInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId")?.trim() ?? "";

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [manualChecked, setManualChecked] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consentUrl = useMemo(() => {
    if (!visitId) return null;
    return `${TEST_PUBLIC_BASE_URL}/visitor-consent?visitId=${encodeURIComponent(visitId)}`;
  }, [visitId]);

  useEffect(() => {
    if (!consentUrl) return;
    let alive = true;
    (async () => {
      setQrLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/qr-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: consentUrl }),
        });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setError(data?.message || "Could not generate QR code.");
          return;
        }
        setQrDataUrl(data?.dataUrl ?? null);
      } catch {
        if (!alive) return;
        setError("Network error while generating QR code.");
      } finally {
        if (alive) setQrLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [consentUrl]);

  useEffect(() => {
    if (!visitId) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/visits/${encodeURIComponent(visitId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok) return;
        setConsentRecorded(Boolean(data?.visit?.visitorConsentAt));
      } catch {
        // ignore polling errors
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [visitId]);

  async function submitManualConsent() {
    if (!visitId || !manualChecked || manualSaving || consentRecorded) return;
    setManualSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/visits/${encodeURIComponent(visitId)}/consent`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Could not record consent.");
        return;
      }
      setConsentRecorded(true);
      setManualChecked(false);
    } catch {
      setError("Network error while recording consent.");
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Visitor consent (QR)</h1>
          <p className={styles.subtitle}>Ask the visitor to scan this code with their phone camera.</p>

          {!visitId ? <p className={styles.error}>Missing visit ID. Return to check-in and try again.</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          {visitId ? (
            <div className={`${styles.badge} ${consentRecorded ? styles.done : styles.pending}`} role="status">
              <i className={consentRecorded ? "fa-solid fa-circle-check" : "fa-solid fa-hourglass-half"} aria-hidden />
              {consentRecorded ? "Consent received" : "Waiting for visitor consent..."}
            </div>
          ) : null}

          {qrLoading ? (
            <Preloader label="Generating QR..." size="lg" />
          ) : qrDataUrl && visitId ? (
            <div className={styles.qrWrap}>
              <img src={qrDataUrl} alt="Visitor consent QR code" className={styles.qrImage} />
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={() => router.push("/visits")}>
                  <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} aria-hidden />
                  Back to check-in
                </button>
              </div>
            </div>
          ) : null}

          {consentUrl ? <p className={styles.linkHint}>{consentUrl}</p> : null}

          <p className={styles.statement}>
            By proceeding, you acknowledge and consent to the collection and processing of your personal data in
            accordance with the Data Protection Act, 2019 (Kenya), strictly for legitimate visitor management, security,
            and record-keeping purposes.
          </p>

          {!consentRecorded && visitId ? (
            <div className={styles.manualBox}>
              <label className={styles.manualLabel}>
                <input
                  type="checkbox"
                  checked={manualChecked}
                  onChange={(e) => setManualChecked(e.target.checked)}
                />
                Visitor cannot scan QR and consents manually to the statement above.
              </label>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => void submitManualConsent()}
                disabled={!manualChecked || manualSaving}
              >
                {manualSaving ? <Preloader label="Saving..." size="sm" /> : "Record manual consent"}
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default function ConsentQrPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <section className={styles.shell}>
            <section className={styles.card}>
              <Preloader label="Loading..." size="lg" />
            </section>
          </section>
        </main>
      }
    >
      <ConsentQrInner />
    </Suspense>
  );
}
