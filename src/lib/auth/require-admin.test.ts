import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "./require-admin";

function makeRequest(token?: string) {
  return {
    headers: {
      get: vi.fn().mockReturnValue(token ? `Bearer ${token}` : null),
    },
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
    },
  } as any;
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns unauthorized when token is missing", async () => {
    const result = await requireAdmin(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("returns unauthorized when token payload has no user id", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ role: "ADMIN" } as any);
    const result = await requireAdmin(makeRequest("abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("returns forbidden when account is disabled", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: "u1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: false,
    } as any);

    const result = await requireAdmin(makeRequest("abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns forbidden when role is not admin", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: "u1", role: "RECEPTIONIST" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      role: "RECEPTIONIST",
      isActive: true,
    } as any);

    const result = await requireAdmin(makeRequest("abc"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns ok true for active admin", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: "u1", role: "ADMIN" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: true,
    } as any);

    const result = await requireAdmin(makeRequest("abc"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe("u1");
  });
});
