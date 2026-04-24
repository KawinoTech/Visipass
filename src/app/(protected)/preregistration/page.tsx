"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./preregistration.module.css";

type EmployeeOption = {
  id: string;
  fullName: string;
  email: string;
  floor: "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR" | null;
};

type PreviousVisitorItem = {
  id: string;
  fullName: string;
  company: string | null;
  lastRegisteredAt: string;
};

export default function PreRegistrationCreatePage() {
  const router = useRouter();
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
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [personToVisit, setPersonToVisit] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeeListOpen, setEmployeeListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPreviousVisitors, setLoadingPreviousVisitors] = useState(false);
  const [searchingPreviousVisitors, setSearchingPreviousVisitors] = useState(false);
  const [previousVisitors, setPreviousVisitors] = useState<PreviousVisitorItem[]>([]);
  const [visitorSearchTerm, setVisitorSearchTerm] = useState("");
  const [preregisterModalVisitor, setPreregisterModalVisitor] = useState<PreviousVisitorItem | null>(null);
  const [preregisterExpectedAt, setPreregisterExpectedAt] = useState("");
  const [submittingPreregisterVisitorId, setSubmittingPreregisterVisitorId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        const role = data?.user?.role;
        if (res.ok && (role === "ADMIN" || role === "RECEPTIONIST" || role === "EMPLOYEE")) {
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
          showMessage("error", "Could not load employees. You can still type the name manually.");
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

  async function loadPreviousVisitors(searchText = "") {
    if (!accessAllowed) return;
    const trimmed = searchText.trim();
    const query = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
    setLoadingPreviousVisitors(true);
    try {
      const res = await fetch(`/api/pre-registrations/my-visitors${query}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showMessage("error", data?.message || "Failed to load your previously registered visitors.");
        return;
      }
      setPreviousVisitors((data?.items ?? []) as PreviousVisitorItem[]);
    } catch {
      showMessage("error", "Network error while loading returning visitors.");
    } finally {
      setLoadingPreviousVisitors(false);
    }
  }

  useEffect(() => {
    if (!accessAllowed) return;
    void loadPreviousVisitors();
  }, [accessAllowed]);

  const matchingEmployees = useMemo(() => {
    if (selectedEmployee) return [];

    const q = personToVisit.trim().toLowerCase();
    if (!q) return employeeOptions.slice(0, 8);

    return employeeOptions
      .filter((employee) => employee.fullName.toLowerCase().includes(q) || employee.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [employeeOptions, personToVisit, selectedEmployee]);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const rawPersonToVisit = personToVisit.trim();
    const normalizedQuery = rawPersonToVisit.toLowerCase();
    const matchedEmployee = employeeOptions.find(
      (employee) =>
        employee.fullName.toLowerCase() === normalizedQuery || employee.email.toLowerCase() === normalizedQuery,
    );
    const resolvedPersonToVisit = selectedEmployee?.fullName ?? matchedEmployee?.fullName ?? rawPersonToVisit;

    const resolvedEmployee = selectedEmployee ?? matchedEmployee ?? null;
    if (!fullName.trim() || !expectedAt || !purpose.trim() || !resolvedPersonToVisit) {
      showMessage("error", "Full name, expected date/time, purpose, and person to visit are required.");
      return;
    }
    if (!resolvedEmployee) {
      showMessage("error", "Please select who is being visited from the employee list.");
      return;
    }
    if (!resolvedEmployee.floor) {
      showMessage("error", "Selected employee has no assigned floor. Please update employee profile first.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pre-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim(),
          expectedAt: new Date(expectedAt).toISOString(),
          purpose: purpose.trim(),
          personToVisit: resolvedPersonToVisit,
          personToVisitUserId: resolvedEmployee.id,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showMessage("error", data?.message || "Failed to create pre-registration.");
        return;
      }

      setFullName("");
      setCompany("");
      setExpectedAt("");
      setPurpose("");
      setPersonToVisit("");
      setSelectedEmployee(null);
      showMessage(
        "success",
        "Pre-registration saved. They are not a visitor on file until checked in at Visit operations when they arrive.",
      );
    } catch {
      showMessage("error", "Network error while submitting pre-registration.");
    } finally {
      setSaving(false);
    }
  }

  async function searchPreviousVisitors(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearchingPreviousVisitors(true);
    try {
      await loadPreviousVisitors(visitorSearchTerm);
    } finally {
      setSearchingPreviousVisitors(false);
    }
  }

  async function submitPreregisterFromExistingVisitor() {
    if (!preregisterModalVisitor) return;
    const expected = new Date(preregisterExpectedAt);
    if (!preregisterExpectedAt.trim() || Number.isNaN(expected.getTime())) {
      showMessage("error", "Please provide a valid expected date/time.");
      return;
    }

    setSubmittingPreregisterVisitorId(preregisterModalVisitor.id);
    try {
      const res = await fetch(`/api/visitors/${encodeURIComponent(preregisterModalVisitor.id)}/preregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAt: expected.toISOString() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const rawMessage = String(data?.message ?? "").toLowerCase();
        if (data?.code === "ACTIVE_VISIT" || rawMessage.includes("currently checked in")) {
          showMessage("error", "This visitor is still checked in. Check them out first before pre-registering again.");
          return;
        }
        showMessage("error", data?.message || "Failed to pre-register visitor.");
        return;
      }
      showMessage(
        "success",
        "Pre-registration created from visitor history. Continue in Visit operations when they arrive.",
      );
      setPreregisterModalVisitor(null);
      await loadPreviousVisitors(visitorSearchTerm);
    } catch {
      showMessage("error", "Network error while pre-registering visitor.");
    } finally {
      setSubmittingPreregisterVisitorId(null);
    }
  }

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
      {message ? (
        <div className={`${styles.toast} ${message.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {message.text}
        </div>
      ) : null}

      <section className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/home" className={styles.breadcrumbLink}>
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Back to Home
          </Link>
          <span className={styles.breadcrumbCurrent}>Pre-registration</span>
        </nav>

        <section className={`${styles.card} ${styles.heroCard}`}>
          <h1 className={styles.title}>Pre-registration</h1>
          <p className={styles.subtitle}>
            Record expected guests before arrival—they are not visitors on file until reception checks them in at Visit
            operations. ID and other details can be added at the desk; data consent is collected there via QR code.
          </p>
          <div className={styles.quickStats}>
            <div className={styles.statPill}>
              <i className="fa-solid fa-calendar-plus" aria-hidden />
              Before arrival
            </div>
            <div className={styles.statPill}>
              <i className="fa-solid fa-clipboard-check" aria-hidden />
              Check-in at Visit operations
            </div>
            <div className={styles.statPill}>
              <i className="fa-solid fa-qrcode" aria-hidden />
              QR consent after check-in
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionLabel}>
            <i className="fa-solid fa-user-clock" style={{ marginRight: 8 }} aria-hidden />
            New expected guest
          </h2>
          <p className={styles.hint}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} aria-hidden />
            Choose the host from the employee list. The guest becomes a visitor in the system only after check-in at Visit
            operations.
          </p>
          <div className={styles.divider} />
          <form className={styles.grid} onSubmit={onSubmit}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="fullName">
                <i className="fa-solid fa-user" aria-hidden />
                Guest full name
              </label>
              <input
                id="fullName"
                className={`${styles.input} ${styles.inputBlue}`}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={`${styles.label} ${styles.labelWithIcon} ${styles.labelWithIconOrange}`} htmlFor="company">
                <i className="fa-solid fa-building" aria-hidden />
                Company (optional)
              </label>
              <input
                id="company"
                className={`${styles.input} ${styles.inputOrange}`}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="expectedAt">
                <i className="fa-solid fa-calendar-day" aria-hidden />
                Expected date and time
              </label>
              <input
                id="expectedAt"
                type="datetime-local"
                className={`${styles.input} ${styles.inputBlue}`}
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </div>

            <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="purpose">
                <i className="fa-solid fa-briefcase" aria-hidden />
                Purpose of visit
              </label>
              <select
                id="purpose"
                className={`${styles.select} ${styles.selectBlue}`}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                <option value="">Select purpose</option>
                {PURPOSE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={`${styles.label} ${styles.labelWithIcon}`} htmlFor="personToVisit">
                <i className="fa-solid fa-user-tie" aria-hidden />
                Who is being visited
              </label>
              <div className={styles.searchSelectWrap}>
                {selectedEmployee ? (
                  <div className={styles.selectedEmployeeChip} aria-live="polite">
                    <div className={styles.selectedEmployeeMeta}>
                      <strong>{selectedEmployee.fullName}</strong>
                      <small>{selectedEmployee.email}</small>
                    </div>
                    <button
                      type="button"
                      className={styles.clearChipButton}
                      onClick={() => {
                        setSelectedEmployee(null);
                        setPersonToVisit("");
                        setEmployeeListOpen(true);
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <input
                    id="personToVisit"
                    className={`${styles.input} ${styles.inputBlue}`}
                    value={personToVisit}
                    onChange={(e) => {
                      setPersonToVisit(e.target.value);
                      setSelectedEmployee(null);
                      setEmployeeListOpen(true);
                    }}
                    onFocus={() => setEmployeeListOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setEmployeeListOpen(false), 120);
                    }}
                    placeholder="Search employee by name or email"
                  />
                )}
                {employeeListOpen && !selectedEmployee && (
                  <div className={styles.searchSelectList} role="listbox" aria-label="Employees">
                    {loadingEmployees ? (
                      <div className={styles.searchSelectHint}>Loading employees...</div>
                    ) : matchingEmployees.length ? (
                      matchingEmployees.map((employee) => (
                        <button
                          key={employee.id}
                          type="button"
                          className={styles.searchSelectItem}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setPersonToVisit("");
                            setEmployeeListOpen(false);
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

            <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className={styles.buttonPrimary} disabled={saving}>
                {saving ? <Preloader label="Submitting..." size="sm" /> : "Save pre-registration"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionLabel}>
            <i className="fa-solid fa-user-check" style={{ marginRight: 8 }} aria-hidden />
            Returning visitors you previously registered
          </h2>
          <p className={styles.hint}>
            Search by visitor name and pre-register in one click without re-entering full details.
          </p>
          <div className={styles.divider} />

          <form className={styles.returningSearchRow} onSubmit={searchPreviousVisitors}>
            <input
              className={`${styles.input} ${styles.inputBlue}`}
              value={visitorSearchTerm}
              onChange={(e) => setVisitorSearchTerm(e.target.value)}
              placeholder="Search visitor by name"
            />
            <button type="submit" className={styles.buttonSecondary} disabled={searchingPreviousVisitors || loadingPreviousVisitors}>
              {searchingPreviousVisitors ? <Preloader label="Searching..." size="sm" /> : "Search"}
            </button>
          </form>

          <div className={styles.returningList}>
            {loadingPreviousVisitors ? (
              <div className={styles.searchSelectHint}>Loading visitors...</div>
            ) : previousVisitors.length === 0 ? (
              <div className={styles.searchSelectHint}>No matching previously registered visitors found.</div>
            ) : (
              previousVisitors.map((visitor) => (
                <article key={visitor.id} className={styles.returningItem}>
                  <div className={styles.returningMeta}>
                    <strong>{visitor.fullName}</strong>
                    <small>
                      {visitor.company || "No company"} • Last pre-registered: {" "}
                      {new Date(visitor.lastRegisteredAt).toLocaleString()}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => {
                      setPreregisterModalVisitor(visitor);
                      setPreregisterExpectedAt(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
                    }}
                    disabled={submittingPreregisterVisitorId === visitor.id}
                  >
                    Preregister
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      {preregisterModalVisitor ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Preregister visitor</h3>
            <p className={styles.modalSubtitle}>
              Set expected date/time for <strong>{preregisterModalVisitor.fullName}</strong>.
            </p>
            <label className={styles.label} htmlFor="preregister-expected-at">
              Expected date/time
            </label>
            <input
              id="preregister-expected-at"
              type="datetime-local"
              className={`${styles.input} ${styles.inputBlue}`}
              value={preregisterExpectedAt}
              onChange={(e) => setPreregisterExpectedAt(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setPreregisterModalVisitor(null)}
                disabled={submittingPreregisterVisitorId === preregisterModalVisitor.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => void submitPreregisterFromExistingVisitor()}
                disabled={submittingPreregisterVisitorId === preregisterModalVisitor.id}
              >
                {submittingPreregisterVisitorId === preregisterModalVisitor.id ? (
                  <Preloader label="Saving..." size="sm" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
