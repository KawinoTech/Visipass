"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./self-service.module.css";

type Host = {
  id: string;
  fullName: string;
  location: string;
  floor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR" | null;
};

type Locale = "en" | "sw";
type Step = "form" | "consent" | "welcome";

const ID_TYPES = [
  { value: "Passport", en: "Passport", sw: "Pasipoti" },
  { value: "Driving License", en: "Driving License", sw: "Leseni ya Udereva" },
  { value: "National ID", en: "National ID", sw: "Kitambulisho cha Taifa" },
] as const;
const PURPOSE_OPTIONS = [
  { value: "Delivery", en: "Delivery", sw: "Uwasilishaji" },
  { value: "Insurance claim follow-up", en: "Insurance claim follow-up", sw: "Ufuatiliaji wa madai ya bima" },
  { value: "Insurance policy inquiry", en: "Insurance policy inquiry", sw: "Swali kuhusu sera ya bima" },
  { value: "Premium payment", en: "Premium payment", sw: "Malipo ya premium" },
  { value: "Document submission", en: "Document submission", sw: "Uwasilishaji wa nyaraka" },
  { value: "Meeting with staff", en: "Meeting with staff", sw: "Mkutano na wafanyakazi" },
  { value: "Customer service support", en: "Customer service support", sw: "Huduma kwa wateja" },
  { value: "Interview / recruitment", en: "Interview / recruitment", sw: "Usaili / ajira" },
  { value: "Maintenance / technical support", en: "Maintenance / technical support", sw: "Matengenezo / msaada wa kiufundi" },
  { value: "Other official business", en: "Other official business", sw: "Shughuli nyingine rasmi" },
] as const;

