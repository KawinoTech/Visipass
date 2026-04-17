import { describe, expect, it } from "vitest";
import { createUserRequestSchema } from "./create-user";

describe("createUserRequestSchema", () => {
  it("accepts a valid head office payload", () => {
    const result = createUserRequestSchema.safeParse({
      fullName: "Admin Main",
      userLoginId: "admin.main",
      email: "admin.main@mua.co.ke",
      location: "HEAD_OFFICE",
      floor: "FIRST_FLOOR",
      role: "ADMIN",
      password: "Mua@2020",
    });
    expect(result.success).toBe(true);
  });

  it("rejects email outside mua.co.ke domain", () => {
    const result = createUserRequestSchema.safeParse({
      fullName: "Admin Main",
      userLoginId: "admin.main",
      email: "admin.main@gmail.com",
      location: "HEAD_OFFICE",
      floor: null,
      role: "ADMIN",
      password: "Mua@2020",
    });
    expect(result.success).toBe(false);
  });

  it("rejects floor when location is not head office", () => {
    const result = createUserRequestSchema.safeParse({
      fullName: "Branch User",
      userLoginId: "branch.user",
      email: "branch.user@mua.co.ke",
      location: "NAKURU_BRANCH",
      floor: "GROUND_FLOOR",
      role: "RECEPTIONIST",
      password: "Mua@2020",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password", () => {
    const result = createUserRequestSchema.safeParse({
      fullName: "Weak User",
      userLoginId: "weak.user",
      email: "weak.user@mua.co.ke",
      location: "HEAD_OFFICE",
      floor: null,
      role: "SECURITY",
      password: "password",
    });
    expect(result.success).toBe(false);
  });
});
