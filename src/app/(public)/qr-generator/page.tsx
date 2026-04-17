"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/ui/Preloader";
import styles from "./qr-generator.module.css";

export default function QrGeneratorPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setDataUrl(null);
    if (!text.trim()) {
      setError("Please enter text to generate the QR code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/qr-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Failed to generate QR code.");
        return;
      }
      setDataUrl(data?.dataUrl ?? null);
    } catch {
      setError("Network error while generating QR code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>QR Code Generator</h1>
          <p className={styles.subtitle}>Generate QR codes using Node.js `qrcode` package.</p>
        </section>

        <section className={styles.card}>
          <label className={styles.label} htmlFor="qr-text">Text / URL to encode</label>
          <textarea
            id="qr-text"
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type visitor details, URL, or any text..."
          />
          <div className={styles.row}>
            <button className={styles.buttonPrimary} type="button" onClick={() => void generate()} disabled={loading}>
              {loading ? <Preloader label="Generating..." size="sm" /> : "Generate QR"}
            </button>
            <button className={styles.buttonSecondary} type="button" onClick={() => router.push("/login")} disabled={loading}>
              Back to Login
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        {dataUrl ? (
          <section className={styles.card}>
            <div className={styles.preview}>
              <img src={dataUrl} alt="Generated QR code" className={styles.qrImage} />
              <a href={dataUrl} download="visipass-qr.png" className={styles.buttonSecondary}>
                Download PNG
              </a>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
