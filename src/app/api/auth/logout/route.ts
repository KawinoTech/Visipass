import { NextRequest, NextResponse } from "next/server";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  try {
    const res = NextResponse.json({ message: "Logged out." }, { status: 200 });
    res.cookies.set("access_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    res.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    await writeAuditLog({
      event: "AUTH_LOGOUT",
      status: "SUCCESS",
      message: "Session logout completed.",
      ipAddress,
      userAgent,
    });
    return res;
  } catch {
    await writeAuditLog({
      event: "AUTH_LOGOUT",
      status: "FAILURE",
      message: "Logout failed unexpectedly.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to logout." }, { status: 500 });
  }
}
