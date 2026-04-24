import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).optional(),
    location: z
      .enum([
        "HEAD_OFFICE",
        "NAKURU_BRANCH",
        "ELDORET_BRANCH",
        "MERU_BRANCH",
        "NAIROBI_CBD_BRANCH",
        "THIKA_BRANCH",
      ])
      .optional(),
    floor: z.enum(["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"]).nullable().optional(),
    role: z.enum(["ADMIN", "RECEPTIONIST", "SECURITY", "EMPLOYEE"]).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.location && data.location !== "HEAD_OFFICE" && data.floor != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["floor"],
        message: "Floor can only be set for Head Office users.",
      });
    }
  });

async function getFounderAdmin() {
  return prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, role: true, isActive: true, userLoginId: true },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ message: "Failed to fetch user." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: "USER_UPDATE",
      status: "FAILURE",
      actorUserId: null,
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await writeAuditLog({
      event: "USER_UPDATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetUserId: id,
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await writeAuditLog({
      event: "USER_UPDATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetUserId: id,
      message: "Validation failed.",
      metadata: { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "Validation failed", fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    await writeAuditLog({
      event: "USER_UPDATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetUserId: id,
      message: "No changes provided.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "No changes provided." }, { status: 400 });
  }

  try {
    const founderAdmin = await getFounderAdmin();
    if (founderAdmin && founderAdmin.id === id) {
      await writeAuditLog({
        event: "USER_UPDATE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetUserId: id,
        targetLoginId: founderAdmin.userLoginId,
        message: "Founder admin account cannot be edited.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Founder admin account cannot be edited." }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        location: data.location,
        floor: data.location && data.location !== "HEAD_OFFICE" ? null : data.floor,
        role: data.role,
        isActive: data.isActive,
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
        updatedAt: true,
      },
    });

    await writeAuditLog({
      event: "USER_UPDATE",
      status: "SUCCESS",
      actorUserId: auth.userId,
      targetUserId: updated.id,
      targetLoginId: updated.userLoginId,
      message: "User updated successfully.",
      metadata: {
        fullName: updated.fullName,
        role: updated.role,
        isActive: updated.isActive,
        location: updated.location,
        floor: updated.floor,
      },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "USER_UPDATE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetUserId: id,
        message: "Database unavailable while updating user.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      await writeAuditLog({
        event: "USER_UPDATE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetUserId: id,
        message: "Target user not found.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    console.error(e);
    await writeAuditLog({
      event: "USER_UPDATE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetUserId: id,
      message: "Unexpected failure while updating user.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    await writeAuditLog({
      event: "USER_DELETE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetUserId: (await context.params).id,
      message: auth.message,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    const founderAdmin = await getFounderAdmin();
    if (founderAdmin && founderAdmin.id === id) {
      await writeAuditLog({
        event: "USER_DELETE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetUserId: id,
        targetLoginId: founderAdmin.userLoginId,
        message: "Founder admin cannot be deleted.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Founder admin cannot be deleted." }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    await writeAuditLog({
      event: "USER_DELETE",
      status: "SUCCESS",
      actorUserId: auth.userId,
      targetUserId: id,
      message: "User deleted successfully.",
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: "User deleted successfully." }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      await writeAuditLog({
        event: "USER_DELETE",
        status: "FAILURE",
        actorUserId: auth.userId,
        targetUserId: id,
        message: "Database unavailable while deleting user.",
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ message: "Database unavailable. Please try again shortly." }, { status: 503 });
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        await writeAuditLog({
          event: "USER_DELETE",
          status: "FAILURE",
          actorUserId: auth.userId,
          targetUserId: id,
          message: "Target user not found.",
          ipAddress,
          userAgent,
        });
        return NextResponse.json({ message: "User not found." }, { status: 404 });
      }

      // Deleting a user can fail when restricted by existing visits/pre-registrations.
      if (e.code === "P2003") {
        await writeAuditLog({
          event: "USER_DELETE",
          status: "FAILURE",
          actorUserId: auth.userId,
          targetUserId: id,
          message: "Cannot delete user due to existing related records. Disable instead.",
          ipAddress,
          userAgent,
        });
        return NextResponse.json(
          { message: "Cannot delete user due to existing related records. Disable instead." },
          { status: 409 },
        );
      }
    }

    console.error(e);
    await writeAuditLog({
      event: "USER_DELETE",
      status: "FAILURE",
      actorUserId: auth.userId,
      targetUserId: id,
      message: "Unexpected failure while deleting user.",
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: "Failed to delete user." }, { status: 500 });
  }
}
