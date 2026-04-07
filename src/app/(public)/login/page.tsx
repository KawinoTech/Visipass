"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const headline = "Secure visitor management for your front desk.";
  const headlineWords = headline.split(" ");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!userId.trim() || !password) {
      setError("User ID and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Login failed.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brandTop}>
          {/* Company logo (stored in /public/images/mua-logo.png) */}
          <img src="/images/mua-logo.png" alt="MUA Logo" className={styles.logoImage} />
          <p className={styles.logoText}>VISIPASS</p>
          <h1 className={styles.title}>
            {headlineWords.map((word, idx) => (
              <span key={idx} className={styles.word}>
                {word}
              </span>
            ))}
          </h1>
          <p className={styles.subtitle}>
            Manage check-ins, pre-registrations, and guest card flows in one place.
          </p>
        </div>
        <p className={styles.meta}>MUA Kenya - Visitor Management v1</p>
      </section>

      <section className={styles.contentPanel}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Welcome back</h2>
            <p className={styles.cardSubtitle}>Sign in to continue to Visipass.</p>
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.field}>
              <label htmlFor="userid">
                User ID
              </label>
              <div className={styles.inputWrap}>
                {/* User icon */}
                <svg
                  className={styles.inputIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 12c2.761 0 5-2.239 5-5S14.761 2 12 2 7 4.239 7 7s2.239 5 5 5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 21a8 8 0 0 0-16 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <input
                  id="userid"
                  name="userid"
                  type="text"
                  className={styles.input}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password">
                Password
              </label>
              <div className={styles.inputWrap}>
                {/* Lock icon */}
                <svg
                  className={styles.inputIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 11h12v10H6V11Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className={styles.loginError}>{error}</p>}

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              <span className={styles.buttonInner}>
                {loading ? "Signing in..." : "Sign in"}
                {/* Arrow icon */}
                <svg
                  className={styles.buttonIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m13 5 7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
