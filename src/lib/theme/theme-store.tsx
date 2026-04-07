"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";
export type AccentColor = "orange" | "blue";

export type ThemeState = {
  mode: ThemeMode;
  accent: AccentColor;
  username?: string;
};

type ThemeStore = {
  theme: ThemeState;
  setMode: (mode: ThemeMode) => Promise<void>;
  setAccent: (accent: AccentColor) => Promise<void>;
  signOut: () => Promise<void>;
};

const ThemeContext = createContext<ThemeStore | null>(null);

function getAccentVars(accent: AccentColor) {
  if (accent === "blue") {
    return { primary: "#3b82f6", primaryDark: "#1d4ed8" };
  }
  return { primary: "#ea580c", primaryDark: "#c2410c" };
}

/** Same values as `globals.css` — applied on `<html>` so light/dark always wins (like `--brand-*`). */
function applyModeSurfaceVars(mode: ThemeMode) {
  const root = document.documentElement.style;
  if (mode === "dark") {
    root.setProperty("--bg", "#0b1220");
    root.setProperty("--text", "#e5e7eb");
    root.setProperty("--vp-page-bg", "#0b1220");
    root.setProperty("--vp-card-bg", "#111827");
    root.setProperty("--vp-card-border", "#334155");
    root.setProperty("--vp-card-shadow", "0 18px 40px rgba(0, 0, 0, 0.45)");
    root.setProperty("--vp-title", "#f1f5f9");
    root.setProperty("--vp-subtitle", "#94a3b8");
    root.setProperty("--vp-label", "#cbd5e1");
    root.setProperty("--vp-label-hint", "#94a3b8");
    root.setProperty("--vp-input-bg", "#0f172a");
    root.setProperty("--vp-input-text", "#f1f5f9");
    root.setProperty("--vp-input-border", "#475569");
    root.setProperty("--vp-input-focus-ring", "rgba(59, 130, 246, 0.25)");
    root.setProperty("--vp-email-domain-bg", "#1e293b");
    root.setProperty("--vp-email-domain-text", "#e2e8f0");
    root.setProperty("--vp-secondary-btn-bg", "#1e293b");
    root.setProperty("--vp-secondary-btn-text", "#e2e8f0");
    root.setProperty("--vp-secondary-btn-border", "#475569");
    root.setProperty("--vp-msg-success-bg", "rgba(16, 185, 129, 0.15)");
    root.setProperty("--vp-msg-success-text", "#6ee7b7");
    root.setProperty("--vp-msg-success-border", "rgba(16, 185, 129, 0.35)");
    root.setProperty("--vp-msg-error-bg", "rgba(239, 68, 68, 0.18)");
    root.setProperty("--vp-msg-error-text", "#fecaca");
    root.setProperty("--vp-msg-error-border", "rgba(239, 68, 68, 0.35)");
    root.setProperty("--vp-field-error", "#fca5a5");
    root.setProperty("--vp-input-error-border", "#f87171");
    root.setProperty("--vp-input-error-ring", "rgba(248, 113, 113, 0.2)");
    return;
  }
  root.setProperty("--bg", "#ffffff");
  root.setProperty("--text", "#111827");
  root.setProperty("--vp-page-bg", "#f8fafc");
  root.setProperty("--vp-card-bg", "#ffffff");
  root.setProperty("--vp-card-border", "#e5e7eb");
  root.setProperty("--vp-card-shadow", "0 18px 30px rgba(148, 163, 184, 0.35)");
  root.setProperty("--vp-title", "#0f172a");
  root.setProperty("--vp-subtitle", "#475569");
  root.setProperty("--vp-label", "#334155");
  root.setProperty("--vp-label-hint", "#64748b");
  root.setProperty("--vp-input-bg", "#ffffff");
  root.setProperty("--vp-input-text", "#0f172a");
  root.setProperty("--vp-input-border", "#d1d5db");
  root.setProperty("--vp-input-focus-ring", "rgba(59, 130, 246, 0.2)");
  root.setProperty("--vp-email-domain-bg", "#f1f5f9");
  root.setProperty("--vp-email-domain-text", "#334155");
  root.setProperty("--vp-secondary-btn-bg", "#ffffff");
  root.setProperty("--vp-secondary-btn-text", "#0f172a");
  root.setProperty("--vp-secondary-btn-border", "#d1d5db");
  root.setProperty("--vp-msg-success-bg", "rgba(16, 185, 129, 0.12)");
  root.setProperty("--vp-msg-success-text", "#065f46");
  root.setProperty("--vp-msg-success-border", "rgba(16, 185, 129, 0.25)");
  root.setProperty("--vp-msg-error-bg", "rgba(239, 68, 68, 0.12)");
  root.setProperty("--vp-msg-error-text", "#7f1d1d");
  root.setProperty("--vp-msg-error-border", "rgba(239, 68, 68, 0.25)");
  root.setProperty("--vp-field-error", "#b91c1c");
  root.setProperty("--vp-input-error-border", "#ef4444");
  root.setProperty("--vp-input-error-ring", "rgba(239, 68, 68, 0.15)");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeState>({ mode: "light", accent: "orange" });

  // Load theme settings from server (placeholder endpoint).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/theme/me", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<ThemeState>;
        if (!alive) return;
        setTheme((prev) => ({
          ...prev,
          ...data,
          mode: data.mode === "dark" ? "dark" : "light",
          accent: data.accent === "blue" ? "blue" : "orange",
        }));
      } catch {
        // If server isn't ready yet, fall back to defaults.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Apply CSS variables + theme attribute.
  useEffect(() => {
    document.documentElement.dataset.theme = theme.mode;
    // Surface tokens: set on <html> so they match accent behavior (inline wins over stylesheet).
    applyModeSurfaceVars(theme.mode);

    const { primary, primaryDark } = getAccentVars(theme.accent);
    // Keep legacy CSS variable names working across the app.
    document.documentElement.style.setProperty("--brand-orange", primary);
    document.documentElement.style.setProperty("--brand-orange-dark", primaryDark);
    document.documentElement.style.setProperty("--brand-primary", primary);
    document.documentElement.style.setProperty("--brand-primary-dark", primaryDark);
  }, [theme.mode, theme.accent]);

  async function setMode(mode: ThemeMode) {
    // Optimistic update for responsiveness.
    setTheme((prev) => ({ ...prev, mode }));
    try {
      await fetch("/api/theme/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, accent: theme.accent }),
      });
    } catch {
      // Ignore until server logic is implemented.
    }
  }

  async function setAccent(accent: AccentColor) {
    setTheme((prev) => ({ ...prev, accent }));
    try {
      await fetch("/api/theme/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accent, mode: theme.mode }),
      });
    } catch {
      // Ignore until server logic is implemented.
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const value = useMemo<ThemeStore>(
    () => ({
      theme,
      setMode,
      setAccent,
      signOut,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeStore() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeStore must be used within a ThemeProvider.");
  return ctx;
}

