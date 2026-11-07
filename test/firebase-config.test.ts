import {
  getFirebaseWebConfig,
  parseFirebaseWebConfig,
  parseFirebaseAdminServiceAccount,
} from "@/lib/firebase/config";

describe("Firebase configuration", () => {
  test("uses the registered public Firebase project config by default", () => {
    expect(getFirebaseWebConfig()).toMatchObject({
      authDomain: "daily-whatsapp-news.firebaseapp.com",
      projectId: "daily-whatsapp-news",
      appId: "1:67308398506:web:2d3bb29ff0866e8bb8edd3",
    });
  });

  test("requires all public Firebase app settings", () => {
    expect(() => parseFirebaseWebConfig({})).toThrow(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
    );
    expect(
      parseFirebaseWebConfig({
        NEXT_PUBLIC_FIREBASE_API_KEY: "api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "example",
        NEXT_PUBLIC_FIREBASE_APP_ID: "app-id",
      }),
    ).toEqual({
      apiKey: "api-key",
      authDomain: "example.firebaseapp.com",
      projectId: "example",
      appId: "app-id",
    });
  });

  test("parses service credentials without logging or exposing the private key", () => {
    const account = parseFirebaseAdminServiceAccount(
      JSON.stringify({
        project_id: "example",
        client_email: "firebase-admin@example.iam.gserviceaccount.com",
        private_key: "line-one\\nline-two",
      }),
    );

    expect(account).toEqual({
      project_id: "example",
      client_email: "firebase-admin@example.iam.gserviceaccount.com",
      private_key: "line-one\nline-two",
    });
  });

  test("rejects absent, malformed, or incomplete service credentials", () => {
    expect(() => parseFirebaseAdminServiceAccount(undefined)).toThrow(
      "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON",
    );
    expect(() => parseFirebaseAdminServiceAccount("{")).toThrow(
      "valid JSON",
    );
    expect(() =>
      parseFirebaseAdminServiceAccount(JSON.stringify({ project_id: "example" })),
    ).toThrow("project_id, client_email, and private_key");
  });
});
