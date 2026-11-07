import { NextResponse, type NextRequest } from "next/server";

import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";

const protectedPaths = [
  "/dashboard",
  "/settings",
  "/history",
  "/news-preview",
  "/opportunities",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function proxy(request: NextRequest) {
  if (
    isProtectedPath(request.nextUrl.pathname) &&
    !request.cookies.has(FIREBASE_SESSION_COOKIE)
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
