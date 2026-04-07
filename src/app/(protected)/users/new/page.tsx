"use client";

import { useMemo, useState, type FormEvent } from "react";
import styles from "./user-create.module.css";

const EMAIL_DOMAIN = "mua.co.ke";
const DEFAULT_PASSWORD = "Mua@2020";

type UserRole = "ADMIN" | "RECEPTIONIST" | "SECURITY" | "EMPLOYEE";

type UserLocation =
  | "HEAD_OFFICE"
  | "NAKURU_BRANCH"
  | "ELDORET_BRANCH"
  | "MERU_BRANCH"
  | "NAIROBI_CBD_BRANCH"
  | "THIKA_BRANCH";

const LOCATIONS: { value: UserLocation; label: string }[] = [
  { value: "HEAD_OFFICE", label: "Head Office" },
  { value: "NAKURU_BRANCH", label: "Nakuru Branch" },
  { value: "ELDORET_BRANCH", label: "Eldoret Branch" },
  { value: "MERU_BRANCH", label: "Meru Branch" },
  { value: "NAIROBI_CBD_BRANCH", label: "Nairobi CBD Branch" },
  { value: "THIKA_BRANCH", label: "Thika Branch" },
];

type UserFloor = "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR";

const FLOORS: { value: UserFloor; label: string }[] = [
  { value: "GROUND_FLOOR", label: "Ground Floor" },
  { value: "FIRST_FLOOR", label: "First Floor" },
  { value: "SECOND_FLOOR", label: "Second Floor" },
];

type FieldKey =
  | "fullName"
  | "userLoginId"
  | "emailLocal"
  | "location"
  | "floor"
  | "role"
  | "password";

type Toast = {
  id: number;
  type: "success" | "error";
  text: string;
};

function buildEmail(local: string): string {
  const part = local.trim().toLowerCase();
  return part ? `${part}@${EMAIL_DOMAIN}` : "";
}

function validateAll(input: {
  fullName: string;
  userLoginId: string;
  emailLocal: string;
  location: UserLocation;
  floor: UserFloor | "";
  role: UserRole;
  password: string;
}): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};

  const name = input.fullName.trim();
  if (!name) e.fullName = "Full name is required.";
  else if (name.length < 2) e.fullName = "Full name must be at least 2 characters.";

  const uid = input.userLoginId.trim();
  if (!uid) e.userLoginId = "User ID is required.";
  else if (!/^[a-zA-Z0-9._-]{2,64}$/.test(uid))
    e.userLoginId = "User ID: use 2–64 letters, numbers, . _ or - only.";

  const local = input.emailLocal.trim().toLowerCase();
  if (!local) e.emailLocal = "Email username (before @) is required.";
  else if (!/^[a-zA-Z0-9._-]+$/.test(local))
    e.emailLocal = "Use only letters, numbers, . _ or - before @.";
  else if (local.length > 64) e.emailLocal = "Email username is too long.";

  if (!input.location) e.location = "Location is required.";

  if (!input.role) e.role = "Role is required.";

  const pwd = input.password;
  if (!pwd) e.password = "Password is required.";
  else if (pwd.length < 8) e.password = "Password must be at least 8 characters.";
  else if (!/[A-Z]/.test(pwd)) e.password = "Password must include an uppercase letter.";
  else if (!/[a-z]/.test(pwd)) e.password = "Password must include a lowercase letter.";
  else if (!/[0-9]/.test(pwd)) e.password = "Password must include a number.";
  else if (!/[^A-Za-z0-9]/.test(pwd)) e.password = "Password must include a symbol.";

  return e;
}

