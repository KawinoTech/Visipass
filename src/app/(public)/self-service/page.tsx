"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./self-service.module.css";

type Locale = "en" | "sw";
type Step = "form" | "consent" | "welcome";
const PHONE_PREFIX = "+254";
const KENYAN_PHONE_LOCAL_REGEX = /^(?:7\d{8}|1\d{8})$/;

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
const ID_RULES = {
  "National ID": {
    maxLength: 8,
    regex: /^\d{7,8}$/,
    message: "National ID must be 7-8 digits (numbers only).",
  },
  Passport: {
    maxLength: 9,
    regex: /^[A-Za-z0-9]{6,9}$/,
    message: "Passport must be 6-9 alphanumeric characters.",
  },
  "Driving License": {
    maxLength: 12,
    regex: /^[A-Za-z0-9-]{6,12}$/,
    message: "Driving License must be 6-12 characters (letters, numbers, or -).",
  },
} as const;

function getIdNumberValidationError(idType: string, idNumber: string): string | null {
  if (!idType) return null;
  const normalized = idNumber.trim();
  if (!normalized) return "Document number is required.";
  const rule = ID_RULES[idType as keyof typeof ID_RULES];
  if (!rule) return null;
  if (!rule.regex.test(normalized)) return rule.message;
  return null;
}

type ExistingVisitor = {
  id: string;
  fullName: string;
  company: string | null;
  idNumber: string | null;
  phone: string | null;
  blacklisted: boolean;
};

function maskLastThreeDigits(value: string | null): string {
  if (!value) return "—";
  let hiddenDigits = 0;
  const chars = value.split("");
  for (let i = chars.length - 1; i >= 0 && hiddenDigits < 3; i -= 1) {
    if (/\d/.test(chars[i])) {
      chars[i] = "*";
      hiddenDigits += 1;
    }
  }
  return chars.join("");
}

