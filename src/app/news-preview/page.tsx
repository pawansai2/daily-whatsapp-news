import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/firebase/server";

export const dynamic = "force-dynamic";

export default async function NewsPreviewPage() {
  const firebaseStore =
    await createClient();

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
    {
      data: settings,
      error: settingsError,
    },
    {
      data: interests,
      error: interestsError,
    },
  ] = await Promise.all([
    firebaseStore
      .from("personal_settings")
      .select(
        "language, custom_keywords, timezone, delivery_time, story_limit, digest_enabled",
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

  const topicNames =
    interests?.map(
      (interest) =>
        interest.display_name,
    ) ?? [];

  const customKeywords =
    Array.isArray(
      settings?.custom_keywords,
    )
      ? settings.custom_keywords
      : [];

  const loadError =
    settingsError ||
    interestsError;

  return (
    <>
      <AppNav />

      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                News
              </h1>

              <p className="mt-2 text-gray-600">
                Your personal news profile and digest configuration.
              </p>
            </div>

            <Link
              href="/settings"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Edit News Settings
            </Link>
          </div>

          {loadError ? (
            <div
              role="alert"
              className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700"
            >
              Your news configuration could not be loaded.
            </div>
          ) : null}

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Digest Status
              </h2>

              <p
                className={`mt-4 text-lg font-semibold ${
                  settings?.digest_enabled
                    ? "text-green-700"
                    : "text-gray-500"
                }`}
              >
                {settings?.digest_enabled
                  ? "Active"
                  : "Paused"}
              </p>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    Delivery time
                  </dt>

                  <dd className="font-medium text-gray-900">
                    {settings?.delivery_time ??
                      "Not configured"}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    Timezone
                  </dt>

                  <dd className="font-medium text-gray-900">
                    {settings?.timezone ??
                      "Asia/Kolkata"}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    Language
                  </dt>

                  <dd className="font-medium text-gray-900">
                    {settings?.language ??
                      "en"}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    Stories
                  </dt>

                  <dd className="font-medium text-gray-900">
                    {settings?.story_limit ??
                      10}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Your Topics
              </h2>

              {topicNames.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {topicNames.map(
                    (topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800"
                      >
                        {topic}
                      </span>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-4 text-gray-500">
                  No topics configured yet.
                </p>
              )}

              <h3 className="mt-6 font-semibold text-gray-900">
                Custom keywords
              </h3>

              {customKeywords.length >
              0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {customKeywords.map(
                    (keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                      >
                        {keyword}
                      </span>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  No custom keywords configured.
                </p>
              )}
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-950">
              Live digest preview
            </h2>

            <p className="mt-2 text-sm text-amber-900">
              The old demo stories have been removed. Live personalized stories will appear here when the news preview engine is connected to the same pipeline used by the automatic dispatcher.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
