import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getRequestMeta, writeAuditLog } from "@/lib/logging/audit";

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await writeAuditLog({
      event: "QR_CODE_GENERATE",
      status: "FAILURE",
      message: "Invalid JSON body.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body as { text?: string })?.text?.trim();
  if (!text) {
    await writeAuditLog({
      event: "QR_CODE_GENERATE",
      status: "FAILURE",
      message: "Text is required to generate QR code.",
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Text is required to generate QR code." }, { status: 400 });
  }
  if (text.length > 2000) {
    await writeAuditLog({
      event: "QR_CODE_GENERATE",
      status: "FAILURE",
      message: "QR text too long.",
      metadata: { length: text.length },
      ipAddress,
      userAgent,
    });
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
    await writeAuditLog({
      event: "QR_CODE_GENERATE",
      status: "SUCCESS",
      message: "QR code generated.",
      metadata: { length: text.length },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ dataUrl }, { status: 200 });
  } catch (error) {
    await writeAuditLog({
      event: "QR_CODE_GENERATE",
      status: "FAILURE",
      message: "Failed to generate QR code.",
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ message: "Failed to generate QR code." }, { status: 500 });
  }
}
