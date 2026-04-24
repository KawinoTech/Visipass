"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./visits.module.css";

type PreRegItem = {
  id: string;
  fullName: string;
  company: string | null;
  phone: string | null;
  idType: string | null;
  idNumber: string | null;
  expectedAt: string;
  purpose: string | null;
  personToVisit: string | null;
  visitFloor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR" | null;
  status: "PENDING" | "CONVERTED" | "CANCELLED";
  visitorConsentAt: string | null;
  notes: string | null;
};
type EmployeeOption = {
  id: string;
  fullName: string;
  email: string;
  floor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR" | null;
};

const ID_TYPES = ["Passport", "Driving License", "National ID"] as const;
const BLACKLISTED_VISITOR_TOAST = "This guest is cyrrently blacklisted kindly contact security";

/** Kenya mobile: +254 + up to 9 national digits (e.g. 7XXXXXXXX). */
const KE_PHONE_LOCAL_MAX_DIGITS = 9;
const NATIONAL_ID_MAX_DIGITS = 12;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Local digits after +254 for display/editing (no leading 0). */
function parseKeLocalFromStored(phone: string | null | undefined): string {
  if (!phone?.trim()) return "";
  let d = digitsOnly(phone);
  if (d.startsWith("254")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, KE_PHONE_LOCAL_MAX_DIGITS);
}

function formatKePhoneE164(localDigits: string): string | null {
  const d = digitsOnly(localDigits).slice(0, KE_PHONE_LOCAL_MAX_DIGITS);
  if (!d) return null;
  return `+254${d}`;
}

function sanitizeIdNumberInput(value: string, idType: string): string {
  if (idType === "National ID") {
    return digitsOnly(value).slice(0, NATIONAL_ID_MAX_DIGITS);
  }
  return value;
}

function resolveCheckInErrorMessage(data: { message?: string; code?: string } | null): string {
  const rawMessage = (data?.message || "").toLowerCase();
  if (data?.code === "BLACKLISTED" || rawMessage.includes("blacklisted")) {
    return BLACKLISTED_VISITOR_TOAST;
  }
  if (data?.code === "TOO_EARLY" || rawMessage.includes("on or after the expected date")) {
    return "This visitor is scheduled for a future date. Check-in is allowed from the expected date.";
  }
  return data?.message || "Check-in failed.";
}

const PURPOSE_OPTIONS = [
  "Delivery",
  "Insurance claim follow-up",
  "Insurance policy inquiry",
  "Premium payment",
  "Document submission",
  "Meeting with staff",
  "Customer service support",
  "Interview / recruitment",
  "Maintenance / technical support",
  "Other official business",
] as const;

function isVisitorDirectoryPreReg(pre: PreRegItem | null | undefined) {
  return (pre?.notes || "").toLowerCase().includes("visitor_directory_preregister");
}

