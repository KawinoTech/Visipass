import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { VisitorsTable } from "./VisitorsTable";

export default async function VisitorsPage() {
  const consentExpiryDaysRaw = Number(process.env.CONSENT_EXPIRY_DAYS ?? "90");
  const consentExpiryDays = Number.isFinite(consentExpiryDaysRaw) && consentExpiryDaysRaw > 0 ? consentExpiryDaysRaw : 90;

  const visitors = await prisma.visitor.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fullName: true,
      company: true,
      phone: true,
      idType: true,
      idNumber: true,
      blacklisted: true,
      blacklistReason: true,
      createdAt: true,
      visits: {
        where: {
          visitorConsentAt: {
            not: null,
          },
        },
        orderBy: {
          visitorConsentAt: "asc",
        },
        take: 1,
        select: {
          visitorConsentAt: true,
        },
      },
    },
  });
  const visitorsWithConsent = visitors.map((visitor) => {
    const consentIssuedAt = visitor.visits[0]?.visitorConsentAt ?? null;
    const consentExpiresAt = consentIssuedAt
      ? new Date(consentIssuedAt.getTime() + consentExpiryDays * 24 * 60 * 60 * 1000)
      : null;
    return {
      id: visitor.id,
      fullName: visitor.fullName,
      company: visitor.company,
      phone: visitor.phone,
      idType: visitor.idType,
      idNumber: visitor.idNumber,
      blacklisted: visitor.blacklisted,
      blacklistReason: visitor.blacklistReason,
      createdAt: visitor.createdAt,
      consentIssuedAt,
      consentExpiresAt,
    };
  });

  return (
    <main
      style={{
        minHeight: "calc(100vh - 64px)",
        padding: "clamp(16px, 4vw, 32px)",
        background: "var(--vp-page-bg)",
        color: "var(--text)",
      }}
    >
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <nav style={{ marginBottom: 16 }} aria-label="Breadcrumb">
          <Link
            href="/home"
            style={{
              color: "var(--brand-primary)",
              fontWeight: 800,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← Back to Home
          </Link>
        </nav>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "var(--vp-title)" }}>Visitors</h1>
        <p style={{ margin: "12px 0 16px", lineHeight: 1.55, color: "var(--vp-subtitle)", fontSize: 15 }}>
          Checked-in visitor profiles are listed below.
        </p>

        {visitors.length === 0 ? (
          <p style={{ margin: "8px 0 0", color: "var(--vp-subtitle)" }}>No visitors found yet.</p>
        ) : (
          <VisitorsTable visitors={visitorsWithConsent} />
        )}
      </div>
    </main>
  );
}
