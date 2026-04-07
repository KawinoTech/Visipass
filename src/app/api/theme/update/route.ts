import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Placeholder: in v1 this should persist the user's theme settings in the database.
  try {
    const body = await req.json().catch(() => null);
    return NextResponse.json({ ok: true, received: body });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

