import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import TelegramLinkClient from "./TelegramLinkClient";

export const dynamic = "force-dynamic";

export default async function TelegramSettingsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "channel",
      "telegram",
    )
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
    <main className="mx-auto max-w-3xl p-8">
      <Link
        href="/settings"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to settings
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-gray-900">
        Telegram Connection
      </h1>

      <p className="mt-2 text-gray-600">
        Link this account to your Telegram chat so reminders and updates can be delivered privately to you.
      </p>

      <div className="mt-8">
        <TelegramLinkClient
          connected={connected}
          username={
            typeof channel?.username ===
            "string"
              ? channel.username
              : null
          }
        />
      </div>
    </main>
  );
}
