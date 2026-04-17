import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db/prisma";
import { POST } from "./route";

function mockReq(body: unknown, shouldThrow = false) {
  return {
    json: shouldThrow ? vi.fn().mockRejectedValue(new Error("bad json")) : vi.fn().mockResolvedValue(body),
  } as any;
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 400 when userId or password is missing", async () => {
    const res = await POST(mockReq({ userId: "", password: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);
    const res = await POST(mockReq({ userId: "admin.main", password: "Mua@2020" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toBe("Invalid credentials.");
  });

  it("returns 401 when password is invalid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      userLoginId: "admin.main",
      fullName: "Admin Main",
      role: "ADMIN",
      isActive: true,
      passwordHash: "hash",
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as any);

    const res = await POST(mockReq({ userId: "admin.main", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 and user payload for valid credentials", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      userLoginId: "admin.main",
      fullName: "Admin Main",
      role: "ADMIN",
      isActive: true,
      passwordHash: "hash",
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
    vi.mocked(jwt.sign).mockReturnValue("token-123" as any);

    const res = await POST(mockReq({ userId: "admin.main", password: "Mua@2020" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.userLoginId).toBe("admin.main");
  });
});
