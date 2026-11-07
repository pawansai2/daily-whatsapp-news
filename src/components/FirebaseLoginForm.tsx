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
        const responseBody = response.headers
          .get("content-type")
          ?.includes("application/json")
          ? await response.json() as { error?: unknown }
          : null;
        const serverError =
          responseBody && typeof responseBody.error === "string"
            ? responseBody.error
            : "";

        await signOut(auth);
        if (serverError === "This account is not authorized for this deployment.") {
          setErrorMessage(
            "Firebase accepted your credentials, but this account is not authorized for the app. Set OWNER_EMAIL or OWNER_UID in the deployment environment, then redeploy.",
          );
        } else if (serverError === "Request origin is not allowed.") {
          setErrorMessage(
            "The sign-in request was rejected because of its origin. Check the deployment URL and allowed-origin configuration.",
          );
        } else {
          console.error("firebase_session_exchange_failed", {
            status: response.status,
          });
          setErrorMessage(
            "Firebase accepted your credentials, but the server could not create a session. Check the Firebase Admin configuration and try again.",
          );
        }
        return;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      console.error("firebase_login_failed", {
        code: error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown",
      });
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      setErrorMessage(
        code === "auth/invalid-credential" ||
          code === "auth/user-not-found" ||
          code === "auth/wrong-password"
          ? "Invalid email or password."
          : "Could not reach Firebase Authentication. Check the Firebase project configuration and try again.",
      );
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
