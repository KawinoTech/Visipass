import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body as { text?: string })?.text?.trim();
  if (!text) {
    return NextResponse.json({ message: "Text is required to generate QR code." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ message: "Text is too long (max 2000 chars)." }, { status: 400 });
  }

  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 360,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
    return NextResponse.json({ dataUrl }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to generate QR code." }, { status: 500 });
  }
}
