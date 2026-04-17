"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay, Preloader } from "@/components/ui/Preloader";
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
type UserFloor = "GROUND_FLOOR" | "FIRST_FLOOR" | "SECOND_FLOOR";

type UserRow = {
  id: string;
  userLoginId: string;
  fullName: string;
  email: string;
  location: UserLocation;
  floor: UserFloor | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type Toast = { id: number; type: "success" | "error"; text: string };

const LOCATIONS: { value: UserLocation; label: string }[] = [
  { value: "HEAD_OFFICE", label: "Head Office" },
  { value: "NAKURU_BRANCH", label: "Nakuru Branch" },
  { value: "ELDORET_BRANCH", label: "Eldoret Branch" },
  { value: "MERU_BRANCH", label: "Meru Branch" },
  { value: "NAIROBI_CBD_BRANCH", label: "Nairobi CBD Branch" },
  { value: "THIKA_BRANCH", label: "Thika Branch" },
];
const FLOORS: { value: UserFloor; label: string }[] = [
  { value: "GROUND_FLOOR", label: "Ground Floor" },
  { value: "FIRST_FLOOR", label: "First Floor" },
  { value: "SECOND_FLOOR", label: "Second Floor" },
];

function buildEmail(local: string): string {
  const part = local.trim().toLowerCase();
  return part ? `${part}@${EMAIL_DOMAIN}` : "";
}

export default function UserManagementPage() {
  const router = useRouter();
  const roles: UserRole[] = useMemo(() => ["ADMIN", "RECEPTIONIST", "SECURITY", "EMPLOYEE"], []);
  const [activeTab, setActiveTab] = useState<"overview" | "create">("overview");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [booting, setBooting] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"ALL" | UserRole>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [sortBy, setSortBy] = useState<"fullName" | "userLoginId" | "role" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [fullName, setFullName] = useState("");
  const [userLoginId, setUserLoginId] = useState("");
  const [emailLocal, setEmailLocal] = useState("");
  const [location, setLocation] = useState<UserLocation>("HEAD_OFFICE");
  const [floor, setFloor] = useState<UserFloor | "">("");
  const [role, setRole] = useState<UserRole>("RECEPTIONIST");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  function pushToast(type: Toast["type"], text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  async function checkRoleAndLoad() {
    setBooting(true);
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const meData = await meRes.json().catch(() => null);
      if (!meRes.ok) {
        pushToast("error", "Session expired. Please sign in.");
        router.push("/login");
        return;
      }
      if (meData?.user?.role !== "ADMIN") {
        pushToast("error", "Unauthorised");
        router.push("/home");
        return;
      }
      setIsAdmin(true);
      await fetchUsers();
    } catch {
      pushToast("error", "Failed to verify session. Please sign in again.");
      router.push("/login");
    } finally {
      setBooting(false);
    }
  }

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          pushToast("error", "Unauthorised");
          router.push("/home");
          return;
        }
        pushToast("error", data?.message || "Failed to load users.");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      pushToast("error", "Network error while loading users.");
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void checkRoleAndLoad();
  }, []);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      const matchSearch =
        q.length === 0 ||
        u.fullName.toLowerCase().includes(q) ||
        u.userLoginId.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchRole = filterRole === "ALL" || u.role === filterRole;
      const matchStatus =
        filterStatus === "ALL" || (filterStatus === "ACTIVE" ? u.isActive : !u.isActive);
      return matchSearch && matchRole && matchStatus;
    });

    filtered.sort((a, b) => {
      let left: string | number = "";
      let right: string | number = "";
      if (sortBy === "createdAt") {
        left = new Date(a.createdAt).getTime();
        right = new Date(b.createdAt).getTime();
      } else {
        left = String(a[sortBy]).toLowerCase();
        right = String(b[sortBy]).toLowerCase();
      }
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [users, search, filterRole, filterStatus, sortBy, sortDir]);

  async function onCreate(ev: FormEvent) {
    ev.preventDefault();
    if (!fullName.trim() || !userLoginId.trim() || !emailLocal.trim()) {
      pushToast("error", "Full name, User ID, and Email are required.");
      return;
    }
    const emailLocalPart = emailLocal.trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(emailLocalPart)) {
      pushToast("error", "Invalid email format before @mua.co.ke.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          userLoginId: userLoginId.trim(),
          email: buildEmail(emailLocal),
          location,
          floor: location === "HEAD_OFFICE" ? (floor || null) : null,
          role,
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          pushToast("error", "Unauthorised");
          router.push("/home");
          return;
        }
        pushToast("error", data?.message || "Failed to create user.");
        return;
      }
      pushToast("success", "User created successfully.");
      setFullName("");
      setUserLoginId("");
      setEmailLocal("");
      setLocation("HEAD_OFFICE");
      setFloor("");
      setRole("RECEPTIONIST");
      setPassword(DEFAULT_PASSWORD);
      setActiveTab("overview");
      await fetchUsers();
    } catch {
      pushToast("error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(partial: Partial<UserRow> & { id: string }) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/users/${partial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          pushToast("error", "Unauthorised");
          router.push("/home");
          return;
        }
        pushToast("error", data?.message || "Failed to update user.");
        return;
      }
      pushToast("success", "User updated.");
      setEditing(null);
      await fetchUsers();
    } catch {
      pushToast("error", "Network error while updating user.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function setUserActive(id: string, isActive: boolean) {
    const actionLabel = isActive ? "Enable" : "Disable";
    const confirmLabel = isActive
      ? "Are you sure you want to enable this user?"
      : "Are you sure you want to disable this user? The account will not be able to log in.";
    if (!window.confirm(confirmLabel)) return;

    setTogglingUserId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          pushToast("error", "Unauthorised");
          router.push("/home");
          return;
        }
        pushToast("error", data?.message || `Failed to ${actionLabel.toLowerCase()} user.`);
        return;
      }

      pushToast("success", `User ${actionLabel}d.`);
      await fetchUsers();
    } catch {
      pushToast("error", "Network error while updating user status.");
    } finally {
      setTogglingUserId(null);
    }
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          pushToast("error", "Unauthorised");
          router.push("/home");
          return;
        }
        pushToast("error", data?.message || "Failed to delete user.");
        return;
      }

      pushToast("success", "User deleted.");
      setEditing(null);
      await fetchUsers();
    } catch {
      pushToast("error", "Network error while deleting user.");
    } finally {
      setDeleting(false);
    }
  }

  if (booting) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>
          <Preloader label="Loading user management..." size="lg" />
        </p>
      </main>
    );
  }
  if (!isAdmin) return null;

  return (
    <main className={styles.page}>
      {saving || savingEdit || deleting || togglingUserId ? <LoadingOverlay label="Saving changes..." /> : null}
      <div className={styles.toastStack}>{toasts.map((t) => <div key={t.id} className={`${styles.toast} ${t.type === "success" ? styles.toastSuccess : styles.toastError}`}>{t.text}</div>)}</div>
      <section className={styles.moduleHeader}>
        <button className={styles.buttonSecondary} type="button" onClick={() => router.push("/home")}>
          <span className={styles.iconLabel}>
            <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to Home
          </span>
        </button>
      </section>
      <section className={styles.moduleHeader}>
        <h1 className={styles.title}>User Management</h1>
        <p className={styles.subtitle}>Create, view, and update staff accounts.</p>
      </section>

      <section className={styles.tabBar}>
        <button className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`} onClick={() => setActiveTab("overview")}>Users</button>
        <button className={`${styles.tab} ${activeTab === "create" ? styles.tabActive : ""}`} onClick={() => setActiveTab("create")}>Create User</button>
      </section>

      {activeTab === "overview" && (
        <section className={styles.card}>
          <div className={styles.filtersBar}>
            <div className={styles.filtersGrid}>
              <input
                className={styles.input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, user ID, or email"
                aria-label="Search users"
              />
              <select className={styles.select} value={filterRole} onChange={(e) => setFilterRole(e.target.value as "ALL" | UserRole)} aria-label="Filter by role">
                <option value="ALL">All Roles</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "ALL" | "ACTIVE" | "DISABLED")} aria-label="Filter by status">
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
              <select className={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value as "fullName" | "userLoginId" | "role" | "createdAt")} aria-label="Sort field">
                <option value="createdAt">Sort: Created Date</option>
                <option value="fullName">Sort: Full Name</option>
                <option value="userLoginId">Sort: User ID</option>
                <option value="role">Sort: Role</option>
              </select>
              <button className={styles.buttonSecondary} type="button" onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}>
                {sortDir === "asc" ? "Ascending ↑" : "Descending ↓"}
              </button>
            </div>
            <div className={styles.cardActions}>
              <button className={styles.buttonSecondary} onClick={() => void fetchUsers()} disabled={loadingUsers}>
                {loadingUsers ? <Preloader label="Refreshing..." size="sm" /> : "Refresh"}
              </button>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th><span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" fill="currentColor"/></svg>Name</span></th><th><span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M4 5h16v14H4V5Zm3 3v2h10V8H7Zm0 4v2h6v-2H7Z" fill="currentColor"/></svg>User ID</span></th><th><span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M12 2 3 7l9 5 9-5-9-5Zm-7 8v7l7 4 7-4v-7l-7 4-7-4Z" fill="currentColor"/></svg>Role</span></th><th><span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.6 8 12 8 12s8-6.4 8-12a8 8 0 0 0-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor"/></svg>Location</span></th><th><span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7Z" fill="currentColor"/></svg>Status</span></th><th><span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M4 6h16v2H4V6Zm2 5h12v2H6v-2Zm3 5h6v2H9v-2Z" fill="currentColor"/></svg>Actions</span></th></tr></thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.fullName}</td>
                    <td>{u.userLoginId}</td>
                    <td>{u.role}</td>
                    <td>{LOCATIONS.find((l) => l.value === u.location)?.label ?? u.location}</td>
                    <td>{u.isActive ? "Active" : "Disabled"}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button className={styles.buttonSecondary} onClick={() => setEditing(u)} disabled={deleting}>
                          <span className={styles.iconLabel}>
                            <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4Zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4l-1.6 1.6-2.6-2.6Z" fill="currentColor"/></svg>
                            Edit
                          </span>
                        </button>
                        <button
                          className={u.isActive ? styles.buttonWarn : styles.buttonSuccess}
                          onClick={() => void setUserActive(u.id, !u.isActive)}
                          disabled={deleting || savingEdit || togglingUserId === u.id}
                        >
                          <span className={styles.iconLabel}>
                            {u.isActive ? (
                              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                                <path
                                  d="M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm-9 5a9 9 0 1 1 18 0a9 9 0 0 1-18 0Z"
                                  fill="currentColor"
                                />
                                <path d="M7 7l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.2 8.2-4.6 4.6a1 1 0 0 1-1.4 0l-2.1-2.1a1 1 0 1 1 1.4-1.4l1.4 1.4 3.9-3.9a1 1 0 1 1 1.4 1.4Z" fill="currentColor" />
                              </svg>
                            )}
                            {togglingUserId === u.id ? (
                              "Updating..."
                            ) : u.isActive ? (
                              "Disable"
                            ) : (
                              "Enable"
                            )}
                          </span>
                        </button>
                        <button className={styles.buttonDanger} onClick={() => void deleteUser(u.id)} disabled={deleting}>
                          <span className={styles.iconLabel}>
                            <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-1 6h2v11H8V9Zm6 0h2v11h-2V9Z" fill="currentColor"/></svg>
                            Delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleUsers.length === 0 ? <p className={styles.emptyState}>No users match your current filters.</p> : null}
        </section>
      )}

      {activeTab === "create" && (
        <section className={styles.card}>
          <form className={styles.form} onSubmit={onCreate}>
            <div className={styles.row}>
              <div className={styles.field}><label className={styles.label}>Full Name</label><input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className={styles.field}><label className={styles.label}>User ID</label><input className={styles.input} value={userLoginId} onChange={(e) => setUserLoginId(e.target.value)} /></div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <div className={styles.emailRow}>
                  <input className={`${styles.input} ${styles.emailLocal}`} value={emailLocal} onChange={(e) => setEmailLocal(e.target.value.replace(/@/g, ""))} />
                  <span className={styles.emailDomain}>@{EMAIL_DOMAIN}</span>
                </div>
              </div>
              <div className={styles.field}><label className={styles.label}>Role</label><select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label className={styles.label}>Location</label><select className={styles.select} value={location} onChange={(e) => setLocation(e.target.value as UserLocation)}>{LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
              {location === "HEAD_OFFICE" && <div className={styles.field}><label className={styles.label}>Floor</label><select className={styles.select} value={floor} onChange={(e) => setFloor(e.target.value as UserFloor | "")}><option value="">Not specified</option>{FLOORS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>}
            </div>
            <div className={styles.row}><div className={styles.field}><label className={styles.label}>Password</label><input type="password" className={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} /></div></div>
            <div className={styles.actions}><button className={styles.buttonPrimary} type="submit" disabled={saving}>{saving ? <Preloader label="Saving..." size="sm" /> : <span className={styles.iconLabel}><svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z" fill="currentColor"/></svg>Create User</span>}</button></div>
          </form>
        </section>
      )}

      {editing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Edit User</h3>
            <div className={styles.form}>
              <div className={styles.field}><label className={styles.label}>Full Name</label><input className={styles.input} value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} /></div>
              <div className={styles.row}>
                <div className={styles.field}><label className={styles.label}>Role</label><select className={styles.select} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as UserRole })}>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <div className={styles.field}><label className={styles.label}>Status</label><select className={styles.select} value={editing.isActive ? "ACTIVE" : "DISABLED"} onChange={(e) => setEditing({ ...editing, isActive: e.target.value === "ACTIVE" })}><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}><label className={styles.label}>Location</label><select className={styles.select} value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value as UserLocation, floor: e.target.value === "HEAD_OFFICE" ? editing.floor : null })}>{LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
                {editing.location === "HEAD_OFFICE" && <div className={styles.field}><label className={styles.label}>Floor</label><select className={styles.select} value={editing.floor ?? ""} onChange={(e) => setEditing({ ...editing, floor: (e.target.value || null) as UserFloor | null })}><option value="">Not specified</option>{FLOORS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.buttonSecondary} onClick={() => setEditing(null)} disabled={savingEdit || deleting}>Cancel</button>
              <button
                className={styles.buttonPrimary}
                disabled={savingEdit || deleting}
                onClick={() =>
                  void updateUser({
                    id: editing.id,
                    fullName: editing.fullName.trim(),
                    role: editing.role,
                    isActive: editing.isActive,
                    location: editing.location,
                    floor: editing.location === "HEAD_OFFICE" ? editing.floor : null,
                  })
                }
              >
                {savingEdit ? <Preloader label="Saving..." size="sm" /> : <span className={styles.iconLabel}>
                  <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M17 3H5a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" fill="currentColor"/></svg>
                  Save Changes
                </span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
