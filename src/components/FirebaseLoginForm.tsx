"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { getFirebaseClientAuth } from "@/lib/firebase/client";

type FirebaseLoginFormProps = {
  initialError?: string;
};

export function FirebaseLoginForm({
  initialError,
}: FirebaseLoginFormProps) {
  const [errorMessage, setErrorMessage] = useState(initialError ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setErrorMessage("");

    try {
      const email = String(formData.get("email") ?? "")
        .trim()
        .toLowerCase();
      const password = String(formData.get("password") ?? "");
      const auth = getFirebaseClientAuth();
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        await signOut(auth);
        setErrorMessage(
          "Firebase sign-in could not be completed. Check the server configuration and try again.",
        );
        return;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      console.error("firebase_login_failed", {
        code:
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "unknown",
      });
      setErrorMessage("Invalid email or password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {errorMessage ? (
        <div
          role="alert"
          className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </>
  );
}