export default function CreateUserPage() {
  const roles: UserRole[] = useMemo(
    () => ["ADMIN", "RECEPTIONIST", "SECURITY", "EMPLOYEE"],
    [],
  );

  const [fullName, setFullName] = useState("");
  const [userLoginId, setUserLoginId] = useState("");
  const [emailLocal, setEmailLocal] = useState("");
  const [location, setLocation] = useState<UserLocation>("HEAD_OFFICE");
  const [floor, setFloor] = useState<UserFloor | "">("");
  const [role, setRole] = useState<UserRole>("RECEPTIONIST");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function pushToast(type: Toast["type"], text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function submitCreateUser() {
    const errors = validateAll({
      fullName,
      userLoginId,
      emailLocal,
      location,
      floor,
      role,
      password,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      pushToast("error", "Please fix the highlighted fields.");
      return false;
    }

    const email = buildEmail(emailLocal);
    const floorPayload: UserFloor | null =
      location === "HEAD_OFFICE" ? (floor || null) : null;

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          userLoginId: userLoginId.trim(),
          email,
          location,
          floor: floorPayload,
          role,
          password,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const apiFieldErrors = (data?.fieldErrors ?? null) as
          | Partial<Record<FieldKey, string[]>>
          | null;
        if (apiFieldErrors) {
          const normalized: Partial<Record<FieldKey, string>> = {};
          for (const key of Object.keys(apiFieldErrors) as FieldKey[]) {
            const val = apiFieldErrors[key];
            if (val && val.length > 0) normalized[key] = val[0];
          }
          if (Object.keys(normalized).length > 0) {
            setFieldErrors((prev) => ({ ...prev, ...normalized }));
          }
        }
        pushToast("error", data?.message || "Failed to create user.");
        return false;
      }

      pushToast("success", "User created successfully.");
      setFullName("");
      setUserLoginId("");
      setEmailLocal("");
      setLocation("HEAD_OFFICE");
      setFloor("");
      setRole("RECEPTIONIST");
      setPassword(DEFAULT_PASSWORD);
      setFieldErrors({});
      return true;
    } catch {
      pushToast("error", "Network error. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const errors = validateAll({
      fullName,
      userLoginId,
      emailLocal,
      location,
      floor,
      role,
      password,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      pushToast("error", "Please fix the highlighted fields.");
      return;
    }
    setConfirmOpen(true);
  }

  async function onConfirmCreate() {
    const ok = await submitCreateUser();
    if (ok) setConfirmOpen(false);
  }

  const locationLabel = LOCATIONS.find((loc) => loc.value === location)?.label ?? location;
  const floorLabel =
    floor ? FLOORS.find((f) => f.value === floor)?.label ?? floor : "Not specified";

  return (
    <main className={styles.page}>
      <div className={styles.toastStack} aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              styles.toast,
              toast.type === "success" ? styles.toastSuccess : styles.toastError,
            ].join(" ")}
            role="status"
          >
            {toast.text}
          </div>
        ))}
      </div>

      <section className={styles.card} aria-label="Create user form">
        <div className={styles.header}>
          <h1 className={styles.title}>Create Staff User</h1>
          <p className={styles.subtitle}>Admin-only action. Add a new staff account for Visipass.</p>
        </div>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                className={[styles.input, fieldErrors.fullName ? styles.inputError : ""].filter(Boolean).join(" ")}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError("fullName");
                }}
                autoComplete="name"
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? "err-fullName" : undefined}
              />
              {fieldErrors.fullName && (
                <span id="err-fullName" className={styles.fieldError} role="alert">
                  {fieldErrors.fullName}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="userLoginId">
                User ID
              </label>
              <input
                id="userLoginId"
                className={[styles.input, fieldErrors.userLoginId ? styles.inputError : ""].filter(Boolean).join(" ")}
                value={userLoginId}
                onChange={(e) => {
                  setUserLoginId(e.target.value);
                  clearFieldError("userLoginId");
                }}
                autoComplete="username"
                aria-invalid={!!fieldErrors.userLoginId}
                aria-describedby={fieldErrors.userLoginId ? "err-userLoginId" : undefined}
              />
              {fieldErrors.userLoginId && (
                <span id="err-userLoginId" className={styles.fieldError} role="alert">
                  {fieldErrors.userLoginId}
                </span>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="emailLocal">
                Email <span className={styles.labelHint}>(domain is @{EMAIL_DOMAIN})</span>
              </label>
              <div className={styles.emailRow}>
                <input
                  id="emailLocal"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="name.surname"
                  className={[styles.input, styles.emailLocal, fieldErrors.emailLocal ? styles.inputError : ""]
                    .filter(Boolean)
                    .join(" ")}
                  value={emailLocal}
                  onChange={(e) => {
                    const v = e.target.value.replace(/@/g, "");
                    setEmailLocal(v);
                    clearFieldError("emailLocal");
                  }}
                  aria-invalid={!!fieldErrors.emailLocal}
                  aria-describedby={fieldErrors.emailLocal ? "err-emailLocal" : undefined}
                />
                <span className={styles.emailDomain} aria-hidden="true">
                  @{EMAIL_DOMAIN}
                </span>
              </div>
              {fieldErrors.emailLocal && (
                <span id="err-emailLocal" className={styles.fieldError} role="alert">
                  {fieldErrors.emailLocal}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="location">
                Location
              </label>
              <select
                id="location"
                className={[styles.select, fieldErrors.location ? styles.inputError : ""].filter(Boolean).join(" ")}
                value={location}
                onChange={(e) => {
                  const next = e.target.value as UserLocation;
                  setLocation(next);
                  clearFieldError("location");
                  clearFieldError("floor");
                  if (next !== "HEAD_OFFICE") {
                    setFloor("");
                  }
                }}
                aria-invalid={!!fieldErrors.location}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
              {fieldErrors.location && (
                <span className={styles.fieldError} role="alert">
                  {fieldErrors.location}
                </span>
              )}
            </div>
          </div>

          {location === "HEAD_OFFICE" && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="floor">
                  Floor <span className={styles.labelHint}>(optional)</span>
                </label>
                <select
                  id="floor"
                  className={[styles.select, fieldErrors.floor ? styles.inputError : ""].filter(Boolean).join(" ")}
                  value={floor}
                  onChange={(e) => {
                    const v = e.target.value as UserFloor | "";
                    setFloor(v);
                    clearFieldError("floor");
                  }}
                  aria-invalid={!!fieldErrors.floor}
                  aria-describedby={fieldErrors.floor ? "err-floor" : undefined}
                >
                  <option value="">Not specified</option>
                  {FLOORS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.floor && (
                  <span id="err-floor" className={styles.fieldError} role="alert">
                    {fieldErrors.floor}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="role">
                Role
              </label>
              <select
                id="role"
                className={[styles.select, fieldErrors.role ? styles.inputError : ""].filter(Boolean).join(" ")}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  clearFieldError("role");
                }}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {fieldErrors.role && (
                <span className={styles.fieldError} role="alert">
                  {fieldErrors.role}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className={[styles.input, fieldErrors.password ? styles.inputError : ""].filter(Boolean).join(" ")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                }}
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "err-password" : undefined}
              />
              {fieldErrors.password && (
                <span id="err-password" className={styles.fieldError} role="alert">
                  {fieldErrors.password}
                </span>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.buttonSecondary} type="button" onClick={() => setToasts([])}>
              Clear toasts
            </button>

            <button className={styles.buttonPrimary} type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </section>

      {confirmOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Confirm new user">
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Confirm User Details</h3>
            <p className={styles.modalSubtitle}>Review these details before creating the user.</p>

            <div className={styles.previewGrid}>
              <div><strong>Full name:</strong> {fullName.trim()}</div>
              <div><strong>User ID:</strong> {userLoginId.trim()}</div>
              <div><strong>Email:</strong> {buildEmail(emailLocal)}</div>
              <div><strong>Location:</strong> {locationLabel}</div>
              {location === "HEAD_OFFICE" && <div><strong>Floor:</strong> {floorLabel}</div>}
              <div><strong>Role:</strong> {role}</div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => void onConfirmCreate()}
                disabled={loading}
              >
                {loading ? "Creating..." : "Confirm & Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
