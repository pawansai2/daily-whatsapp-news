import { FirebaseLoginForm } from "@/components/FirebaseLoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_credentials: "Invalid owner email or password.",
  configuration_error: "Owner authentication is not configured.",
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error
    ? errorMessages[params.error]
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-gray-900">
          Owner Login
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Access is restricted to the configured owner account.
        </p>

        <FirebaseLoginForm initialError={errorMessage} />
      </section>
    </main>
  );
}
