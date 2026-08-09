"use client";

import {
  useState,
} from "react";

type TelegramLinkClientProps = {
  connected: boolean;
  username: string | null;
};

type LinkCodeResponse = {
  code?: string;
  expiresAt?: string;
  error?: string;
};

export default function TelegramLinkClient({
  connected,
  username,
}: TelegramLinkClientProps) {
  const [code, setCode] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function generateCode() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/telegram/link-code",
        {
          method: "POST",
        },
      );

      const payload =
        (await response.json()) as
          LinkCodeResponse;

      if (
        !response.ok ||
        !payload.code
      ) {
        throw new Error(
          payload.error ||
            "Could not generate link code.",
        );
      }

      setCode(payload.code);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate link code.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Telegram
      </h2>

      {connected ? (
        <div className="mt-4">
          <p className="font-medium text-green-700">
            ✅ Connected
          </p>

          {username ? (
            <p className="mt-1 text-sm text-gray-600">
              @{username}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-gray-600">
          Telegram is not connected to this account.
        </p>
      )}

      <button
        type="button"
        onClick={generateCode}
        disabled={loading}
        className="mt-6 rounded-md bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading
          ? "Generating..."
          : connected
            ? "Generate new link code"
            : "Connect Telegram"}
      </button>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {code ? (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm text-gray-700">
            Open your Telegram bot and send:
          </p>

          <code className="mt-3 block text-xl font-bold tracking-wider text-gray-950">
            /link {code}
          </code>

          <p className="mt-3 text-sm text-gray-600">
            This code expires in 10 minutes and can be used only once.
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900"
          >
            Refresh connection status
          </button>
        </div>
      ) : null}
    </section>
  );
}
