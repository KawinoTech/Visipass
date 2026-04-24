"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type VisitorRow = {
  id: string;
  fullName: string;
  company: string | null;
  phone: string | null;
  idType: string | null;
  idNumber: string | null;
  blacklisted: boolean;
  blacklistReason: string | null;
  createdAt: string | Date;
  consentIssuedAt: string | Date | null;
  consentExpiresAt: string | Date | null;
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

export function VisitorsTable({ visitors }: { visitors: VisitorRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkInModalVisitor, setCheckInModalVisitor] = useState<VisitorRow | null>(null);
  const [preregisterModalVisitor, setPreregisterModalVisitor] = useState<VisitorRow | null>(null);
  const [preregisterExpectedAt, setPreregisterExpectedAt] = useState("");
  const [blacklistModalVisitor, setBlacklistModalVisitor] = useState<VisitorRow | null>(null);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [feedbackModal, setFeedbackModal] = useState<{ title: string; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [blacklistFilter, setBlacklistFilter] = useState<"all" | "blacklisted" | "not_blacklisted">("all");
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "name_asc" | "name_desc">("created_desc");
  const requestLockRef = useRef<Set<string>>(new Set());

  const visibleVisitors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = visitors.filter((visitor) => {
      if (blacklistFilter === "blacklisted" && !visitor.blacklisted) return false;
      if (blacklistFilter === "not_blacklisted" && visitor.blacklisted) return false;
      if (!q) return true;
      const name = visitor.fullName.toLowerCase();
      const doc = (visitor.idNumber || "").toLowerCase();
      const phone = (visitor.phone || "").toLowerCase();
      return name.includes(q) || doc.includes(q) || phone.includes(q);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "name_asc") return a.fullName.localeCompare(b.fullName);
      if (sortBy === "name_desc") return b.fullName.localeCompare(a.fullName);
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortBy === "created_asc" ? aTime - bTime : bTime - aTime;
    });
    return sorted;
  }, [visitors, searchTerm, blacklistFilter, sortBy]);

  async function runAction(visitor: VisitorRow, action: "checkin" | "blacklist" | "unblacklist") {
    const requestKey = `${action}:${visitor.id}`;
    if (requestLockRef.current.has(requestKey)) return;
    requestLockRef.current.add(requestKey);
    setBusyId(visitor.id);
    try {
      if (action === "blacklist") {
        const res = await fetch(`/api/visitors/${encodeURIComponent(visitor.id)}/blacklist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: blacklistReason.trim() }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          window.alert(data?.message || "Failed to blacklist visitor.");
          return;
        }
        setBlacklistModalVisitor(null);
        setBlacklistReason("");
        router.refresh();
        return;
      }

      if (action === "unblacklist") {
        const res = await fetch(`/api/visitors/${encodeURIComponent(visitor.id)}/unblacklist`, { method: "POST" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          window.alert(data?.message || "Failed to unblacklist visitor.");
          return;
        }
        router.refresh();
        return;
      }

      const res = await fetch(`/api/visitors/${encodeURIComponent(visitor.id)}/check-in`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackModal({ title: "Check-in failed", message: data?.message || "Failed to check in visitor." });
        return;
      }
      if (data?.consentRequired) {
        router.push(`/visits/consent-qr?visitId=${encodeURIComponent(data?.visit?.id ?? "")}`);
      } else {
        setFeedbackModal({
          title: "Check-in complete",
          message: "Visitor checked in successfully. Consent still valid, QR step skipped.",
        });
        router.refresh();
      }
    } finally {
      setBusyId(null);
      requestLockRef.current.delete(requestKey);
    }
  }

  async function submitPreregister() {
    if (!preregisterModalVisitor) return;
    const requestKey = `preregister:${preregisterModalVisitor.id}`;
    if (requestLockRef.current.has(requestKey)) return;
    const expectedAt = new Date(preregisterExpectedAt);
    if (!preregisterExpectedAt.trim() || Number.isNaN(expectedAt.getTime())) {
      setFeedbackModal({ title: "Invalid date/time", message: "Please provide a valid expected date/time." });
      return;
    }
    requestLockRef.current.add(requestKey);
    setBusyId(preregisterModalVisitor.id);
    try {
      const res = await fetch(`/api/visitors/${encodeURIComponent(preregisterModalVisitor.id)}/preregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAt: expectedAt.toISOString() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackModal({ title: "Pre-registration failed", message: data?.message || "Failed to preregister visitor." });
        return;
      }
      setPreregisterModalVisitor(null);
      setFeedbackModal({
        title: "Pre-registration created",
        message: "Pre-registration created. Open Visit operations to check in when the visitor arrives.",
      });
    } finally {
      setBusyId(null);
      requestLockRef.current.delete(requestKey);
    }
  }

  return (
    <>
      <section
        style={{
          border: "1px solid var(--vp-card-border)",
          borderRadius: 12,
          background: "var(--vp-card-bg)",
          padding: 12,
          marginBottom: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div style={controlWrapStyle}>
          <label style={labelStyle} htmlFor="visitor-search">
            Search
          </label>
          <input
            id="visitor-search"
            style={inputStyle}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name or document number"
          />
        </div>
        <div style={controlWrapStyle}>
          <label style={labelStyle} htmlFor="visitor-filter">
            Filter
          </label>
          <select
            id="visitor-filter"
            style={inputStyle}
            value={blacklistFilter}
            onChange={(e) => setBlacklistFilter(e.target.value as "all" | "blacklisted" | "not_blacklisted")}
          >
            <option value="all">All visitors</option>
            <option value="blacklisted">Blacklisted only</option>
            <option value="not_blacklisted">Not blacklisted</option>
          </select>
        </div>
        <div style={controlWrapStyle}>
          <label style={labelStyle} htmlFor="visitor-sort">
            Sort
          </label>
          <select
            id="visitor-sort"
            style={inputStyle}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "created_desc" | "created_asc" | "name_asc" | "name_desc")}
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>
        <p style={{ margin: 0, marginLeft: "auto", fontSize: 13, color: "var(--vp-subtitle)", fontWeight: 700 }}>
          Showing {visibleVisitors.length} of {visitors.length}
        </p>
      </section>
      <div
        style={{
          border: "1px solid var(--vp-card-border)",
          borderRadius: 14,
          background: "var(--vp-card-bg)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1280 }}>
        <thead>
          <tr style={{ background: "color-mix(in srgb, var(--brand-primary) 8%, white)" }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Company</th>
            <th style={thStyle}>Phone</th>
            <th style={thStyle}>ID Type</th>
            <th style={thStyle}>ID Number</th>
              <th style={thStyle}>Consent Issued</th>
              <th style={thStyle}>Consent Expiry</th>
            <th style={thStyle}>Blacklisted</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleVisitors.map((visitor) => (
            <tr key={visitor.id}>
              <td style={tdStyle}>{visitor.fullName}</td>
              <td style={tdStyle}>{visitor.company || "—"}</td>
              <td style={tdStyle}>{maskLastThreeDigits(visitor.phone)}</td>
              <td style={tdStyle}>{visitor.idType || "—"}</td>
              <td style={tdStyle}>{maskLastThreeDigits(visitor.idNumber)}</td>
              <td style={tdStyle}>{visitor.consentIssuedAt ? new Date(visitor.consentIssuedAt).toLocaleDateString() : "—"}</td>
              <td style={tdStyle}>{visitor.consentExpiresAt ? new Date(visitor.consentExpiresAt).toLocaleDateString() : "—"}</td>
              <td style={tdStyle}>
                {visitor.blacklisted ? `Yes${visitor.blacklistReason ? ` (${visitor.blacklistReason})` : ""}` : "No"}
              </td>
              <td style={tdStyle}>{new Date(visitor.createdAt).toLocaleString()}</td>
              <td style={tdStyle}>
                <div style={actionButtonsWrapStyle}>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => setCheckInModalVisitor(visitor)}
                    disabled={busyId === visitor.id || visitor.blacklisted}
                    title={visitor.blacklisted ? "Unblacklist visitor first." : "Create a new visit quickly."}
                  >
                    Check in again
                  </button>
                  <button
                    type="button"
                    style={buttonSecondaryStyle}
                    onClick={() => {
                      setPreregisterModalVisitor(visitor);
                      setPreregisterExpectedAt(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
                    }}
                    disabled={busyId === visitor.id || visitor.blacklisted}
                    title={visitor.blacklisted ? "Unblacklist visitor first." : "Create preregistration with saved details."}
                  >
                    Preregister
                  </button>
                  {visitor.blacklisted ? (
                    <button
                      type="button"
                      style={buttonSecondaryStyle}
                      onClick={() => void runAction(visitor, "unblacklist")}
                      disabled={busyId === visitor.id}
                    >
                      Unblacklist
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={buttonDangerStyle}
                      onClick={() => {
                        setBlacklistModalVisitor(visitor);
                        setBlacklistReason(visitor.blacklistReason ?? "");
                      }}
                      disabled={busyId === visitor.id}
                    >
                      Blacklist
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {visibleVisitors.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={10}>
                No visitors match the current search/filter.
              </td>
            </tr>
          ) : null}
        </tbody>
        </table>
      </div>
      {checkInModalVisitor ? (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <h3 style={modalTitleStyle}>Check in again</h3>
            <p style={modalTextStyle}>
              Check in <strong>{checkInModalVisitor.fullName}</strong> again?
            </p>
            <div style={modalActionsStyle}>
              <button type="button" style={buttonSecondaryStyle} onClick={() => setCheckInModalVisitor(null)}>
                Cancel
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={async () => {
                  const selected = checkInModalVisitor;
                  setCheckInModalVisitor(null);
                  await runAction(selected, "checkin");
                }}
                disabled={busyId === checkInModalVisitor.id}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {preregisterModalVisitor ? (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <h3 style={modalTitleStyle}>Preregister visitor</h3>
            <p style={modalTextStyle}>
              Set expected date/time for <strong>{preregisterModalVisitor.fullName}</strong>.
            </p>
            <label style={{ ...labelStyle, marginBottom: 6 }} htmlFor="preregister-expected-at">
              Expected date/time
            </label>
            <input
              id="preregister-expected-at"
              type="datetime-local"
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              value={preregisterExpectedAt}
              onChange={(e) => setPreregisterExpectedAt(e.target.value)}
            />
            <div style={modalActionsStyle}>
              <button type="button" style={buttonSecondaryStyle} onClick={() => setPreregisterModalVisitor(null)}>
                Cancel
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => void submitPreregister()}
                disabled={busyId === preregisterModalVisitor.id}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {blacklistModalVisitor ? (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <h3 style={modalTitleStyle}>Blacklist visitor</h3>
            <p style={modalTextStyle}>
              Blacklist <strong>{blacklistModalVisitor.fullName}</strong>? They will be blocked from future check-ins.
            </p>
            <label style={{ ...labelStyle, marginBottom: 6 }} htmlFor="blacklist-reason">
              Reason (optional)
            </label>
            <input
              id="blacklist-reason"
              type="text"
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              value={blacklistReason}
              onChange={(e) => setBlacklistReason(e.target.value)}
              placeholder="e.g. Security concern"
            />
            <div style={modalActionsStyle}>
              <button
                type="button"
                style={buttonSecondaryStyle}
                onClick={() => {
                  setBlacklistModalVisitor(null);
                  setBlacklistReason("");
                }}
                disabled={busyId === blacklistModalVisitor.id}
              >
                Cancel
              </button>
              <button
                type="button"
                style={buttonDangerStyle}
                onClick={() => void runAction(blacklistModalVisitor, "blacklist")}
                disabled={busyId === blacklistModalVisitor.id}
              >
                Confirm blacklist
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {feedbackModal ? (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <h3 style={modalTitleStyle}>{feedbackModal.title}</h3>
            <p style={modalTextStyle}>{feedbackModal.message}</p>
            <div style={modalActionsStyle}>
              <button type="button" style={buttonStyle} onClick={() => setFeedbackModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 800,
  color: "var(--vp-title)",
  borderBottom: "1px solid var(--vp-card-border)",
};

const tdStyle: CSSProperties = {
  padding: "12px 14px",
  fontSize: 14,
  color: "var(--text)",
  borderBottom: "1px solid var(--vp-card-border)",
  verticalAlign: "top",
};

const buttonStyle: CSSProperties = {
  border: "1px solid var(--vp-card-border)",
  background: "var(--brand-primary)",
  color: "#fff",
  borderRadius: 8,
  padding: "9px 14px",
  minHeight: 38,
  minWidth: 120,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  textAlign: "center",
  cursor: "pointer",
};

const buttonSecondaryStyle: CSSProperties = {
  ...buttonStyle,
  background: "var(--vp-card-bg)",
  color: "var(--text)",
};

const buttonDangerStyle: CSSProperties = {
  ...buttonStyle,
  background: "#d62839",
};

const actionButtonsWrapStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const controlWrapStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 220,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--vp-subtitle)",
};

const inputStyle: CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: "1px solid var(--vp-card-border)",
  background: "var(--vp-card-bg)",
  color: "var(--text)",
  padding: "0 10px",
};

const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 12,
};

const modalCardStyle: CSSProperties = {
  width: "min(460px, 100%)",
  borderRadius: 12,
  border: "1px solid var(--vp-card-border)",
  background: "var(--vp-card-bg)",
  padding: 14,
};

const modalTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 18,
  color: "var(--vp-title)",
};

const modalTextStyle: CSSProperties = {
  margin: "0 0 10px",
  color: "var(--vp-subtitle)",
  fontSize: 14,
};

const modalActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};