export default function SelfServicePage() {
  const router = useRouter();
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
  const [phoneLocalDigits, setPhoneLocalDigits] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idNumberTouched, setIdNumberTouched] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchingVisitors, setSearchingVisitors] = useState(false);
  const [searchResults, setSearchResults] = useState<ExistingVisitor[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [recheckingVisitorId, setRecheckingVisitorId] = useState<string | null>(null);
  const idNumberValidationError = useMemo(
    () => (idNumberTouched ? getIdNumberValidationError(idType, idNumber) : null),
    [idType, idNumber, idNumberTouched]
  );

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
    setPhoneLocalDigits("");
    setIdType("");
    setIdNumber("");
    setIdNumberTouched(false);
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

    const trimmedFullName = fullName.trim();
    const trimmedCompany = company.trim();
    const trimmedPurpose = purpose.trim();
    const trimmedIdNumber = idNumber.trim();
    const normalizedPhone = phoneLocalDigits.trim();
    const hasPhoneValue = normalizedPhone.length > 0;
    const completePhone = hasPhoneValue ? `${PHONE_PREFIX}${normalizedPhone}` : null;
    const validationErrors: string[] = [];

    if (!trimmedFullName) validationErrors.push("full name");
    if (!trimmedPurpose) validationErrors.push("purpose");
    if (!idType) validationErrors.push("document type");
    if (!trimmedIdNumber) validationErrors.push("document number");

    if (trimmedFullName && trimmedFullName.length < 3) {
      validationErrors.push("full name must be at least 3 characters");
    }
    if (trimmedCompany && trimmedCompany.length < 2) {
      validationErrors.push("company must be at least 2 characters");
    }
    const idNumberRuleError = getIdNumberValidationError(idType, trimmedIdNumber);
    if (idNumberRuleError) validationErrors.push(idNumberRuleError);

    if (hasPhoneValue && !KENYAN_PHONE_LOCAL_REGEX.test(normalizedPhone)) {
      validationErrors.push("phone must be 9 digits in Kenyan format (7XXXXXXXX or 1XXXXXXXX)");
    }

    if (validationErrors.length > 0) {
      setIdNumberTouched(true);
      console.warn("[SelfService] Validation failed before submission", {
        reasons: validationErrors,
        phoneDigitsLength: normalizedPhone.length,
      });
      setError("Please complete all required fields correctly.");
      return;
    }
    console.info("[SelfService] Walk-in submission started", {
      hasPhone: hasPhoneValue,
      locale,
    });
    setSaving(true);
    try {
      const res = await fetch("/api/public/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedFullName,
          company: trimmedCompany,
          purpose: trimmedPurpose,
          phone: completePhone,
          idType,
          idNumber: trimmedIdNumber,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[SelfService] Walk-in submission failed", {
          status: res.status,
          message: data?.message ?? null,
        });
        setError(data?.message || "Check-in failed. Please ask reception for help.");
        return;
      }

      const id = data?.preRegistration?.id as string | undefined;
      console.info("[SelfService] Walk-in submission succeeded", {
        preRegistrationId: id ?? null,
      });
      setOkMessage("Thank you. Your details have been captured.");
      if (id) {
        router.push(`/visitor-consent?preRegistrationId=${encodeURIComponent(id)}`);
      }
    } catch (submitError) {
      console.error("[SelfService] Network error while submitting walk-in details", submitError);
      setError("Network error while submitting your details.");
    } finally {
      setSaving(false);
    }
  }

  async function searchExistingVisitors(query: string) {
    const q = query.trim();
    setError(null);
    setSearchingVisitors(true);
    try {
      const res = await fetch(`/api/public/visitors/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Could not search previous visitors.");
        setSearchResults([]);
        return;
      }
      setSearchResults((data?.items ?? []) as ExistingVisitor[]);
    } catch {
      setError("Network error while searching previous visitors.");
      setSearchResults([]);
    } finally {
      setSearchingVisitors(false);
    }
  }

  useEffect(() => {
    if (!searchOpen) return;
    const handle = window.setTimeout(() => {
      void searchExistingVisitors(searchTerm);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [searchTerm, searchOpen]);

  async function checkInExistingVisitor(visitor: ExistingVisitor) {
    if (recheckingVisitorId) return;
    setError(null);
    setOkMessage(null);
    setRecheckingVisitorId(visitor.id);
    try {
      const res = await fetch("/api/public/visitors/recheck-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: visitor.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "BLACKLISTED") {
          setError(
            locale === "sw"
              ? data?.messageSw || "Hatuwezi kukusajili kwa sasa, tafadhali pata msaada kutoka dawati la mapokezi."
              : data?.message || "Unable to check you in, please seek assistance from our Reception Desk.",
          );
          return;
        }
        setError(data?.message || (locale === "sw" ? "Imeshindikana kukusajili." : "Failed to check you in."));
        return;
      }

      const preRegistrationIdValue = data?.preRegistration?.id as string | undefined;
      if (!preRegistrationIdValue) {
        setError(locale === "sw" ? "Imeshindikana kuanzisha mchakato wa mapokezi." : "Failed to start reception flow.");
        return;
      }

      setPreRegistrationId(preRegistrationIdValue);
      if (data?.consentRequired) {
        router.push(`/visitor-consent?preRegistrationId=${encodeURIComponent(preRegistrationIdValue)}`);
        return;
      }

      setOkMessage(
        locale === "sw"
          ? "Umesajiliwa. Tafadhali endelea hadi mapokezi kwa mwongozo zaidi."
          : "Check-in request submitted. Please proceed to reception for further guidance.",
      );
      setStep("welcome");
    } catch {
      setError(locale === "sw" ? "Hitilafu ya mtandao wakati wa usajili." : "Network error while checking you in.");
    } finally {
      setRecheckingVisitorId(null);
    }
  }

  async function submitManualConsent() {
    if (!preRegistrationId || !manualChecked || submittingConsent || consentRecorded) return;
    setSubmittingConsent(true);
    setError(null);
    console.info("[SelfService] Manual consent submission started", {
      preRegistrationId,
    });
    try {
      const res = await fetch(`/api/public/pre-registrations/${encodeURIComponent(preRegistrationId)}/consent`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && res.status !== 200) {
        console.error("[SelfService] Manual consent submission failed", {
          preRegistrationId,
          status: res.status,
          message: data?.message ?? null,
        });
        setError(data?.message || "Could not record consent.");
        return;
      }
      console.info("[SelfService] Manual consent submission succeeded", {
        preRegistrationId,
      });
      setConsentRecorded(true);
      setStep("welcome");
    } catch (consentError) {
      console.error("[SelfService] Network error while recording manual consent", consentError);
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
              ? "Tunafurahi kukupokea. Jaza taarifa zako hapa; mapokezi yanakamilisha uingiaji katika Operesheni ya ziara—ndipo unasajiliwa kama mgeni kwenye mfumo (si kabla ya hatua hiyo)."
              : "We are delighted to host you. Complete your details below; reception finishes check-in at Visit operations—that step creates your visitor record on file (not before)."}
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
              <section className={styles.returningVisitorSection}>
                <h3 className={styles.returningTitle}>
                  {locale === "sw" ? "Mgeni aliyewahi kuingia?" : "Returning visitor?"}
                </h3>
                <p className={styles.returningHint}>
                  {locale === "sw"
                    ? "Tafuta kwa namba ya kitambulisho au jina (si nyeti kwa herufi kubwa/ndogo), kisha bofya Check in."
                    : "Search by ID number or name (case-insensitive), then click Check in."}
                </p>
                <div className={styles.returningSearchRow}>
                  <input
                    className={styles.input}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => {
                      setSearchOpen(true);
                      void searchExistingVisitors(searchTerm);
                    }}
                    placeholder={locale === "sw" ? "Mfano: 12345678 au Jane" : "Example: 12345678 or Jane"}
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setSearchOpen(true);
                      void searchExistingVisitors(searchTerm);
                    }}
                    disabled={searchingVisitors}
                  >
                    {searchingVisitors ? (locale === "sw" ? "Inatafuta..." : "Searching...") : locale === "sw" ? "Tafuta" : "Search"}
                  </button>
                </div>
                {searchOpen ? (
                  <div className={styles.searchResults}>
                    {searchResults.length === 0 && !searchingVisitors ? (
                      <p className={styles.searchEmpty}>
                        {locale === "sw"
                          ? "Hakuna rekodi inayolingana. Tafadhali jaza fomu hapa chini."
                          : "No matching records found. Please complete the form below."}
                      </p>
                    ) : null}
                    {searchResults.map((visitor) => (
                      <div key={visitor.id} className={styles.resultRow}>
                        <div className={styles.resultMeta}>
                          <strong>{visitor.fullName}</strong>
                          <small>
                            {locale === "sw" ? "Kitambulisho" : "ID"}: {maskLastThreeDigits(visitor.idNumber)} · {locale === "sw" ? "Simu" : "Phone"}:{" "}
                            {maskLastThreeDigits(visitor.phone)}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => void checkInExistingVisitor(visitor)}
                          disabled={recheckingVisitorId === visitor.id}
                        >
                          {recheckingVisitorId === visitor.id ? (locale === "sw" ? "Inachakata..." : "Processing...") : "Check in"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-user" aria-hidden /> {locale === "sw" ? "Jina kamili *" : "Full name *"}
                </span>
                <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-building" aria-hidden /> {locale === "sw" ? "Kampuni (si lazima)" : "Company (optional)"}
                </span>
                <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-phone" aria-hidden /> {locale === "sw" ? "Simu" : "Phone"}
                </span>
                <div className={styles.phoneInputGroup}>
                  <span className={styles.phonePrefix}>{PHONE_PREFIX}</span>
                  <input
                    className={styles.input}
                    value={phoneLocalDigits}
                    onChange={(e) => setPhoneLocalDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={locale === "sw" ? "Mfano: 712345678" : "Example: 712345678"}
                    aria-label={locale === "sw" ? "Nambari ya simu bila +254" : "Phone digits without +254"}
                  />
                </div>
              </label>
              <label className={styles.field}>
                <span>
                  <i className="fa-solid fa-passport" aria-hidden />{" "}
                  {locale === "sw" ? "Aina ya kitambulisho *" : "Document type *"}
                </span>
                <select
                  className={styles.input}
                  value={idType}
                  onChange={(e) => {
                    setIdType(e.target.value);
                    setIdNumberTouched(false);
                  }}
                >
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
                <input
                  className={styles.input}
                  value={idNumber}
                  maxLength={idType ? ID_RULES[idType as keyof typeof ID_RULES]?.maxLength : undefined}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (idType === "National ID") {
                      setIdNumber(nextValue.replace(/\D/g, "").slice(0, ID_RULES["National ID"].maxLength));
                      return;
                    }
                    const maxLength = idType ? ID_RULES[idType as keyof typeof ID_RULES]?.maxLength : undefined;
                    setIdNumber(maxLength ? nextValue.slice(0, maxLength) : nextValue);
                  }}
                  onBlur={() => setIdNumberTouched(true)}
                  placeholder={
                    idType === "National ID"
                      ? locale === "sw"
                        ? "Namba 7-8 (tarakimu pekee)"
                        : "7-8 digits only"
                      : idType === "Passport"
                        ? locale === "sw"
                          ? "Herufi/namba 6-9"
                          : "6-9 letters or numbers"
                        : idType === "Driving License"
                          ? locale === "sw"
                            ? "Herufi/namba/- (6-12)"
                            : "6-12 chars, letters/numbers/-"
                          : undefined
                  }
                />
                {idNumberValidationError ? <small className={styles.fieldErrorText}>{idNumberValidationError}</small> : null}
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

              <button type="submit" className={styles.button} disabled={saving}>
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
