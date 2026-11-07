jest.mock("server-only", () => ({}));

const getCookie = jest.fn<{ value: string } | undefined, [string]>();

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: (name: string) => getCookie(name),
  })),
}));

import { createClient } from "@/lib/firebase/server";

const originalAdminConfig =
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

afterEach(() => {
  if (originalAdminConfig === undefined) {
    delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  } else {
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON = originalAdminConfig;
  }
});

describe("Firebase server client initialization", () => {
  test("an unauthenticated request is rejected without Firebase Admin configuration", async () => {
    delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
    getCookie.mockReturnValue(undefined);

    const client = await createClient();
    const { data, error } = await client.auth.getClaims();

    expect(data.claims).toBeNull();
    expect(error?.code).toBe("AUTH_REQUIRED");
  });

  test("an existing session without Admin configuration fails as an invalid session, not a crash", async () => {
    delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
    getCookie.mockReturnValue({ value: "session-cookie-value" });

    const client = await createClient();
    const { data, error } = await client.auth.getClaims();

    expect(data.claims).toBeNull();
    expect(error?.code).toBe("INVALID_SESSION");
  });
});
