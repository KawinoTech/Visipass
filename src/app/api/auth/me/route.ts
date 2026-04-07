import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

type JwtPayload = {
  sub?: string;
  userId?: string;
  userLoginId?: string;
  fullName?: string;
  role?: string;
  exp?: number;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "Server misconfiguration: missing JWT_SECRET." }, { status: 500 });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return NextResponse.json(
      {
        user: {
          id: decoded.sub || decoded.userId,
          userLoginId: decoded.userLoginId,
          fullName: decoded.fullName,
          role: decoded.role,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
}
