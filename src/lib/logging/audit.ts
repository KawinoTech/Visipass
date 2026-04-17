import { NextRequest } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";

type AuditStatus = "SUCCESS" | "FAILURE";

type AuditInput = {
  event: string;
  status: AuditStatus;
  actorUserId?: string | null;
  actorLoginId?: string | null;
  targetUserId?: string | null;
  targetLoginId?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getRequestMeta(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}

export async function writeAuditLog(input: AuditInput) {
  const createdAt = new Date().toISOString();

  // Always write to file (primary audit trail).
  try {
    const logsDir = path.join(process.cwd(), "logs");
    await mkdir(logsDir, { recursive: true });
    const filePath = process.env.AUDIT_LOG_FILE || path.join(logsDir, "audit.log");
    const line = JSON.stringify({
      createdAt,
      event: input.event,
      status: input.status,
      actorUserId: input.actorUserId ?? null,
      actorLoginId: input.actorLoginId ?? null,
      targetUserId: input.targetUserId ?? null,
      targetLoginId: input.targetLoginId ?? null,
      message: input.message ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    await appendFile(filePath, `${line}\n`, "utf8");
  } catch (err) {
    console.error("Audit file write failed:", err);
  }

  // Also write to DB when Prisma delegate is available.
  try {
    const auditDelegate = (prisma as unknown as {
      auditLog?: {
        create: (args: {
          data: {
            createdAt: string;
            event: string;
            status: AuditStatus;
            actorUserId: string | null;
            actorLoginId: string | null;
            targetUserId: string | null;
            targetLoginId: string | null;
            message: string | null;
            metadata: string | null;
            ipAddress: string | null;
            userAgent: string | null;
          };
        }) => Promise<unknown>;
      };
    }).auditLog;

    // If Prisma client is stale (not regenerated after schema update), skip audit write safely.
    if (!auditDelegate) return;

    await auditDelegate.create({
      data: {
        createdAt,
        event: input.event,
        status: input.status,
        actorUserId: input.actorUserId ?? null,
        actorLoginId: input.actorLoginId ?? null,
        targetUserId: input.targetUserId ?? null,
        targetLoginId: input.targetLoginId ?? null,
        message: input.message ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Do not break the primary business flow if audit write fails.
    console.error("Audit log write failed:", err);
  }
}
