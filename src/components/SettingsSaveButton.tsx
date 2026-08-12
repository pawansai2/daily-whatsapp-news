"use client";

import { useFormStatus } from "react-dom";

export function SettingsSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? "Saving settings..."
        : "Save all settings"}
    </button>
  );
}
