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
};

const ID_TYPES = ["Passport", "Driving License", "National ID"] as const;
const FLOOR_TYPES = ["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"] as const;
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

export default function VisitsPage() {
  const router = useRouter();
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
  const [walkVisitFloor, setWalkVisitFloor] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkIdType, setWalkIdType] = useState("");
  const [walkIdNumber, setWalkIdNumber] = useState("");
  const [walkSaving, setWalkSaving] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [selectedPreId, setSelectedPreId] = useState("");
  const [prePhone, setPrePhone] = useState("");
  const [prePersonToVisit, setPrePersonToVisit] = useState("");
  const [preVisitFloor, setPreVisitFloor] = useState("");
  const [preIdType, setPreIdType] = useState("");
  const [preIdNumber, setPreIdNumber] = useState("");
  const [preSaving, setPreSaving] = useState(false);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
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
    setPreVisitFloor("");
    setPreIdType("");
    setPreIdNumber("");
  }, [activeForm]);

  useEffect(() => {
    if (!selectedPre) {
      setPrePersonToVisit("");
      setPreVisitFloor("");
      return;
    }
    setPrePersonToVisit(selectedPre.personToVisit ?? "");
    setPreVisitFloor(selectedPre.visitFloor ?? "");
  }, [selectedPre]);

  async function onWalkInSubmit(e: React.FormEvent) {
    e.preventDefault();

    const rawPersonToVisit = walkPersonToVisit.trim();
    const normalizedQuery = rawPersonToVisit.toLowerCase();
    const matchedEmployee = employeeOptions.find(
      (employee) =>
        employee.fullName.toLowerCase() === normalizedQuery || employee.email.toLowerCase() === normalizedQuery,
    );
    const resolvedPersonToVisit = walkSelectedEmployee?.fullName ?? matchedEmployee?.fullName ?? rawPersonToVisit;

    if (!walkFullName.trim() || !walkCompany.trim() || !walkPurpose.trim() || !resolvedPersonToVisit || !walkVisitFloor) {
      showToast("error", "Full name, company, purpose, who is being visited, and floor are required.");
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
        personToVisit: resolvedPersonToVisit,
        visitFloor: walkVisitFloor,
        phone: walkPhone.trim() || null,
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
        showToast("error", data?.message || "Check-in failed.");
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
      setWalkVisitFloor("");
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
    const resolvedPersonToVisit = prePersonToVisit.trim();
    if (!resolvedPersonToVisit || !preVisitFloor) {
      showToast("error", "Who is being visited and floor are required.");
      return;
    }
    if (selectedPre && !selectedPre.visitorConsentAt) {
      showToast("error", "Consent must be recorded before check-in.");
      return;
    }
    if (!preIdType || !preIdNumber.trim()) {
      showToast("error", "Document type and document number are required.");
      return;
    }
    setPreSaving(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pre_registered",
          preRegistrationId: selectedPreId,
          personToVisit: resolvedPersonToVisit,
          visitFloor: preVisitFloor,
          phone: prePhone.trim() || null,
          idType: preIdType,
          idNumber: preIdNumber.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast("error", data?.message || "Check-in failed.");
        return;
      }
      const vid = data?.visit?.id as string | undefined;
      if (vid) {
        const checkedInLabel = selectedPre?.notes?.toLowerCase().includes("self-service")
          ? "Self-serviced visitor"
          : "Pre-registered visitor";
        showToast("success", `${checkedInLabel} checked in. Opening the consent QR page...`);
        router.push(`/visits/consent-qr?visitId=${encodeURIComponent(vid)}`);
      }
      setSelectedPreId("");
      setPrePhone("");
      setPrePersonToVisit("");
      setPreVisitFloor("");
      setPreIdType("");
      setPreIdNumber("");
      await loadPreRegs();
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
            Check in walk-ins and pre-registered visitors, collect missing details at the desk, and capture visitor data
            consent instantly via QR scan.
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
                          <span>
                            <i className="fa-regular fa-clock" style={{ marginRight: 4 }} aria-hidden />
                            {new Date(p.expectedAt).toLocaleString()}
                          </span>
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
                Phone is optional. Document type and number are required.
              </p>
              {selectedPre ? (
                <p className={styles.summary}>
                  <strong>{selectedPre.fullName}</strong>
                  {selectedPre.company ? ` · ${selectedPre.company}` : ""}
                  <br />
                  Expected: {new Date(selectedPre.expectedAt).toLocaleString()}
                  <br />
                  Purpose: {selectedPre.purpose || "—"}
                  <br />
                  Visiting: {selectedPre.personToVisit || "—"} · Floor: {(selectedPre.visitFloor || "—").replace("_", " ")}
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
                  <input
                    id="pre-person"
                    className={`${styles.input} ${styles.inputBlue}`}
                    value={prePersonToVisit}
                    onChange={(e) => setPrePersonToVisit(e.target.value)}
                    placeholder="Enter employee/host name"
                    disabled={!selectedPre}
                  />
                </div>
                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="pre-floor">
                    <i className="fa-solid fa-building" aria-hidden />
                    Floor
                  </label>
                  <select
                    id="pre-floor"
                    className={`${styles.select} ${styles.selectOrange}`}
                    value={preVisitFloor}
                    onChange={(e) => setPreVisitFloor(e.target.value)}
                  >
                    <option value="">Select floor</option>
                    {FLOOR_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="pre-phone">
                    <i className="fa-solid fa-phone" aria-hidden />
                    Phone (optional)
                  </label>
                  <input
                    id="pre-phone"
                    className={`${styles.input} ${styles.inputBlue}`}
                    value={prePhone}
                    onChange={(e) => setPrePhone(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="pre-idtype">
                    <i className="fa-solid fa-passport" aria-hidden />
                    Document type
                  </label>
                  <select
                    id="pre-idtype"
                    className={`${styles.select} ${styles.selectOrange}`}
                    value={preIdType}
                    onChange={(e) => setPreIdType(e.target.value)}
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
                    onChange={(e) => setPreIdNumber(e.target.value)}
                  />
                </div>
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
                {selectedPre && !selectedPre.visitorConsentAt ? (
                  <p className={styles.hint} style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} aria-hidden />
                    Consent pending. Ask visitor to complete consent from the self-service desk before check-in.
                  </p>
                ) : null}
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
              Document type and number are required. Phone is optional.
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
                <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="w-floor">
                  <i className="fa-solid fa-building" aria-hidden />
                  Floor
                </label>
                <select
                  id="w-floor"
                  className={`${styles.select} ${styles.selectOrange}`}
                  value={walkVisitFloor}
                  onChange={(e) => setWalkVisitFloor(e.target.value)}
                >
                  <option value="">Select floor</option>
                  {FLOOR_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="w-phone">
                  <i className="fa-solid fa-phone" aria-hidden />
                  Phone (optional)
                </label>
                <input
                  id="w-phone"
                  className={`${styles.input} ${styles.inputOrange}`}
                  value={walkPhone}
                  onChange={(e) => setWalkPhone(e.target.value)}
                />
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
                  onChange={(e) => setWalkIdType(e.target.value)}
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
                  onChange={(e) => setWalkIdNumber(e.target.value)}
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
