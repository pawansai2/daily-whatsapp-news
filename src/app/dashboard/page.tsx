import Link from "next/link";
import { redirect } from "next/navigation";

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
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const ownerEmail =
    process.env.OWNER_EMAIL
      ?.trim()
      .toLowerCase() ?? "";

  const authenticatedEmail =
    user.email
      ?.trim()
      .toLowerCase() ?? "";

  if (
    !ownerEmail ||
    authenticatedEmail !== ownerEmail
  ) {
    redirect("/login");
  }

  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from("personal_settings")
    .select(
      "digest_enabled, delivery_time, timezone",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

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

  const nextDelivery =
    settings
      ? getNextDeliveryLabel(settings)
      : "Configure settings first";

  return (
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

            <p className="mt-2 text-sm text-gray-500">
              Delivery channel: Telegram
            </p>
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

        {settingsError ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
          >
            Dashboard settings could not be loaded.
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
  );
}
