import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardSettings = {
  digest_enabled: boolean | null;
  delivery_time: string | null;
  timezone: string | null;
};

function getCurrentMinutesInTimezone(
  timezone: string,
): number {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );

  const parts =
    formatter.formatToParts(new Date());

  const hour = Number(
    parts.find(
      (part) => part.type === "hour",
    )?.value ?? "0",
  );

  const minute = Number(
    parts.find(
      (part) => part.type === "minute",
    )?.value ?? "0",
  );

  return hour * 60 + minute;
}

function formatDeliveryTime(
  value: string,
): string {
  const [hourText, minuteText] =
    value.split(":");

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return value;
  }

  const period =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${String(displayHour).padStart(
    2,
    "0",
  )}:${String(minute).padStart(
    2,
    "0",
  )} ${period}`;
}

function getNextDeliveryLabel(
  settings: DashboardSettings,
): string {
  if (!settings.digest_enabled) {
    return "Digest paused";
  }

  const deliveryTime =
    settings.delivery_time ?? "08:00";

  const timezone =
    settings.timezone ?? "Asia/Kolkata";

  const [hourText, minuteText] =
    deliveryTime.split(":");

  const deliveryMinutes =
    Number(hourText) * 60 +
    Number(minuteText);

  if (!Number.isFinite(deliveryMinutes)) {
    return formatDeliveryTime(
      deliveryTime,
    );
  }

  let currentMinutes: number;

  try {
    currentMinutes =
      getCurrentMinutesInTimezone(
        timezone,
      );
  } catch {
    currentMinutes =
      getCurrentMinutesInTimezone(
        "Asia/Kolkata",
      );
  }

  const day =
    currentMinutes < deliveryMinutes
      ? "Today"
      : "Tomorrow";

  return `${day} at ${formatDeliveryTime(
    deliveryTime,
  )}`;
}

export default async function DashboardPage() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

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
      data: telegramChannel,
      error: telegramError,
    },
  ] = await Promise.all([
    supabase
      .from("personal_settings")
      .select(
        "digest_enabled, delivery_time, timezone",
      )
      .eq("owner_id", userId)
      .maybeSingle(),

    supabase
      .from("user_channels")
      .select(
        "username, verified_at, is_active",
      )
      .eq("user_id", userId)
      .eq("channel", "telegram")
      .maybeSingle(),
  ]);

  if (settingsError) {
    console.error(
      "dashboard_settings_load_failed",
      {
        code: settingsError.code,
      },
    );
  }

  const digestEnabled =
    settings?.digest_enabled ?? false;

  const telegramConnected =
    Boolean(
      telegramChannel?.is_active &&
        telegramChannel?.verified_at,
    );

  const nextDelivery =
    settings
      ? getNextDeliveryLabel(settings)
      : "Configure settings first";

  return (
    <>
      <AppNav />

      <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-900">
          Dashboard
        </h1>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">
              Digest Status
            </h2>

            <p
              className={`mt-4 text-xl font-semibold ${
                digestEnabled
                  ? "text-green-600"
                  : "text-gray-500"
              }`}
            >
              {digestEnabled
                ? "Active"
                : "Paused"}
            </p>

            <div className="mt-4">
              <p
                className={`font-medium ${
                  telegramConnected
                    ? "text-green-700"
                    : "text-amber-700"
                }`}
              >
                {telegramConnected
                  ? "Telegram connected"
                  : "Telegram not connected"}
              </p>

              {telegramConnected &&
              telegramChannel?.username ? (
                <p className="mt-1 text-sm text-gray-500">
                  @{telegramChannel.username}
                </p>
              ) : null}

              <Link
                href="/settings/telegram"
                className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
              >
                {telegramConnected
                  ? "Manage Telegram"
                  : "Connect Telegram"}
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">
              Next Delivery
            </h2>

            <p className="mt-4 text-xl text-gray-900">
              {nextDelivery}
            </p>

            {settings?.timezone ? (
              <p className="mt-2 text-sm text-gray-500">
                {settings.timezone}
              </p>
            ) : null}
          </section>
        </div>

        {settingsError || telegramError ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
          >
            Some dashboard information could not be loaded.
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/settings"
            className="rounded-md bg-gray-200 px-5 py-3 font-medium text-gray-900 hover:bg-gray-300"
          >
            Settings
          </Link>

          <Link
            href="/news-preview"
            className="rounded-md bg-gray-200 px-5 py-3 font-medium text-gray-900 hover:bg-gray-300"
          >
            Preview Digest
          </Link>
        </div>
      </div>
      </main>
    </>
  );
}
