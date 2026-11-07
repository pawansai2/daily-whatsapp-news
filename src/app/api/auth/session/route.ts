import { NextResponse } from "next/server";

import { isOwnerClaims } from "@/lib/auth/authorization";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  let body: { idToken?: unknown };
  try {
    body = (await request.json()) as { idToken?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.idToken !== "string" || !body.idToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const auth = await getFirebaseAdminAuth();
    const claims = await auth.verifyIdToken(body.idToken, true);

    if (!isOwnerClaims(claims)) {
      return NextResponse.json(
        { error: "This account is not authorized for this deployment." },
        { status: 403 },
      );
    }

    const sessionCookie = await auth.createSessionCookie(body.idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ status: "signed-in" });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error("firebase_session_create_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Firebase sign-in could not be completed." },
      { status: 401 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const response = NextResponse.json({ status: "signed-out" });
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
