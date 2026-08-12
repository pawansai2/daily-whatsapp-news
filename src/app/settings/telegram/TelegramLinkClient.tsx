"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type TelegramLinkClientProps = {
  connected: boolean;
  username: string | null;
};

type LinkCodeResponse = {
  code?: string;
  expiresAt?: string;
  error?: string;
};

type StatusResponse = {
  connected?: boolean;
  username?: string | null;
  error?: string;
};

export default function TelegramLinkClient({
  connected,
  username,
}: TelegramLinkClientProps) {
  const router = useRouter();

  const [
    connectedState,
    setConnectedState,
  ] = useState(connected);

  const [
    usernameState,
    setUsernameState,
  ] = useState<string | null>(
    username,
  );

  const [code, setCode] =
    useState<string | null>(null);

  const [expiresAt, setExpiresAt] =
    useState<string | null>(null);

  const [generating, setGenerating] =
    useState(false);

  const [testing, setTesting] =
    useState(false);

  const [
    disconnecting,
    setDisconnecting,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState(false);

  async function readStatus():
    Promise<boolean> {
    const response = await fetch(
      "/api/telegram/status",
      {
        method: "GET",
        cache: "no-store",
      },
    );

    const payload =
      (await response.json()) as
        StatusResponse;

    if (!response.ok) {
      throw new Error(
        payload.error ||
          "Could not check Telegram status.",
      );
    }

    const isConnected =
      payload.connected === true;

    setConnectedState(
      isConnected,
    );

    setUsernameState(
      isConnected
        ? payload.username ?? null
        : null,
    );

    return isConnected;
  }

  async function generateCode() {
    setGenerating(true);
    setError(null);
    setNotice(null);
    setCopied(false);

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
        !payload.code ||
        !payload.expiresAt
      ) {
        throw new Error(
          payload.error ||
            "Could not generate link code.",
        );
      }

      setCode(payload.code);
      setExpiresAt(
        payload.expiresAt,
      );

      setNotice(
        "Waiting for Telegram confirmation...",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate link code.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function copyCommand() {
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `/link ${code}`,
      );

      setCopied(true);
    } catch {
      setCopied(false);

      setError(
        "Could not copy the command. Copy it manually instead.",
      );
    }
  }

  async function sendTestMessage() {
    setTesting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        "/api/telegram/test",
        {
          method: "POST",
        },
      );

      const payload =
        (await response.json()) as {
          status?: string;
          error?: string;
        };

      if (
        !response.ok ||
        payload.status !== "sent"
      ) {
        throw new Error(
          payload.error ||
            "Test message could not be sent.",
        );
      }

      setNotice(
        "Test message sent successfully.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Test message could not be sent.",
      );
    } finally {
      setTesting(false);
    }
  }

  async function disconnectTelegram() {
    const confirmed =
      window.confirm(
        "Disconnect Telegram from this account?",
      );

    if (!confirmed) {
      return;
    }

    setDisconnecting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        "/api/telegram/disconnect",
        {
          method: "POST",
        },
      );

      const payload =
        (await response.json()) as {
          status?: string;
          error?: string;
        };

      if (
        !response.ok ||
        payload.status !==
          "disconnected"
      ) {
        throw new Error(
          payload.error ||
            "Telegram could not be disconnected.",
        );
      }

      setConnectedState(false);
      setUsernameState(null);
      setCode(null);
      setExpiresAt(null);

      setNotice(
        "Telegram disconnected.",
      );

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Telegram could not be disconnected.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  /*
   * After a link code is generated, poll only until:
   * - Telegram connects,
   * - the code expires,
   * - or the component unmounts.
   */
  useEffect(() => {
    if (!code || !expiresAt) {
      return;
    }

    let cancelled = false;
    let timer:
      ReturnType<typeof setTimeout> |
      undefined;

    async function poll() {
      if (cancelled) {
        return;
      }

      if (
        Date.now() >=
        new Date(
          expiresAt as string,
        ).getTime()
      ) {
        setCode(null);
        setExpiresAt(null);

        setNotice(null);

        setError(
          "The Telegram connection code expired. Generate a new code and try again.",
        );

        return;
      }

      try {
        const isConnected =
          await readStatus();

        if (
          isConnected ||
          cancelled
        ) {
          setCode(null);
          setExpiresAt(null);

          setError(null);

          setNotice(
            "Telegram connected successfully.",
          );

          router.refresh();

          return;
        }
      } catch {
        /*
         * A temporary status request failure should
         * not cancel the linking process.
         */
      }

      timer = setTimeout(
        poll,
        1500,
      );
    }

    timer = setTimeout(
      poll,
      500,
    );

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    code,
    expiresAt,
    router,
  ]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Telegram
      </h2>

      <div
        className="mt-4"
        aria-live="polite"
      >
        {connectedState ? (
          <>
            <p className="font-medium text-green-700">
              Connected
            </p>

            {usernameState ? (
              <p className="mt-1 text-sm text-gray-600">
                @{usernameState}
              </p>
            ) : null}

            <p className="mt-2 text-sm text-gray-500">
              Notifications can now be delivered to your linked Telegram account.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-amber-700">
              Not connected
            </p>

            <p className="mt-2 text-sm text-gray-600">
              Connect Telegram to receive news, reminders and future personal alerts.
            </p>
          </>
        )}
      </div>

      {connectedState ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={
              sendTestMessage
            }
            disabled={testing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing
              ? "Sending..."
              : "Send Test Message"}
          </button>

          <button
            type="button"
            onClick={generateCode}
            disabled={generating}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating
              ? "Generating..."
              : "Reconnect Telegram"}
          </button>

          <button
            type="button"
            onClick={
              disconnectTelegram
            }
            disabled={disconnecting}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {disconnecting
              ? "Disconnecting..."
              : "Disconnect"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generateCode}
          disabled={generating}
          className="mt-6 rounded-md bg-gray-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating
            ? "Generating..."
            : "Connect Telegram"}
        </button>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="mt-5 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {notice}
        </div>
      ) : null}

      {code ? (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <p className="font-medium text-gray-900">
            Complete Telegram connection
          </p>

          <p className="mt-2 text-sm text-gray-700">
            Open your Telegram bot and send this exact command:
          </p>

          <code className="mt-3 block rounded-md bg-white p-3 text-xl font-bold tracking-wider text-gray-950">
            /link {code}
          </code>

          <button
            type="button"
            onClick={copyCommand}
            className="mt-3 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-800"
          >
            {copied
              ? "Copied"
              : "Copy Command"}
          </button>

          <p className="mt-3 text-sm text-gray-600">
            This code expires in 10 minutes and works only once.
          </p>

          <p className="mt-2 text-sm font-medium text-blue-800">
            Connection status is being checked automatically. You do not need to refresh this page.
          </p>
        </div>
      ) : null}
    </section>
  );
}
