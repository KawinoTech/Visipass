import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/visitors/:path*",
    "/visits/:path*",
    "/pre-registrations/:path*",
    "/reports/:path*",
    "/api/:path*",
  ],
};
