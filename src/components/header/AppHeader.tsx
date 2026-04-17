"use client";

import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "../../lib/theme/theme-store";
import styles from "./app-header.module.css";

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21a8 8 0 0 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 12c2.761 0 5-2.239 5-5S14.761 2 12 2 7 4.239 7 7s2.239 5 5 5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AppHeader() {
  const { theme, setMode, setAccent, signOut } = useThemeStore();
  const [userOpen, setUserOpen] = useState(false);
  const [username, setUsername] = useState("User");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!userOpen) return;
      const el = dropdownRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setUserOpen(false);
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [userOpen]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!alive) return;
        const nextName = data?.user?.fullName || data?.user?.userLoginId || "User";
        setUsername(nextName);
      } catch {
        // Keep fallback name when session endpoint is unavailable.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <img src="/images/mua-logo.png" alt="MUA Logo" className={styles.logo} />
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void setMode(theme.mode === "dark" ? "light" : "dark")}
          aria-label="Toggle dark mode"
        >
          <span className={styles.iconText}>{theme.mode === "dark" ? "☾" : "☀"}</span>
        </button>

        <div className={styles.userArea} ref={dropdownRef}>
          <button
            type="button"
            className={styles.userButton}
            aria-haspopup="menu"
            aria-expanded={userOpen}
            onClick={() => setUserOpen((v) => !v)}
          >
            <UserIcon className={styles.userIcon} />
          </button>

          {userOpen && (
            <div className={styles.dropdown} role="menu" aria-label="User menu">
              <div className={styles.dropdownSection}>
                <div className={styles.dropdownHeader}>Signed in as</div>
                <div className={styles.dropdownUsername}>{username}</div>
              </div>

              <div className={styles.dropdownDivider} />

              <div className={styles.dropdownSection}>
                <label className={styles.dropdownLabel} htmlFor="header-accent-color">
                  Theme
                </label>
                <select
                  id="header-accent-color"
                  className={styles.dropdownSelect}
                  aria-label="Theme"
                  value={theme.accent}
                  onChange={(e) => void setAccent(e.target.value as "orange" | "blue")}
                >
                  <option value="orange">Orange</option>
                  <option value="blue">Blue</option>
                </select>
              </div>

              <div className={styles.dropdownDivider} />

              <button
                type="button"
                className={styles.signOutButton}
                onClick={() => {
                  setUserOpen(false);
                  void signOut();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

