import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

type JwtPayload = {
  sub?: string;
  userId?: string;
  role?: string;
  exp?: number;
};

export function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieToken =
    request.cookies.get("access_token")?.value ?? request.cookies.get("token")?.value ?? null;
  const token = bearer || cookieToken;

  if (!token) {
    return { ok: false as const, status: 401, message: "Unauthorized: missing token." };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false as const, status: 500, message: "Server misconfiguration: missing JWT_SECRET." };
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    const role = decoded?.role;
    if (role !== "ADMIN") {
      return { ok: false as const, status: 403, message: "Forbidden: admin access required." };
    }

    return {
      ok: true as const,
      userId: decoded.sub || decoded.userId || null,
      role: "ADMIN" as const,
    };
  } catch {
    return { ok: false as const, status: 401, message: "Unauthorized: invalid or expired token." };
  }
}

