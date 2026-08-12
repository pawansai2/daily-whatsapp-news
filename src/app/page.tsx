import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-gray-900">
      <h1 className="text-center text-4xl font-bold">
        Personal Daily Intelligence Assistant
      </h1>

      <p className="mt-4 max-w-xl text-center text-lg text-gray-600">
        Personalized news, notifications and personal assistance delivered securely through your connected channels.
      </p>

      <div className="mt-8">
        <Link
          href="/login"
          className="rounded-md bg-blue-600 px-6 py-3 font-medium text-white shadow hover:bg-blue-700"
        >
          Login
        </Link>
      </div>
    </main>
  );
}
