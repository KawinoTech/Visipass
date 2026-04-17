import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

/**
 * Login API route.
 *
 * This module authenticates users against persisted credentials and issues a signed
 * JWT in an HTTP-only `access_token` cookie on success. It also records audit log
 * entries for every login attempt (success and failure) with request metadata.
 *
 * Request body:
 * - `userId`: user login ID
 * - `password`: raw password
 *
 * Behavior summary:
 * - Validates `JWT_SECRET` and request payload.
 * - Loads minimal user fields from the database.
 * - Handles Prisma availability/request errors with explicit responses.
 * - Rejects unknown/inactive users and password mismatches.
 * - Signs an 8-hour JWT and returns user profile data on success.
 */
export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "Server misconfiguration: missing JWT_SECRET." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const userId = (body as { userId?: string })?.userId?.trim();
  const password = (body as { password?: string })?.password ?? "";
  if (!userId || !password) {
    await writeAuditLog({
      event: "AUTH_LOGIN",
      status: "FAILURE",
      actorLoginId: userId || null,
      message: "Missing login credentials.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "User ID and password are required." }, { status: 400 });
  }

  let user:
    | {
        id: string;
        userLoginId: string;
        fullName: string;
        role: string;
        isActive: boolean;
        passwordHash: string;
      }
    | null = null;

  try {
    user = await prisma.user.findUnique({
      where: { userLoginId: userId },
      select: {
        id: true,
        userLoginId: true,
        fullName: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "AUTH_LOGIN",
        status: "FAILURE",
        actorLoginId: userId,
        message: "Database unavailable during login.",
        ipAddress,
        userAgent,
      });
      const devDetail =
        process.env.NODE_ENV !== "production"
          ? {
              detail: err.message,
              clientVersion: err.clientVersion,
            }
          : undefined;
      return NextResponse.json(
        { message: "Database unavailable. Please try again shortly.", ...devDetail },
        { status: 503 },
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      await writeAuditLog({
        event: "AUTH_LOGIN",
        status: "FAILURE",
        actorLoginId: userId,
        message: "Database request failed during login.",
        metadata: { code: err.code },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { message: "Database request failed.", code: err.code },
        { status: 500 },
      );
    }
    await writeAuditLog({
      event: "AUTH_LOGIN",
      status: "FAILURE",
      actorLoginId: userId,
      message: "Unexpected login processing failure.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to process login." }, { status: 500 });
  }

  if (!user || !user.isActive) {
    await writeAuditLog({
      event: "AUTH_LOGIN",
      status: "FAILURE",
      actorUserId: user?.id ?? null,
      actorLoginId: userId,
      message: !user ? "User not found." : "Account disabled.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await writeAuditLog({
      event: "AUTH_LOGIN",
      status: "FAILURE",
      actorUserId: user.id,
      actorLoginId: user.userLoginId,
      message: "Invalid password.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }

  await writeAuditLog({
    event: "AUTH_LOGIN",
    status: "SUCCESS",
    actorUserId: user.id,
    actorLoginId: user.userLoginId,
    message: "Login successful.",
    ipAddress,
    userAgent,
  });

  const token = jwt.sign(
    { role: user.role, userId: user.id, userLoginId: user.userLoginId, fullName: user.fullName },
    secret,
    { subject: user.id, expiresIn: "8h" },
  );

  const res = NextResponse.json(
    {
      message: "Login successful.",
      user: {
        id: user.id,
        userLoginId: user.userLoginId,
        fullName: user.fullName,
        role: user.role,
      },
    },
    { status: 200 },
  );

  res.cookies.set("access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return res;
}
