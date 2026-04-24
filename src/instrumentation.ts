/**
 * Runs once when the Next.js Node.js server starts (not in Edge).
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ensureDefaultAdmin } = await import("@/lib/bootstrap/ensure-default-admin");
  const { startPreRegistrationAutoCancelScheduler } = await import("@/lib/scheduler/pre-registration-auto-cancel");
  await ensureDefaultAdmin();
  startPreRegistrationAutoCancelScheduler();
}
