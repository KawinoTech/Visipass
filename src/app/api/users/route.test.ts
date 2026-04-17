import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { GET, POST } from "./route";

function mockReq(body?: unknown, shouldThrow = false) {
  return {
    json: shouldThrow ? vi.fn().mockRejectedValue(new Error("bad json")) : vi.fn().mockResolvedValue(body),
  } as any;
}

describe("/api/users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403, message: "Forbidden" } as any);
    const res = await GET(mockReq());
    expect(res.status).toBe(403);
  });

  it("GET returns users when admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "u1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u2", userLoginId: "staff.a" }] as any);

    const res = await GET(mockReq());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
  });

  it("POST returns 400 for invalid payload", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "u1", role: "ADMIN" } as any);
    const res = await POST(mockReq({ fullName: "" }));
    expect(res.status).toBe(400);
  });

  it("POST creates user for valid payload", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "u1", role: "ADMIN" } as any);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as any);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u2",
      userLoginId: "new.user",
      fullName: "New User",
      email: "new.user@mua.co.ke",
      location: "HEAD_OFFICE",
      floor: null,
      role: "RECEPTIONIST",
      isActive: true,
      createdAt: new Date().toISOString(),
    } as any);

    const res = await POST(
      mockReq({
        fullName: "New User",
        userLoginId: "new.user",
        email: "new.user@mua.co.ke",
        location: "HEAD_OFFICE",
        floor: null,
        role: "RECEPTIONIST",
        password: "Mua@2020",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.userLoginId).toBe("new.user");
  });
});
