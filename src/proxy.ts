import { NextResponse } from "next/server";

/*
 * This proxy currently performs no authentication.
 *
 * Real owner authorization must be implemented in the protected server
 * pages and mutation handlers. Do not treat this pass-through proxy as
 * an authentication boundary.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};