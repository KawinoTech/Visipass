import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
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
      return NextResponse.json(
        { message: "Database request failed.", code: err.code },
        { status: 500 },
      );
    }
    return NextResponse.json({ message: "Failed to process login." }, { status: 500 });
  }

  if (!user || !user.isActive) {
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }

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
