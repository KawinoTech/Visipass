import { NextResponse } from "next/server";

export async function GET() {
  // Placeholder: in v1 this should be loaded from the database for the current user.
  return NextResponse.json({ mode: "light", accent: "orange" });
}