export default function SelfServicePage() {
  const router = useRouter();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [step, setStep] = useState<Step>("form");
  const [preRegistrationId, setPreRegistrationId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualChecked, setManualChecked] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState(false);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [purpose, setPurpose] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const defaultHost = useMemo(() => hosts[0] ?? null, [hosts]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/public/walk-in", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setError(data?.message || "Failed to load hosts.");
          return;
        }
        setHosts((data?.hosts ?? []) as Host[]);
      } catch {
        if (!alive) return;
        setError("Network error while loading host list.");
      } finally {
        if (alive) setLoadingHosts(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (locale === "sw") {
      if (hour < 12) return "Habari za asubuhi na karibu!";
      if (hour < 17) return "Habari za mchana na karibu!";
      return "Habari za jioni na karibu!";
    }
    if (hour < 12) return "Good morning and karibu!";
    if (hour < 17) return "Good afternoon and welcome!";
    return "Good evening and welcome!";
  }, [locale]);

  const consentUrl = useMemo(() => {
    if (!preRegistrationId || typeof window === "undefined") return null;
    return `${window.location.origin}/visitor-consent?preRegistrationId=${encodeURIComponent(preRegistrationId)}`;
  }, [preRegistrationId]);

  function resetFlow() {
    setStep("form");
    setPreRegistrationId(null);
    setQrDataUrl(null);
    setManualChecked(false);
    setConsentRecorded(false);
    setError(null);
    setOkMessage(null);
    setFullName("");
    setCompany("");
    setPurpose("");
    setPhone("");
    setIdType("");
    setIdNumber("");
  }

  useEffect(() => {
    if (step !== "consent" || !consentUrl) return;
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
  }, [step, consentUrl]);

  useEffect(() => {
    if (step !== "consent" || !preRegistrationId || consentRecorded) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/public/pre-registrations/${encodeURIComponent(preRegistrationId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok) return;
        if (Boolean(data?.consentRecorded)) {
          setConsentRecorded(true);
          setStep("welcome");
        }
      } catch {
        // Ignore temporary polling failures.
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [step, preRegistrationId, consentRecorded]);

  useEffect(() => {
    if (step !== "welcome") return;
    const timer = window.setTimeout(() => {
      resetFlow();
      window.location.reload();
    }, 10000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [step]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMessage(null);

    if (
      !fullName.trim() ||
      !company.trim() ||
      !purpose.trim() ||
      !idType ||
      !idNumber.trim() ||
      !defaultHost
    ) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/public/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim(),
          purpose: purpose.trim(),
          phone: phone.trim() || null,
          idType,
          idNumber: idNumber.trim(),
          hostUserId: defaultHost.id,
          personToVisit: defaultHost.fullName,
          visitFloor: defaultHost.floor ?? "GROUND_FLOOR",
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Check-in failed. Please ask reception for help.");
        return;
      }

      const id = data?.preRegistration?.id as string | undefined;
      setOkMessage("Thank you. Your details have been captured.");
      if (id) {
        router.push(`/visitor-consent?preRegistrationId=${encodeURIComponent(id)}`);
      }
    } catch {
      setError("Network error while submitting your details.");
    } finally {
      setSaving(false);
    }
  }

  async function submitManualConsent() {
    if (!preRegistrationId || !manualChecked || submittingConsent || consentRecorded) return;
    setSubmittingConsent(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/pre-registrations/${encodeURIComponent(preRegistrationId)}/consent`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && res.status !== 200) {
        setError(data?.message || "Could not record consent.");
        return;
      }
      setConsentRecorded(true);
      setStep("welcome");
    } catch {
      setError("Network error while recording consent.");
    } finally {
      setSubmittingConsent(false);
      setManualChecked(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <img src="/images/mua-logo.png" alt="MUA Logo" className={styles.logoImage} />
          <p className={styles.logoText}>VISIPASS SELF-SERVICE</p>
          <div className={styles.languageToggle}>
            <button
              type="button"
              className={`${styles.languageButton} ${locale === "en" ? styles.languageButtonActive : ""}`}
              onClick={() => setLocale("en")}
            >
              English
            </button>
            <button
              type="button"
              className={`${styles.languageButton} ${locale === "sw" ? styles.languageButtonActive : ""}`}
              onClick={() => setLocale("sw")}
            >
              Kiswahili
            </button>
          </div>
          <h1 className={styles.title}>{greeting}</h1>
          <p className={styles.subtitle}>
            {locale === "sw"
              ? "Tunafurahi kukupokea. Tafadhali jaza taarifa zako hapa chini kwa mchakato rahisi na salama wa kuingia."
              : "We are delighted to host you. Complete your walk-in details below for a smooth and secure check-in experience."}
          </p>
        </div>
        <p className={styles.meta}>MUA Kenya - Visitor Management</p>
      </section>

      <section className={styles.contentPanel}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {step === "form"
                ? locale === "sw"
                  ? "Taarifa za mgeni"
                  : "Walk-in details"
                : step === "consent"
                  ? locale === "sw"
                    ? "Ridhaa ya mchakato wa data"
                    : "Data processing consent"
                  : locale === "sw"
                    ? "Karibu MUA"
                    : "Welcome to MUA"}
            </h2>
            <p className={styles.cardSubtitle}>
              {step === "form"
                ? locale === "sw"
                  ? "Sehemu zenye alama * ni lazima."
                  : "Fields marked with * are required."
                : step === "consent"
                  ? locale === "sw"
                    ? "Tafadhali skani QR au rekodi ridhaa kwa mkono."
                    : "Please scan the QR code or record manual consent."
                  : locale === "sw"
                    ? "Ukurasa utajisafisha ndani ya sekunde 10."
                    : "This page will reset in 10 seconds."}
            </p>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {okMessage ? <p className={styles.success}>{okMessage}</p> : null}

          {step === "form" ? (
            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-user" aria-hidden /> {locale === "sw" ? "Jina kamili *" : "Full name *"}
                </span>
                <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-building" aria-hidden /> {locale === "sw" ? "Kampuni *" : "Company *"}
                </span>
                <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-phone" aria-hidden /> {locale === "sw" ? "Simu" : "Phone"}
                </span>
                <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-passport" aria-hidden />{" "}
                  {locale === "sw" ? "Aina ya kitambulisho *" : "Document type *"}
                </span>
                <select className={styles.input} value={idType} onChange={(e) => setIdType(e.target.value)}>
                  <option value="">{locale === "sw" ? "Chagua aina" : "Select type"}</option>
                  {ID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {locale === "sw" ? t.sw : t.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-hashtag" aria-hidden />{" "}
                  {locale === "sw" ? "Namba ya kitambulisho *" : "Document number *"}
                </span>
                <input className={styles.input} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-briefcase" aria-hidden />{" "}
                  {locale === "sw" ? "Madhumuni ya ziara *" : "Purpose of visit *"}
                </span>
                <select className={styles.input} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  <option value="">{locale === "sw" ? "Chagua madhumuni" : "Select purpose"}</option>
                  {PURPOSE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {locale === "sw" ? item.sw : item.en}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className={styles.button} disabled={saving || loadingHosts}>
                {saving ? (
                  <Preloader label="Submitting..." size="sm" />
                ) : locale === "sw" ? (
                  "Wasilisha taarifa"
                ) : (
                  "Submit walk-in details"
                )}
              </button>
            </form>
          ) : null}

          {step === "consent" ? (
            <section className={styles.consentPanel}>
              <div className={`${styles.badge} ${consentRecorded ? styles.done : styles.pending}`} role="status">
                <i className={consentRecorded ? "fa-solid fa-circle-check" : "fa-solid fa-hourglass-half"} aria-hidden />
                {consentRecorded
                  ? locale === "sw"
                    ? "Ridhaa imepokelewa"
                    : "Consent received"
                  : locale === "sw"
                    ? "Inasubiri ridhaa ya mgeni..."
                    : "Waiting for visitor consent..."}
              </div>
              {qrLoading ? (
                <Preloader label={locale === "sw" ? "Inazalisha QR..." : "Generating QR..."} size="lg" />
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt="Visitor consent QR code" className={styles.qrImage} />
              ) : null}
              <p className={styles.linkHint}>{consentUrl}</p>
              <label className={styles.manualLabel}>
                <input type="checkbox" checked={manualChecked} onChange={(e) => setManualChecked(e.target.checked)} />
                {locale === "sw"
                  ? "Mgeni hawezi kuskani QR na anatoa ridhaa kwa mkono."
                  : "Visitor cannot scan QR and consents manually."}
              </label>
              <button
                type="button"
                className={styles.button}
                onClick={() => void submitManualConsent()}
                disabled={!manualChecked || submittingConsent || consentRecorded}
              >
                {submittingConsent ? (
                  <Preloader label={locale === "sw" ? "Inahifadhi..." : "Saving..."} size="sm" />
                ) : locale === "sw" ? (
                  "Rekodi ridhaa ya mkono"
                ) : (
                  "Record manual consent"
                )}
              </button>
            </section>
          ) : null}

          {step === "welcome" ? (
            <section className={styles.welcomePanel}>
              <p className={styles.welcomeText}>Welcome to MUA, please proceed to our reception</p>
              <p className={styles.welcomeTextSw}>Karibu MUA, tafadhali endelea hadi mapokezi yetu</p>
              <img src="/images/mua-logo.png" alt="MUA Logo" className={styles.welcomeLogo} />
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
