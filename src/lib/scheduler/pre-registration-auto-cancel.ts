import { prisma } from "@/lib/db/prisma";

const DAILY_RUN_HOUR_24 = 17; // 5 PM
const DAILY_RUN_MINUTE = 0;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

declare global {
  // Prevent duplicate schedulers during dev hot reloads.
  // eslint-disable-next-line no-var
  var __visipassPreRegAutoCancelStarted__: boolean | undefined;
}

function msUntilNextRun(now: Date) {
  const next = new Date(now);
  next.setHours(DAILY_RUN_HOUR_24, DAILY_RUN_MINUTE, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function runPreRegistrationAutoCancelSweep() {
  const now = new Date();
  const startOfTomorrow = new Date(now);
  startOfTomorrow.setHours(0, 0, 0, 0);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  try {
    const result = await prisma.preRegistration.updateMany({
      where: {
        status: "PENDING",
        expectedAt: {
          lt: startOfTomorrow,
        },
      },
      data: {
        status: "CANCELLED",
      },
    });
    console.info(
      `[visipass] Pre-registration auto-cancel sweep complete at ${now.toISOString()} (cancelled: ${result.count}).`,
    );
  } catch (error) {
    console.error("[visipass] Pre-registration auto-cancel sweep failed:", error);
  }
}

export function startPreRegistrationAutoCancelScheduler() {
  if (globalThis.__visipassPreRegAutoCancelStarted__) return;
  globalThis.__visipassPreRegAutoCancelStarted__ = true;

  const initialDelayMs = msUntilNextRun(new Date());
  console.info(
    `[visipass] Pre-registration auto-cancel scheduler started. First run in ${Math.round(initialDelayMs / 1000)}s.`,
  );

  setTimeout(() => {
    void runPreRegistrationAutoCancelSweep();
    setInterval(() => {
      void runPreRegistrationAutoCancelSweep();
    }, ONE_DAY_MS);
  }, initialDelayMs);
}
