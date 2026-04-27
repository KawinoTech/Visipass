import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    const rows = await prisma.visitor.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        fullName: true,
        company: true,
        idNumber: true,
        phone: true,
        blacklisted: true,
      },
    });

    const q = query.toLowerCase();
    const filtered = q.length >= 2
      ? rows.filter((row) => {
          const name = (row.fullName || "").toLowerCase();
          const idNumber = (row.idNumber || "").toLowerCase();
          return name.includes(q) || idNumber.includes(q);
        })
      : rows;

    const items = filtered.slice(0, 20).map((row) => ({
        id: row.id,
        fullName: row.fullName,
        company: row.company,
        idNumber: row.idNumber,
        phone: row.phone,
        blacklisted: row.blacklisted,
      }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ message: "Service unavailable." }, { status: 503 });
    }
    return NextResponse.json({ message: "Failed to search visitors." }, { status: 500 });
  }
}
