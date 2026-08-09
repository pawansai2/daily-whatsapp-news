"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function redirectToLogin(error: string): never {
  redirect(`/login?error=${encodeURIComponent(error)}`);
}

export async function login(formData: FormData) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  const email =
    typeof emailValue === "string"
      ? emailValue.trim().toLowerCase()
      : "";

  const password =
    typeof passwordValue === "string"
      ? passwordValue
      : "";

  const ownerEmail =
    process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";

  if (!ownerEmail) {
    redirectToLogin("configuration_error");
  }

  if (!email || !password || email !== ownerEmail) {
    redirectToLogin("invalid_credentials");
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  const authenticatedEmail =
    data.user?.email?.trim().toLowerCase() ?? "";

  if (error || authenticatedEmail !== ownerEmail) {
    await supabase.auth.signOut();
    redirectToLogin("invalid_credentials");
  }

  redirect("/dashboard");
}