export default function VisitsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeForm, setActiveForm] = useState<"pre_registered" | "walk_in" | "self_serviced">("pre_registered");
  const [preRegs, setPreRegs] = useState<PreRegItem[]>([]);
  const [loadingPreRegs, setLoadingPreRegs] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [walkFullName, setWalkFullName] = useState("");
  const [walkCompany, setWalkCompany] = useState("");
  const [walkPurpose, setWalkPurpose] = useState("");
  const [walkPersonToVisit, setWalkPersonToVisit] = useState("");
  const [walkSelectedEmployee, setWalkSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [walkEmployeeListOpen, setWalkEmployeeListOpen] = useState(false);
  const [walkPhone, setWalkPhone] = useState("");
  const [walkIdType, setWalkIdType] = useState("");
  const [walkIdNumber, setWalkIdNumber] = useState("");
  const [walkSaving, setWalkSaving] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [selectedPreId, setSelectedPreId] = useState("");
  const [prePhone, setPrePhone] = useState("");
  const [prePersonToVisit, setPrePersonToVisit] = useState("");
  const [preSelectedEmployee, setPreSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [preEmployeeListOpen, setPreEmployeeListOpen] = useState(false);
  const [preIdType, setPreIdType] = useState("");
  const [preIdNumber, setPreIdNumber] = useState("");
  const [preSaving, setPreSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        const role = data?.user?.role;
        if (res.ok && (role === "ADMIN" || role === "RECEPTIONIST")) {
          setAccessAllowed(true);
          return;
        }
        router.replace("/home");
      } catch {
        if (!alive) return;
        router.replace("/home");
      } finally {
        if (alive) setCheckingAccess(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  }

  function resolveEmployeeForVisit(rawInput: string, selected: EmployeeOption | null): EmployeeOption | null {
    const normalizedQuery = rawInput.trim().toLowerCase();
    const matchedEmployee = employeeOptions.find(
      (employee) =>
        employee.fullName.toLowerCase() === normalizedQuery || employee.email.toLowerCase() === normalizedQuery,
    );
    return selected ?? matchedEmployee ?? null;
  }

  const loadPreRegs = useCallback(async () => {
    setLoadingPreRegs(true);
    try {
      const res = await fetch("/api/pre-registrations", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast("error", data?.message || "Failed to load pre-registrations.");
        return;
      }
      setPreRegs((data?.items ?? []) as PreRegItem[]);
    } finally {
      setLoadingPreRegs(false);
    }
  }, []);

  useEffect(() => {
    void loadPreRegs();
  }, [loadPreRegs]);

  useEffect(() => {
    let mounted = true;

    async function loadEmployees() {
      setLoadingEmployees(true);
      try {
        const res = await fetch("/api/employees?limit=100", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load employees.");
        }

        if (mounted) {
          setEmployeeOptions((data?.employees ?? []) as EmployeeOption[]);
        }
      } catch {
        if (mounted) {
          showToast("error", "Could not load employees for Who is being visited.");
        }
      } finally {
        if (mounted) setLoadingEmployees(false);
      }
    }

    void loadEmployees();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPre = preRegs.find((p) => p.id === selectedPreId) ?? null;

  useEffect(() => {
    setSelectedPreId("");
    setPrePhone("");
    setPrePersonToVisit("");
    setPreSelectedEmployee(null);
    setPreEmployeeListOpen(false);
    setPreIdType("");
    setPreIdNumber("");
  }, [activeForm]);

  useEffect(() => {
    if (!selectedPre) {
      setPrePersonToVisit("");
      setPreSelectedEmployee(null);
      setPreEmployeeListOpen(false);
      setPrePhone("");
      setPreIdType("");
      setPreIdNumber("");
      return;
    }
    // For repeat preregistrations created from Visitors, host must be selected afresh at check-in.
    setPrePersonToVisit(isVisitorDirectoryPreReg(selectedPre) ? "" : (selectedPre.personToVisit ?? ""));
    setPreSelectedEmployee(null);
    setPreEmployeeListOpen(false);
    setPrePhone(parseKeLocalFromStored(selectedPre.phone));
    setPreIdType(selectedPre.idType ?? "");
    setPreIdNumber(selectedPre.idNumber ?? "");
  }, [selectedPre]);

  async function runPreRegistrationCheckIn(args: {
    preRegistrationId: string;
    personToVisit: string;
    personToVisitUserId: string;
    phone: string | null;
    idType: string;
    idNumber: string;
    selectedPreRecord?: PreRegItem | null;
  }) {
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pre_registered",
        preRegistrationId: args.preRegistrationId,
        personToVisit: args.personToVisit,
        personToVisitUserId: args.personToVisitUserId,
        phone: args.phone,
        idType: args.idType,
        idNumber: args.idNumber,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast("error", resolveCheckInErrorMessage(data));
      return false;
    }
    const vid = data?.visit?.id as string | undefined;
    if (vid) {
      const checkedInLabel = args.selectedPreRecord?.notes?.toLowerCase().includes("self-service")
        ? "Self-serviced visitor"
        : "Pre-registered visitor";
      if (data?.consentRequired) {
        showToast("success", `${checkedInLabel} checked in. Opening the consent QR page...`);
        router.push(`/visits/consent-qr?visitId=${encodeURIComponent(vid)}`);
      } else {
        showToast("success", `${checkedInLabel} checked in. Consent still valid; QR skipped.`);
      }
    }
    setSelectedPreId("");
    setPrePhone("");
    setPrePersonToVisit("");
    setPreIdType("");
    setPreIdNumber("");
    await loadPreRegs();
    return true;
  }


  async function onWalkInSubmit(e: React.FormEvent) {
    e.preventDefault();

    const rawPersonToVisit = walkPersonToVisit.trim();
    const resolvedEmployee = resolveEmployeeForVisit(rawPersonToVisit, walkSelectedEmployee);

    if (!walkFullName.trim() || !walkCompany.trim() || !walkPurpose.trim() || !resolvedEmployee) {
      showToast("error", "Full name, company, purpose, and who is being visited are required.");
      return;
    }
    if (!resolvedEmployee.floor) {
      showToast("error", "Selected employee has no assigned floor.");
      return;
    }
    if (!walkIdType || !walkIdNumber.trim()) {
      showToast("error", "Document type and document number are required.");
      return;
    }
    setWalkSaving(true);
    try {
      const payload = {
        type: "walk_in" as const,
        fullName: walkFullName.trim(),
        company: walkCompany.trim(),
        purpose: walkPurpose.trim(),
        personToVisit: resolvedEmployee.fullName,
        personToVisitUserId: resolvedEmployee.id,
        phone: formatKePhoneE164(walkPhone),
        idType: walkIdType,
        idNumber: walkIdNumber.trim(),
      };

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast("error", resolveCheckInErrorMessage(data));
        return;
      }
      const vid = data?.visit?.id as string | undefined;
      if (vid) {
        showToast("success", "Visitor checked in. Opening the consent QR page...");
        router.push(`/visits/consent-qr?visitId=${encodeURIComponent(vid)}`);
      }
      setWalkFullName("");
      setWalkCompany("");
      setWalkPurpose("");
      setWalkPersonToVisit("");
      setWalkSelectedEmployee(null);
      setWalkEmployeeListOpen(false);
      setWalkPhone("");
      setWalkIdType("");
      setWalkIdNumber("");
    } finally {
      setWalkSaving(false);
    }
  }

  async function onPreRegisteredSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPreId) {
      showToast("error", "Select a pre-registered guest.");
      return;
    }
    const rawPersonToVisit = prePersonToVisit.trim();
    const resolvedEmployee = resolveEmployeeForVisit(rawPersonToVisit, preSelectedEmployee);
    if (!resolvedEmployee) {
      showToast("error", "Please select who is being visited (required for check-in).");
      return;
    }
    if (!resolvedEmployee.floor) {
      showToast("error", "Selected employee has no assigned floor.");
      return;
    }
    const lockedPersonalDetails = activeForm === "self_serviced" || isVisitorDirectoryPreReg(selectedPre);
    const resolvedPhone = lockedPersonalDetails ? selectedPre?.phone ?? null : formatKePhoneE164(prePhone);
    const resolvedIdType = lockedPersonalDetails ? selectedPre?.idType ?? "" : preIdType;
    const resolvedIdNumber = lockedPersonalDetails ? selectedPre?.idNumber ?? "" : preIdNumber.trim();

    if (!resolvedIdType || !resolvedIdNumber) {
      showToast("error", "Document type and document number are required.");
      return;
    }
    setPreSaving(true);
    try {
      await runPreRegistrationCheckIn({
        preRegistrationId: selectedPreId,
        personToVisit: resolvedEmployee.fullName,
        personToVisitUserId: resolvedEmployee.id,
        phone: resolvedPhone,
        idType: resolvedIdType,
        idNumber: resolvedIdNumber,
        selectedPreRecord: selectedPre,
      });
    } finally {
      setPreSaving(false);
    }
  }

  const pendingPreRegs = preRegs.filter((p) => p.status === "PENDING");
  const pendingSelfServiced = pendingPreRegs.filter((p) => (p.notes || "").toLowerCase().includes("self-service"));
  const pendingManualPreRegs = pendingPreRegs.filter((p) => !(p.notes || "").toLowerCase().includes("self-service"));
  const activePreRegItems = activeForm === "self_serviced" ? pendingSelfServiced : pendingManualPreRegs;
  const filteredPreRegs = activePreRegItems.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.company || "").toLowerCase().includes(q) ||
      (p.purpose || "").toLowerCase().includes(q)
    );
  });
  const matchingWalkEmployees = useMemo(() => {
    if (walkSelectedEmployee) return [];

    const q = walkPersonToVisit.trim().toLowerCase();
    if (!q) return employeeOptions.slice(0, 8);

    return employeeOptions
      .filter((employee) => employee.fullName.toLowerCase().includes(q) || employee.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [employeeOptions, walkPersonToVisit, walkSelectedEmployee]);
  const matchingPreEmployees = useMemo(() => {
    if (preSelectedEmployee) return [];

    const q = prePersonToVisit.trim().toLowerCase();
    if (!q) return employeeOptions.slice(0, 8);

    return employeeOptions
      .filter((employee) => employee.fullName.toLowerCase().includes(q) || employee.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [employeeOptions, prePersonToVisit, preSelectedEmployee]);

  if (checkingAccess) {
    return (
      <main className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Preloader label="Checking access..." size="lg" />
      </main>
    );
  }

  if (!accessAllowed) return null;

  return (
    <main className={styles.page}>
      {toast ? (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.text}
        </div>
      ) : null}

      <section className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/home" className={styles.breadcrumbLink}>
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Back to Home
          </Link>
          <span className={styles.breadcrumbCurrent}>Visit operations</span>
        </nav>

        <section className={`${styles.card} ${styles.heroCard}`}>
          <h1 className={styles.title}>Visit operations</h1>
          <p className={styles.subtitle}>
            Check in walk-ins, desk pre-registrations, and self-service entries. Check-in creates the visitor profile
            shown under Visitors on the home page; use this screen to add ID details and the consent QR.
          </p>
          <div className={styles.quickStats}>
            <div className={styles.statPill}>
              <i className="fa-solid fa-clipboard-list" aria-hidden />
              Pending: {pendingManualPreRegs.length}
            </div>
            <div className={styles.statPill}>
              <i className="fa-solid fa-desktop" aria-hidden />
              Self serviced: {pendingSelfServiced.length}
            </div>
            <div className={styles.statPill}>
              <i className="fa-solid fa-qrcode" aria-hidden />
              QR consent after check-in
            </div>
          </div>
        </section>

        <section className={styles.formSwitch}>
          <button
            type="button"
            onClick={() => setActiveForm("pre_registered")}
            className={`${styles.switchButton} ${activeForm === "pre_registered" ? styles.switchButtonActive : ""}`}
          >
            <span className={styles.switchInner}>
              <i className="fa-solid fa-user-clock" aria-hidden />
              Pre-registration
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveForm("walk_in")}
            className={`${styles.switchButton} ${activeForm === "walk_in" ? styles.switchButtonActive : ""}`}
          >
            <span className={styles.switchInner}>
              <i className="fa-solid fa-person-walking" aria-hidden />
              Walk-in
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveForm("self_serviced")}
            className={`${styles.switchButton} ${activeForm === "self_serviced" ? styles.switchButtonActive : ""}`}
          >
            <span className={styles.switchInner}>
              <i className="fa-solid fa-desktop" aria-hidden />
              Self Serviced
            </span>
          </button>
        </section>

        {activeForm === "pre_registered" || activeForm === "self_serviced" ? (
          <section className={`${styles.card} ${styles.preRegLayout}`}>
            <div className={styles.preRegListPane}>
              <div className={styles.preRegHeader}>
                <h2 className={styles.sectionLabel}>
                  <i className="fa-solid fa-users" style={{ marginRight: 8 }} aria-hidden />
                  {activeForm === "self_serviced" ? "Pending self-serviced entries" : "Pending pre-registrations"}
                </h2>
                <button type="button" className={styles.buttonSecondary} onClick={() => void loadPreRegs()}>
                  <i className="fa-solid fa-rotate" style={{ marginRight: 6 }} aria-hidden />
                  Refresh
                </button>
              </div>
              <input
                className={`${styles.input} ${styles.inputBlue}`}
                placeholder="Search by name, company, purpose..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {loadingPreRegs ? (
                <div className={styles.loaderWrap}>
                  <Preloader label="Loading list..." size="md" />
                </div>
              ) : (
                <div className={styles.listScroller}>
                  {filteredPreRegs.length === 0 ? (
                    <p className={styles.emptyState}>
                      {activeForm === "self_serviced"
                        ? "No matching pending self-serviced entries."
                        : "No matching pending pre-registrations."}
                    </p>
                  ) : (
                    filteredPreRegs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`${styles.preRegRow} ${selectedPreId === p.id ? styles.preRegRowActive : ""}`}
                        onClick={() => setSelectedPreId(p.id)}
                      >
                        <div className={styles.preRegTop}>
                          <strong>
                            <i className="fa-solid fa-user" style={{ marginRight: 6, opacity: 0.75 }} aria-hidden />
                            {p.fullName}
                          </strong>
                          {activeForm === "pre_registered" ? (
                            <span>
                              <i className="fa-regular fa-clock" style={{ marginRight: 4 }} aria-hidden />
                              {new Date(p.expectedAt).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                        <div className={styles.preRegMeta}>
                          <i className="fa-solid fa-building" style={{ marginRight: 4 }} aria-hidden />
                          {p.company || "No company"} · {p.purpose || "No purpose"}
                          <br />
                          <i className="fa-solid fa-shield" style={{ marginRight: 4 }} aria-hidden />
                          Consent: {p.visitorConsentAt ? "Recorded" : "Pending"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className={styles.preRegFormPane}>
              <h2 className={styles.sectionLabel}>
                <i className="fa-solid fa-id-card" style={{ marginRight: 8 }} aria-hidden />
                Check in selected person
              </h2>
              <p className={styles.hint}>
                <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} aria-hidden />
                {activeForm === "self_serviced"
                  ? "Phone and document details were captured at self-service and will be used automatically. Completing check-in creates their visitor profile (Visitors on home)."
                  : "Phone is optional (+254, up to 9 digits). Document type and number are required. National ID: numbers only. Check-in creates their visitor profile (Visitors on home)."}
              </p>
              {selectedPre ? (
                <p className={styles.summary}>
                  <strong>{selectedPre.fullName}</strong>
                  {selectedPre.company ? ` · ${selectedPre.company}` : ""}
                  {activeForm === "pre_registered" ? (
                    <>
                      <br />
                      Expected: {new Date(selectedPre.expectedAt).toLocaleString()}
                    </>
                  ) : null}
                  <br />
                  Purpose: {selectedPre.purpose || "—"}
                  <br />
                  Visiting: {selectedPre.personToVisit || "—"} · Floor: {(selectedPre.visitFloor || "—").replace("_", " ")}
                  <br />
                  Document: {selectedPre.idType || "—"} · Number: {selectedPre.idNumber || "—"}
                </p>
              ) : (
                <p className={styles.emptyState}>Select a person from the list to continue.</p>
              )}
              <form className={styles.grid} onSubmit={onPreRegisteredSubmit}>
                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="pre-person">
                    <i className="fa-solid fa-user-tie" aria-hidden />
                    Who is being visited
                  </label>
                  <div className={styles.searchSelectWrap}>
                    {preSelectedEmployee ? (
                      <div className={styles.selectedEmployeeChip} aria-live="polite">
                        <div className={styles.selectedEmployeeMeta}>
                          <strong>{preSelectedEmployee.fullName}</strong>
                          <small>{preSelectedEmployee.email}</small>
                        </div>
                        <button
                          type="button"
                          className={styles.clearChipButton}
                          onClick={() => {
                            setPreSelectedEmployee(null);
                            setPrePersonToVisit("");
                            setPreEmployeeListOpen(true);
                          }}
                          disabled={!selectedPre}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <input
                        id="pre-person"
                        className={`${styles.input} ${styles.inputBlue}`}
                        value={prePersonToVisit}
                        onChange={(e) => {
                          setPrePersonToVisit(e.target.value);
                          setPreSelectedEmployee(null);
                          setPreEmployeeListOpen(true);
                        }}
                        onFocus={() => setPreEmployeeListOpen(true)}
                        onBlur={() => {
                          window.setTimeout(() => setPreEmployeeListOpen(false), 120);
                        }}
                        placeholder="Search employee by name or email"
                        disabled={!selectedPre}
                      />
                    )}
                    {preEmployeeListOpen && !preSelectedEmployee && selectedPre ? (
                      <div className={styles.searchSelectList} role="listbox" aria-label="Employees">
                        {loadingEmployees ? (
                          <div className={styles.searchSelectHint}>Loading employees...</div>
                        ) : matchingPreEmployees.length ? (
                          matchingPreEmployees.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              className={styles.searchSelectItem}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setPreSelectedEmployee(employee);
                                setPrePersonToVisit("");
                                setPreEmployeeListOpen(false);
                              }}
                            >
                              <span>{employee.fullName}</span>
                              <small>{employee.email}</small>
                            </button>
                          ))
                        ) : (
                          <div className={styles.searchSelectHint}>No matching employee found.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                {activeForm === "pre_registered" && !isVisitorDirectoryPreReg(selectedPre) ? (
                  <>
                    <div className={styles.field}>
                      <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="pre-phone-local">
                        <i className="fa-solid fa-phone" aria-hidden />
                        Phone (optional)
                      </label>
                      <div className={`${styles.phoneInputRow} ${styles.phoneInputRowBlue}`}>
                        <span className={styles.phonePrefix} aria-hidden>
                          +254
                        </span>
                        <input
                          id="pre-phone-local"
                          className={styles.phoneInputLocal}
                          value={prePhone}
                          onChange={(e) =>
                            setPrePhone(digitsOnly(e.target.value).slice(0, KE_PHONE_LOCAL_MAX_DIGITS))
                          }
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="712345678"
                          aria-label="Phone number without country code"
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label
                        className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`}
                        htmlFor="pre-idtype"
                      >
                        <i className="fa-solid fa-passport" aria-hidden />
                        Document type
                      </label>
                      <select
                        id="pre-idtype"
                        className={`${styles.select} ${styles.selectOrange}`}
                        value={preIdType}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPreIdType(next);
                          setPreIdNumber((prev) => sanitizeIdNumberInput(prev, next));
                        }}
                      >
                        <option value="">Select type</option>
                        {ID_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                      <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="pre-idnum">
                        <i className="fa-solid fa-hashtag" aria-hidden />
                        Document number
                      </label>
                      <input
                        id="pre-idnum"
                        className={`${styles.input} ${styles.inputBlue}`}
                        value={preIdNumber}
                        onChange={(e) =>
                          setPreIdNumber(sanitizeIdNumberInput(e.target.value, preIdType))
                        }
                        inputMode={preIdType === "National ID" ? "numeric" : "text"}
                      />
                    </div>
                  </>
                ) : null}
                {activeForm === "pre_registered" && isVisitorDirectoryPreReg(selectedPre) ? (
                  <p className={styles.hint} style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                    <i className="fa-solid fa-lock" style={{ marginRight: 6 }} aria-hidden />
                    Personal details are locked from the visitor profile (document-number based pre-registration).
                  </p>
                ) : null}
                <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className={styles.buttonPrimary} disabled={preSaving || !selectedPreId}>
                    {preSaving ? (
                      <Preloader label="Checking in..." size="sm" />
                    ) : (
                      <>
                        <i className="fa-solid fa-check" style={{ marginRight: 8 }} aria-hidden />
                        Check in selected visitor
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : (
          <section className={styles.card}>
            <h2 className={styles.sectionLabel}>
              <i className="fa-solid fa-door-open" style={{ marginRight: 8 }} aria-hidden />
              Walk-in check-in
            </h2>
            <p className={styles.hint}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} aria-hidden />
              Document type and number are required. Phone is optional (+254, up to 9 digits). National ID: numbers only.
              Check-in creates their visitor profile (Visitors on home).
            </p>
            <div className={styles.divider} />
            <form className={styles.grid} onSubmit={onWalkInSubmit}>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="w-name">
                  <i className="fa-solid fa-user" aria-hidden />
                  Full name
                </label>
                <input
                  id="w-name"
                  className={`${styles.input} ${styles.inputBlue}`}
                  value={walkFullName}
                  onChange={(e) => setWalkFullName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="w-company">
                  <i className="fa-solid fa-building" aria-hidden />
                  Company
                </label>
                <input
                  id="w-company"
                  className={`${styles.input} ${styles.inputOrange}`}
                  value={walkCompany}
                  onChange={(e) => setWalkCompany(e.target.value)}
                />
              </div>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="w-purpose">
                  <i className="fa-solid fa-briefcase" aria-hidden />
                  Purpose of visit
                </label>
                <select
                  id="w-purpose"
                  className={`${styles.select} ${styles.selectBlue}`}
                  value={walkPurpose}
                  onChange={(e) => setWalkPurpose(e.target.value)}
                >
                  <option value="">Select purpose</option>
                  {PURPOSE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="w-person">
                  <i className="fa-solid fa-user-tie" aria-hidden />
                  Who is being visited
                </label>
                <div className={styles.searchSelectWrap}>
                  {walkSelectedEmployee ? (
                    <div className={styles.selectedEmployeeChip} aria-live="polite">
                      <div className={styles.selectedEmployeeMeta}>
                        <strong>{walkSelectedEmployee.fullName}</strong>
                        <small>{walkSelectedEmployee.email}</small>
                      </div>
                      <button
                        type="button"
                        className={styles.clearChipButton}
                        onClick={() => {
                          setWalkSelectedEmployee(null);
                          setWalkPersonToVisit("");
                          setWalkEmployeeListOpen(true);
                        }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <input
                      id="w-person"
                      className={`${styles.input} ${styles.inputBlue}`}
                      value={walkPersonToVisit}
                      onChange={(e) => {
                        setWalkPersonToVisit(e.target.value);
                        setWalkSelectedEmployee(null);
                        setWalkEmployeeListOpen(true);
                      }}
                      onFocus={() => setWalkEmployeeListOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setWalkEmployeeListOpen(false), 120);
                      }}
                      placeholder="Search employee by name or email"
                    />
                  )}
                  {walkEmployeeListOpen && !walkSelectedEmployee && (
                    <div className={styles.searchSelectList} role="listbox" aria-label="Employees">
                      {loadingEmployees ? (
                        <div className={styles.searchSelectHint}>Loading employees...</div>
                      ) : matchingWalkEmployees.length ? (
                        matchingWalkEmployees.map((employee) => (
                          <button
                            key={employee.id}
                            type="button"
                            className={styles.searchSelectItem}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setWalkSelectedEmployee(employee);
                              setWalkPersonToVisit("");
                              setWalkEmployeeListOpen(false);
                            }}
                          >
                            <span>{employee.fullName}</span>
                            <small>{employee.email}</small>
                          </button>
                        ))
                      ) : (
                        <div className={styles.searchSelectHint}>No matching employee found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="w-phone-local">
                  <i className="fa-solid fa-phone" aria-hidden />
                  Phone (optional)
                </label>
                <div className={`${styles.phoneInputRow} ${styles.phoneInputRowOrange}`}>
                  <span className={styles.phonePrefix} aria-hidden>
                    +254
                  </span>
                  <input
                    id="w-phone-local"
                    className={styles.phoneInputLocal}
                    value={walkPhone}
                    onChange={(e) =>
                      setWalkPhone(digitsOnly(e.target.value).slice(0, KE_PHONE_LOCAL_MAX_DIGITS))
                    }
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="712345678"
                    aria-label="Phone number without country code"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="w-idtype">
                  <i className="fa-solid fa-passport" aria-hidden />
                  Document type
                </label>
                <select
                  id="w-idtype"
                  className={`${styles.select} ${styles.selectBlue}`}
                  value={walkIdType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setWalkIdType(next);
                    setWalkIdNumber((prev) => sanitizeIdNumberInput(prev, next));
                  }}
                >
                  <option value="">Select type</option>
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="w-idnum">
                  <i className="fa-solid fa-hashtag" aria-hidden />
                  Document number
                </label>
                <input
                  id="w-idnum"
                  className={`${styles.input} ${styles.inputOrange}`}
                  value={walkIdNumber}
                  onChange={(e) =>
                    setWalkIdNumber(sanitizeIdNumberInput(e.target.value, walkIdType))
                  }
                  inputMode={walkIdType === "National ID" ? "numeric" : "text"}
                />
              </div>
              <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className={styles.buttonPrimary} disabled={walkSaving}>
                  {walkSaving ? (
                    <Preloader label="Checking in..." size="sm" />
                  ) : (
                    <>
                      <i className="fa-solid fa-check" style={{ marginRight: 8 }} aria-hidden />
                      Check in walk-in
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

      </section>
    </main>
  );
}
