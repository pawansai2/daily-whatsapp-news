"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePhoneNumberWithError } from "libphonenumber-js";

import { SettingsUpdateSchema } from "@/lib/schema/settings";
import { createClient } from "@/lib/supabase/server";
import { encryptPhone, hashPhone } from "@/lib/utils/crypto";

function redirectToSettings(parameter: string): never {
  redirect(`/settings?${parameter}`);
}

function readString(
  formData: FormData,
  name: string,
): string {
  const value = formData.get(name);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseList(value: string): string[] {
  const uniqueValues = new Map<string, string>();

  for (const item of value.split(",")) {
    const displayValue = item.trim();

    if (!displayValue) {
      continue;
    }

    const key = displayValue.toLocaleLowerCase();

    if (!uniqueValues.has(key)) {
      uniqueValues.set(key, displayValue);
    }
  }

  return Array.from(uniqueValues.values()).slice(0, 20);
}

function createSlug(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function saveSettings(
  formData: FormData,
) {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const interests = parseList(
    readString(formData, "interests"),
  );

  const customKeywords = parseList(
    readString(formData, "custom_keywords"),
  );

  const storyLimitValue = Number(
    readString(formData, "story_limit"),
  );

  const validation = SettingsUpdateSchema.safeParse({
    phone: readString(formData, "phone"),
    language: readString(formData, "language"),
    timezone: readString(formData, "timezone"),
    delivery_time: readString(
      formData,
      "delivery_time",
    ),
    story_limit: storyLimitValue,
    digest_enabled:
      formData.get("digest_enabled") === "on",
    interests,
    custom_keywords: customKeywords,
  });

  if (!validation.success) {
    console.error("settings_validation_failed", {
      issues: validation.error.issues.map(
        (issue) => issue.path.join("."),
      ),
    });

    redirectToSettings("error=invalid_settings");
  }

  let phoneLookupHash: string | null = null;
  let encryptedPhone: string | null = null;

  if (validation.data.phone) {
    let normalizedPhone: string;

    try {
      normalizedPhone =
        parsePhoneNumberWithError(
          validation.data.phone,
        ).number;
    } catch {
      redirectToSettings("error=invalid_phone");
    }

    const encryptionKey =
      process.env.PHONE_ENCRYPTION_KEY ?? "";

    if (encryptionKey.length !== 32) {
      redirectToSettings(
        "error=encryption_not_configured",
      );
    }

    phoneLookupHash =
      hashPhone(normalizedPhone);

    encryptedPhone =
      encryptPhone(normalizedPhone);
  }

  const { error: settingsError } = await supabase
    .from("personal_settings")
    .upsert(
      {
        owner_id: userId,
        phone_lookup_hash:
          phoneLookupHash,
        encrypted_phone:
          encryptedPhone,
        language: validation.data.language ?? "en",
        custom_keywords:
          validation.data.custom_keywords ?? [],
        timezone:
          validation.data.timezone || "Asia/Kolkata",
        delivery_time:
          validation.data.delivery_time ?? "08:00",
        story_limit:
          validation.data.story_limit ?? 10,
        digest_enabled:
          validation.data.digest_enabled ?? false,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "owner_id",
      },
    );

  if (settingsError) {
    console.error("settings_upsert_failed", {
      code: settingsError.code,
    });

    redirectToSettings("error=save_failed");
  }

  const { error: deleteInterestsError } =
    await supabase
      .from("personal_interests")
      .delete()
      .eq("owner_id", userId);

  if (deleteInterestsError) {
    console.error("interests_delete_failed", {
      code: deleteInterestsError.code,
    });

    redirectToSettings("error=save_failed");
  }

  const interestRows = interests
    .map((displayName) => ({
      owner_id: userId,
      normalized_slug: createSlug(displayName),
      display_name: displayName,
      interest_type: "custom",
    }))
    .filter((interest) => interest.normalized_slug);

  if (interestRows.length > 0) {
    const { error: insertInterestsError } =
      await supabase
        .from("personal_interests")
        .insert(interestRows);

    if (insertInterestsError) {
      console.error("interests_insert_failed", {
        code: insertInterestsError.code,
      });

      redirectToSettings("error=save_failed");
    }
  }

  revalidatePath("/settings");
  redirectToSettings("saved=all");
}
