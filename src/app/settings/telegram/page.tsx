import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";

import TelegramLinkClient from "./TelegramLinkClient";

export const dynamic = "force-dynamic";

export default async function TelegramSettingsPage() {
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

  const {
    data: channel,
    error: channelError,
  } = await supabase
    .from("user_channels")
    .select(
      "username, verified_at, is_active",
    )
    .eq("user_id", userId)
    .eq("channel", "telegram")
    .maybeSingle();

  if (channelError) {
    console.error(
      "telegram_channel_load_failed",
      {
        code: channelError.code,
      },
    );
  }

  const connected =
    Boolean(
      channel?.is_active &&
        channel?.verified_at,
    );

  return (
    <>
      <AppNav />

      <main className="mx-auto max-w-3xl p-8">
        <Link
          href="/settings"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Back to Settings
        </Link>

        <h1 className="mt-5 text-3xl font-bold text-gray-900">
          Telegram Connection
        </h1>

        <p className="mt-2 text-gray-600">
          Connect your Telegram account to receive Daily Intelligence notifications and control your assistant.
        </p>

        {channelError ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
          >
            Telegram connection status could not be loaded.
          </div>
        ) : null}

        <div className="mt-8">
          <TelegramLinkClient
            connected={connected}
            username={
              channel?.username ??
              null
            }
          />
        </div>
      </main>
    </>
  );
}
