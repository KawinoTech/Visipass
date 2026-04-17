import styles from "./preloader.module.css";

type Size = "sm" | "md" | "lg";

export function Preloader({
  label = "Loading...",
  size = "md",
}: {
  label?: string;
  size?: Size;
}) {
  return (
    <span className={styles.wrap} role="status" aria-live="polite">
      <span className={`${styles.spinner} ${styles[size]}`} aria-hidden="true" />
      {label ? <span className={styles.label}>{label}</span> : null}
    </span>
  );
}

export function LoadingOverlay({ label = "Please wait..." }: { label?: string }) {
  return (
    <div className={styles.overlay} role="alert" aria-busy="true" aria-live="assertive">
      <div className={styles.overlayCard}>
        <Preloader label={label} size="lg" />
      </div>
    </div>
  );
}
