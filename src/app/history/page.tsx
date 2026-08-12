import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DeliveryRow = {
  id: string;
  status?: string | null;
  channel?: string | null;
  scheduled_for?: string | null;
  sent_at?: string | null;
};

function formatDateTime(
  value: string | null | undefined,
  timezone: string,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      },
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      },
    ).format(date);
  }
}

export default async function HistoryPage() {
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
      data: deliveryData,
      error: deliveryError,
    },
    {
      data: settings,
    },
  ] = await Promise.all([
    supabase
      .from("deliveries")
      .select("*")
      .eq("owner_id", userId)
      .order("sent_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(50),

    supabase
      .from("personal_settings")
      .select("timezone")
      .eq("owner_id", userId)
      .maybeSingle(),
  ]);

  const deliveries =
    (deliveryData ?? []) as DeliveryRow[];

  const timezone =
    settings?.timezone ??
    "Asia/Kolkata";

  return (
    <>
      <AppNav />

      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Delivery History
          </h1>

          <p className="mt-2 text-gray-600">
            Real delivery records for your account.
          </p>

          {deliveryError ? (
            <div
              role="alert"
              className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700"
            >
              Delivery history could not be loaded.
            </div>
          ) : null}

          {!deliveryError &&
          deliveries.length === 0 ? (
            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                No deliveries yet
              </h2>

              <p className="mt-2 text-gray-500">
                Automatic and manual deliveries will appear here.
              </p>
            </div>
          ) : null}

          {deliveries.length > 0 ? (
            <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>

                    <th className="p-4 text-left text-sm font-semibold text-gray-700">
                      Channel
                    </th>

                    <th className="p-4 text-left text-sm font-semibold text-gray-700">
                      Scheduled
                    </th>

                    <th className="p-4 text-left text-sm font-semibold text-gray-700">
                      Sent
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {deliveries.map(
                    (delivery) => {
                      const status =
                        delivery.status ??
                        (delivery.sent_at
                          ? "sent"
                          : "pending");

                      return (
                        <tr
                          key={delivery.id}
                          className="border-t border-gray-100"
                        >
                          <td className="p-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                status ===
                                "sent"
                                  ? "bg-green-50 text-green-700"
                                  : status ===
                                      "failed"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {status}
                            </span>
                          </td>

                          <td className="p-4 text-sm text-gray-700">
                            {delivery.channel ??
                              "telegram"}
                          </td>

                          <td className="p-4 text-sm text-gray-700">
                            {formatDateTime(
                              delivery.scheduled_for,
                              timezone,
                            )}
                          </td>

                          <td className="p-4 text-sm text-gray-700">
                            {formatDateTime(
                              delivery.sent_at,
                              timezone,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
