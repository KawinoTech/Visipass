import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { createUserRequestSchema } from "@/lib/validation/create-user";

export async function GET() {
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
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

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta as { target?: string[] } | undefined)?.target?.join(", ") ?? "field";
      return NextResponse.json(
        { message: `A user with this ${target} already exists.` },
        { status: 409 },
      );
    }

    console.error(e);
    return NextResponse.json({ message: "Failed to create user." }, { status: 500 });
  }
}
