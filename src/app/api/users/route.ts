import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";
import { createUserRequestSchema } from "@/lib/validation/create-user";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userLoginId: true,
        fullName: true,
        email: true,
        location: true,
        floor: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ users }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ message: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: "USER_CREATE",
      status: "FAILURE",
      actorUserId: null,
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await writeAuditLog({
      event: "USER_CREATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await writeAuditLog({
      event: "USER_CREATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      message: "Validation failed.",
      metadata: { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      {
        message: "Validation failed",
        fieldErrors: flat.fieldErrors,
        formErrors: flat.formErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  // Explicit logical checks beyond schema constraints.
  if (data.location !== "HEAD_OFFICE" && data.floor != null) {
    await writeAuditLog({
      event: "USER_CREATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetLoginId: data.userLoginId,
      message: "Floor can only be provided for Head Office users.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Floor can only be provided for Head Office users." },
      { status: 422 },
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const floor =
    data.location === "HEAD_OFFICE" ? (data.floor === undefined ? null : data.floor) : null;

  try {
    const user = await prisma.user.create({
      data: {
        userLoginId: data.userLoginId,
        fullName: data.fullName,
        email: data.email,
        location: data.location,
        floor,
        role: data.role,
        passwordHash,
      },
      select: {
        id: true,
        userLoginId: true,
        fullName: true,
        email: true,
        location: true,
        floor: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      event: "USER_CREATE",
      status: "SUCCESS",
      actorUserId: auth.userId,
      targetUserId: user.id,
      targetLoginId: user.userLoginId,
      message: "User created successfully.",
      metadata: { role: user.role, location: user.location, isActive: user.isActive },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "USER_CREATE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetLoginId: data.userLoginId,
        message: "Database unavailable while creating user.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta as { target?: string[] } | undefined)?.target?.join(", ") ?? "field";
      await writeAuditLog({
        event: "USER_CREATE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetLoginId: data.userLoginId,
        message: "Unique constraint violation while creating user.",
        metadata: { target },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { message: `A user with this ${target} already exists.` },
        { status: 409 },
      );
    }

    console.error(e);
    await writeAuditLog({
      event: "USER_CREATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetLoginId: data.userLoginId,
      message: "Unexpected failure while creating user.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to create user." }, { status: 500 });
  }
}

