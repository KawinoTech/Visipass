import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
  if (!token) return NextResponse.json({ message: "Unauthorised." }, { status: 401 });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "Server misconfiguration: missing JWT_SECRET." }, { status: 500 });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    const userId = decoded.sub || decoded.userId;
    if (!userId) {
      return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, userLoginId: true, fullName: true, role: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      const res = NextResponse.json({ message: "Unauthorised." }, { status: 401 });
      res.cookies.set("access_token", "", { path: "/", maxAge: 0 });
      return res;
    }

    return NextResponse.json(
      {
        user: {
          id: dbUser.id,
          userLoginId: dbUser.userLoginId,
          fullName: dbUser.fullName,
          role: dbUser.role,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }
}
