import Link from "next/link";

import { LogoutButton } from "./LogoutButton";

export function AppNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="border-b border-gray-200 bg-white"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-6 py-4">
        <Link
          href="/dashboard"
          className="mr-auto font-bold text-gray-950"
        >
          Daily Intelligence
        </Link>

        <Link
          href="/dashboard"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Dashboard
        </Link>

        <Link
          href="/opportunities"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Opportunities
        </Link>

        <Link
          href="/news-preview"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          News
        </Link>

        <Link
          href="/history"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          History
        </Link>

        <Link
          href="/settings/telegram"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Telegram
        </Link>

        <Link
          href="/settings/opportunities"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Eligibility profile
        </Link>

        <Link
          href="/settings"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Settings
        </Link>

        <LogoutButton />
      </div>
    </nav>
  );
}
