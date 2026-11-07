"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";

import { getFirebaseClientAuth } from "@/lib/firebase/client";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Firebase session could not be cleared.");
      }

      await signOut(getFirebaseClientAuth());
      window.location.assign("/login");
    } catch (error) {
      console.error("firebase_logout_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
