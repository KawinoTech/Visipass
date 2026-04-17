"use client";

import { useEffect, useMemo, useState } from "react";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./preregistration.module.css";

type EmployeeOption = {
  id: string;
  fullName: string;
  email: string;
};

export default function PreRegistrationCreatePage() {
  const FLOORS = ["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"] as const;
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [personToVisit, setPersonToVisit] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeeListOpen, setEmployeeListOpen] = useState(false);
  const [visitFloor, setVisitFloor] = useState<(typeof FLOORS)[number] | "">("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    if (!fullName.trim() || !company.trim() || !expectedAt || !purpose.trim() || !resolvedPersonToVisit || !visitFloor) {
      showMessage("error", "Full name, company, expected date/time, purpose, person to visit, and floor are required.");
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
          visitFloor,
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
      setVisitFloor("");
      showMessage("success", "Pre-registration saved. Check them in from Visit operations when they arrive.");
    } catch {
      showMessage("error", "Network error while submitting pre-registration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      {message ? (
        <div className={`${styles.toast} ${message.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {message.text}
        </div>
      ) : null}

      <section className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Pre-registration Page</h1>
          <p className={styles.subtitle}>
            Record expected visitors before arrival. They are checked in at Visit operations, where ID and other details
            can be added if needed. Data consent is collected there via QR code.
          </p>
        </section>

        <section className={styles.card}>
          <form className={styles.grid} onSubmit={onSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">
                Visitor full name
              </label>
              <input
                id="fullName"
                className={styles.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="company">
                Company
              </label>
              <input
                id="company"
                className={styles.input}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="expectedAt">
                Expected date and time
              </label>
              <input
                id="expectedAt"
                type="datetime-local"
                className={styles.input}
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="purpose">
                Purpose of visit
              </label>
              <textarea
                id="purpose"
                className={styles.textarea}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="personToVisit">
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
                    className={styles.input}
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

            <div className={styles.field}>
              <label className={styles.label} htmlFor="visitFloor">
                Floor
              </label>
              <select
                id="visitFloor"
                className={styles.input}
                value={visitFloor}
                onChange={(e) => setVisitFloor(e.target.value as (typeof FLOORS)[number] | "")}
              >
                <option value="">Select floor</option>
                {FLOORS.map((floor) => (
                  <option key={floor} value={floor}>
                    {floor.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className={styles.buttonPrimary} disabled={saving}>
                {saving ? <Preloader label="Submitting..." size="sm" /> : "Save pre-registration"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
