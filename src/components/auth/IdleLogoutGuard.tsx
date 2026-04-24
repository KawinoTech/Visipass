"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_IDLE_LOGOUT_MINUTES = 15;

function parseIdleMinutes() {
  const raw = process.env.NEXT_PUBLIC_IDLE_LOGOUT_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_IDLE_LOGOUT_MINUTES;
  return parsed;
}

export default function IdleLogoutGuard() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleMs = useMemo(() => parseIdleMinutes() * 60 * 1000, []);

  async function logoutNow() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  }

  function resetTimer() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void logoutNow();
    }, idleMs);
  }

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    for (const eventName of events) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }
    window.addEventListener("focus", resetTimer);
    resetTimer();

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, resetTimer);
      }
      window.removeEventListener("focus", resetTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [idleMs]);

  return null;
}
