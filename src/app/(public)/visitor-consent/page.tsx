"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./visitor-consent.module.css";

const REDIRECT_DELAY_SECONDS = 7;

function VisitorConsentInner() {
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId")?.trim() ?? "";
  const preRegistrationId = searchParams.get("preRegistrationId")?.trim() ?? "";
  const returnTo = searchParams.get("returnTo")?.trim() ?? "";
  const activeForm = searchParams.get("activeForm")?.trim() ?? "";
  const autoCheckIn = searchParams.get("autoCheckIn")?.trim() ?? "";
  const personToVisitUserId = searchParams.get("personToVisitUserId")?.trim() ?? "";
  const phone = searchParams.get("phone")?.trim() ?? "";
  const idType = searchParams.get("idType")?.trim() ?? "";
  const idNumber = searchParams.get("idNumber")?.trim() ?? "";

  const context = useMemo(() => {
    if (visitId) return { kind: "visit" as const, id: visitId };
    if (preRegistrationId) return { kind: "preRegistration" as const, id: preRegistrationId };
    return { kind: "none" as const, id: "" };
  }, [visitId, preRegistrationId]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [alreadyConsented, setAlreadyConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    if (context.kind === "none") {
      setLoading(false);
      setError("Missing link. Please scan the QR code from reception again.");
      return;
    }

    let alive = true;
    (async () => {
      try {
        const path =
          context.kind === "visit"
            ? `/api/public/visits/${encodeURIComponent(context.id)}`
            : `/api/public/pre-registrations/${encodeURIComponent(context.id)}`;
        const res = await fetch(path, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setError(data?.message || "Could not load this visit.");
          return;
        }
        setFullName(data?.fullName ?? null);
        setAlreadyConsented(Boolean(data?.consentRecorded));
      } catch {
        if (!alive) return;
        setError("Network error. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [context.kind, context.id]);

  useEffect(() => {
    if (!alreadyConsented) return;
    setRedirecting(true);
    setRedirectCountdown(REDIRECT_DELAY_SECONDS);
    const countdownTimer = window.setInterval(() => {
      setRedirectCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    const timer = window.setTimeout(() => {
      if (returnTo) {
        const next = new URLSearchParams();
        next.set("consentDone", "1");
        if (autoCheckIn) next.set("autoCheckIn", autoCheckIn);
        if (preRegistrationId) next.set("preRegistrationId", preRegistrationId);
        if (activeForm) next.set("activeForm", activeForm);
        if (personToVisitUserId) next.set("personToVisitUserId", personToVisitUserId);
        if (phone) next.set("phone", phone);
        if (idType) next.set("idType", idType);
        if (idNumber) next.set("idNumber", idNumber);
        const target = `${returnTo}${next.toString() ? `?${next.toString()}` : ""}`;
        window.location.assign(target);
        return;
      }
      // Use full page navigation so the self-service desk resets completely for the next visitor.
      window.location.assign("/self-service");
    }, REDIRECT_DELAY_SECONDS * 1000);
    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(timer);
    };
  }, [alreadyConsented, autoCheckIn, returnTo, preRegistrationId, activeForm, personToVisitUserId, phone, idType, idNumber]);

  async function onConsent() {
    if (context.kind === "none") return;
    setSubmitting(true);
    setError(null);
    try {
      const path =
        context.kind === "visit"
          ? `/api/public/visits/${encodeURIComponent(context.id)}/consent`
          : `/api/public/pre-registrations/${encodeURIComponent(context.id)}/consent`;
      const res = await fetch(path, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok && res.status !== 200) {
        setError(data?.message || "Could not record consent.");
        return;
      }
      setDoneMessage(data?.message || "Thank you. Your consent has been recorded.");
      setAlreadyConsented(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            <Preloader label="Loading..." size="lg" />
          </section>
        </div>
      </main>
    );
  }

  const showButton = context.kind !== "none" && !alreadyConsented;
  const showAlready = context.kind !== "none" && alreadyConsented && !doneMessage;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Data processing consent</h1>
          <p className={styles.subtitle}>
            {fullName ? (
              <>
                Hello, <strong>{fullName}</strong>. Please confirm you agree to the processing of your personal data for
                this visit.
              </>
            ) : (
              <>Please confirm you agree to the processing of your personal data for this visit.</>
            )}
          </p>
          <p className={styles.body}>
            By proceeding, you acknowledge and consent to the collection and processing of your personal data in
            accordance with the Data Protection Act, 2019 (Kenya), strictly for legitimate visitor management, security,
            and record-keeping purposes.
          </p>

          {error ? <p className={styles.error}>{error}</p> : null}
          {doneMessage ? <p className={styles.success}>{doneMessage}</p> : null}
          {redirecting ? (
            <div className={styles.confirmationNote} role="status" aria-live="polite">
              <span className={styles.tickIcon} aria-hidden>
                <i className="fa-solid fa-circle-check" />
              </span>
              <div className={styles.confirmationText}>
                <p>Please Proceed to our Reception Desk for further guidance once consent is obtained.</p>
                <p className={styles.redirectHint}>
                  Returning to {returnTo ? "visit operations" : "self-service"} in {redirectCountdown}s...
                </p>
              </div>
            </div>
          ) : null}

          {showButton ? (
            <button type="button" className={styles.buttonPrimary} onClick={() => void onConsent()} disabled={submitting}>
              {submitting ? <Preloader label="Saving..." size="sm" /> : "I agree"}
            </button>
          ) : null}

          {showAlready ? (
            <p className={styles.success}>Consent is already on file for this visit. You can close this page.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function VisitorConsentPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <div className={styles.shell}>
            <section className={styles.card}>
              <Preloader label="Loading..." size="lg" />
            </section>
          </div>
        </main>
      }
    >
      <VisitorConsentInner />
    </Suspense>
  );
}
