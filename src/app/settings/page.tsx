import { redirect } from "next/navigation";

import { createClient } from "@/lib/firebase/server";
import { decryptPhone } from "@/lib/utils/crypto";

import { AppNav } from "@/components/AppNav";
import { SettingsSaveButton } from "@/components/SettingsSaveButton";

import { saveSettings } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_phone:
    "Enter a valid phone number including country code.",
  invalid_settings:
    "Check the entered settings and try again.",
  encryption_not_configured:
    "Phone encryption is not configured.",
  save_failed:
    "The settings could not be saved.",
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const firebaseStore = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await firebaseStore.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const [
    { data: settings, error: settingsError },
    { data: interests, error: interestsError },
  ] = await Promise.all([
    firebaseStore
      .from("personal_settings")
      .select(
        "encrypted_phone, language, custom_keywords, timezone, delivery_time, story_limit, digest_enabled",
      )
      .eq("owner_id", userId)
      .maybeSingle(),

    firebaseStore
      .from("personal_interests")
      .select("display_name")
      .eq("owner_id", userId)
      .order("created_at", {
        ascending: true,
      }),
  ]);

  let currentPhone = "";

  if (
    typeof settings?.encrypted_phone === "string"
  ) {
    try {
      currentPhone = decryptPhone(
        settings.encrypted_phone,
      );
    } catch {
      console.error(
        "settings_phone_decryption_failed",
      );
    }
  }

  const currentInterests =
    interests
      ?.map((interest) => interest.display_name)
      .join(", ") ?? "";

  const currentKeywords =
    Array.isArray(settings?.custom_keywords)
      ? settings.custom_keywords.join(", ")
      : "";

  const errorMessage = params.error
    ? errorMessages[params.error]
    : undefined;

  return (
    <>
      <AppNav />

      <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Personal Settings
      </h1>

      <p className="mt-2 text-gray-600">
        Configure your personal assistant preferences.
      </p>

      <a
        href="/settings/telegram"
        className="mt-4 inline-block rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
      >
        Manage Telegram connection
      </a>
      <a
        href="/settings/opportunities"
        className="ml-3 mt-4 inline-block rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
      >
        Edit eligibility profile
      </a>

      {params.saved === "all" ? (
        <div
          role="status"
          className="mt-6 rounded-md border border-green-200 bg-green-50 p-3 text-green-700"
        >
          Settings saved successfully.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      {settingsError || interestsError ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
        >
          Existing settings could not be loaded.
        </div>
      ) : null}

      <form
        action={saveSettings}
        className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow"
      >
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700"
          >
            Phone number (optional)
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={currentPhone}
            placeholder="+919999999999"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="interests"
            className="block text-sm font-medium text-gray-700"
          >
            Topics
          </label>

          <input
            id="interests"
            name="interests"
            type="text"
            defaultValue={currentInterests}
            placeholder="AI, Technology, Space"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />

          <p className="mt-1 text-sm text-gray-500">
            Separate topics using commas.
          </p>
        </div>

        <div>
          <label
            htmlFor="custom_keywords"
            className="block text-sm font-medium text-gray-700"
          >
            Custom keywords
          </label>

          <input
            id="custom_keywords"
            name="custom_keywords"
            type="text"
            defaultValue={currentKeywords}
            placeholder="OpenAI, ISRO, startups"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="language"
            className="block text-sm font-medium text-gray-700"
          >
            Language
          </label>

          <select
            id="language"
            name="language"
            defaultValue={settings?.language ?? "en"}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="te">Telugu</option>
            <option value="ta">Tamil</option>
            <option value="kn">Kannada</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="delivery_time"
            className="block text-sm font-medium text-gray-700"
          >
            Delivery time
          </label>

          <input
            id="delivery_time"
            name="delivery_time"
            type="time"
            required
            defaultValue={
              settings?.delivery_time ?? "08:00"
            }
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="timezone"
            className="block text-sm font-medium text-gray-700"
          >
            Timezone
          </label>

          <input
            id="timezone"
            name="timezone"
            type="text"
            required
            defaultValue={
              settings?.timezone ?? "Asia/Kolkata"
            }
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="story_limit"
            className="block text-sm font-medium text-gray-700"
          >
            Stories per digest
          </label>

          <input
            id="story_limit"
            name="story_limit"
            type="number"
            min="1"
            max="20"
            required
            defaultValue={settings?.story_limit ?? 10}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            name="digest_enabled"
            type="checkbox"
            defaultChecked={
              settings?.digest_enabled ?? false
            }
            className="h-4 w-4"
          />

          <span className="text-sm font-medium text-gray-700">
            Enable daily news digest
          </span>
        </label>

        <SettingsSaveButton />
      </form>
      </main>
    </>
  );
}
