import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { GET, PATCH, DELETE } from "./route";

function mockReq(body?: unknown, shouldThrow = false) {
  return {
    json: shouldThrow ? vi.fn().mockRejectedValue(new Error("bad json")) : vi.fn().mockResolvedValue(body),
    headers: { get: vi.fn().mockReturnValue(null) },
    cookies: { get: vi.fn().mockReturnValue(undefined) },
  } as any;
}

function mockContext(id: string) {
  return { params: Promise.resolve({ id }) } as any;
}

describe("/api/users/[id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403, message: "Forbidden" } as any);
    const res = await GET(mockReq(), mockContext("u1"));
    expect(res.status).toBe(403);
  });

  it("GET returns 404 when user is missing", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);
    const res = await GET(mockReq(), mockContext("u1"));
    expect(res.status).toBe(404);
  });

  it("GET returns 200 when user exists", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      userLoginId: "user.one",
      fullName: "User One",
    } as any);
    const res = await GET(mockReq(), mockContext("u1"));
    expect(res.status).toBe(200);
  });

  it("PATCH returns 400 for empty payload", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    const res = await PATCH(mockReq({}), mockContext("u1"));
    expect(res.status).toBe(400);
  });

  it("PATCH returns 400 for invalid floor/location combination", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    const res = await PATCH(
      mockReq({ location: "NAKURU_BRANCH", floor: "FIRST_FLOOR" }),
      mockContext("u1"),
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 200 for valid update payload", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "founder",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: "u1",
      userLoginId: "user.one",
      fullName: "Updated User",
      role: "SECURITY",
      isActive: true,
    } as any);

    const res = await PATCH(
      mockReq({ fullName: "Updated User", role: "SECURITY", isActive: true }),
      mockContext("u1"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.fullName).toBe("Updated User");
  });

  it("PATCH returns 403 when founder admin role is changed", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);

    const res = await PATCH(mockReq({ role: "SECURITY" }), mockContext("u1"));
    expect(res.status).toBe(403);
  });

  it("PATCH returns 403 when founder admin status is changed", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);

    const res = await PATCH(mockReq({ isActive: false }), mockContext("u1"));
    expect(res.status).toBe(403);
  });

  it("PATCH returns 403 when editing founder admin profile details", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);

    const res = await PATCH(mockReq({ fullName: "Founder Updated" }), mockContext("u1"));
    expect(res.status).toBe(403);
  });

  it("DELETE returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403, message: "Forbidden" } as any);
    const res = await DELETE(mockReq(), mockContext("u1"));
    expect(res.status).toBe(403);
  });

  it("DELETE returns 404 when user is missing", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "founder",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);
    vi.mocked(prisma.user.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("User not found.", "P2025", "0.0.0") as any,
    );

    const res = await DELETE(mockReq(), mockContext("u1"));
    expect(res.status).toBe(404);
  });

  it("DELETE returns 200 when user is deleted", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "founder",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as any);

    const res = await DELETE(mockReq(), mockContext("u1"));
    expect(res.status).toBe(200);
  });

  it("DELETE returns 403 when deleting founder admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "admin1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: true,
      userLoginId: "founder.admin",
    } as any);

    const res = await DELETE(mockReq(), mockContext("u1"));
    expect(res.status).toBe(403);
  });
});
