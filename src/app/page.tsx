import AppHeader from "../components/header/AppHeader";
import styles from "./home-page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader />
      <div className={styles.shell}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Visipass Command Center</h1>
          <p className={styles.heroSub}>
            Access visitor operations, security workflows, pre-registration, and admin tools from one place.
          </p>
        </section>

        <section className={styles.stats}>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Currently On Site</p>
            <p className={styles.statValue}>24</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Expected Today</p>
            <p className={styles.statValue}>41</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Pre-registrations</p>
            <p className={styles.statValue}>13</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Alerts</p>
            <p className={styles.statValue}>2</p>
          </article>
        </section>

        <h2 className={styles.sectionTitle}>System Functions</h2>
        <section className={styles.grid}>
          <a className={styles.card} href="/users/new">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Admin</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>User Management</h3>
            <p className={styles.cardText}>Create and manage staff accounts, roles, and branch assignments.</p>
          </a>

          <a className={styles.card} href="/pre-registrations">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Front Desk</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>Pre-registration</h3>
            <p className={styles.cardText}>Register guests before arrival and convert quickly into active visits.</p>
          </a>

          <a className={styles.card} href="/visitors">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Reception</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>Visitors</h3>
            <p className={styles.cardText}>Maintain visitor profiles, blacklist checks, and visit histories.</p>
          </a>

          <a className={styles.card} href="/visits">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Security</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>Visit Operations</h3>
            <p className={styles.cardText}>Check-in/check-out flow, guest card tracking, and live visit statuses.</p>
          </a>

          <a className={styles.card} href="/dashboard">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Insights</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>Dashboard</h3>
            <p className={styles.cardText}>Real-time snapshot of active visitors, expected arrivals, and site activity.</p>
          </a>

          <a className={styles.card} href="/reports">
            <div className={styles.cardTop}>
              <span className={styles.badge}>Reporting</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3 className={styles.cardTitle}>Reports & Export</h3>
            <p className={styles.cardText}>Generate operational reports and export filtered data to CSV.</p>
          </a>
        </section>
      </div>
    </main>
  );
}
