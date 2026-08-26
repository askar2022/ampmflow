import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-only-change-me",
);

const PUBLIC = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("bdt_session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      role = String(payload.role);
    } catch {
      role = null;
    }
  }

  if (PUBLIC.includes(pathname)) {
    if (role) {
      const url = request.nextUrl.clone();
      url.pathname =
        role === "TEACHER" ? "/teacher" : role === "BUS_COMPANY" ? "/company" : "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (role === "TEACHER" && !["/teacher", "/print"].some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith("/api")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/teacher";
    return NextResponse.redirect(url);
  }

  if (role === "BUS_COMPANY" && !pathname.startsWith("/company")) {
    if (pathname.startsWith("/api") || pathname.startsWith("/print")) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/company";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
