export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
};

export type FirebaseAdminServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const defaultFirebaseWebConfig: FirebaseWebConfig = {
  apiKey: "AIzaSyBpxj5zrjH0ogAoAOB65GZJJqCTFQiX-ZQ",
  authDomain: "daily-whatsapp-news.firebaseapp.com",
  projectId: "daily-whatsapp-news",
  appId: "1:67308398506:web:2d3bb29ff0866e8bb8edd3",
  storageBucket: "daily-whatsapp-news.firebasestorage.app",
};

export function parseFirebaseWebConfig(
  environment: Record<string, string | undefined>,
): FirebaseWebConfig {
  const required = {
    apiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    authDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    appId: environment.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  };
  const envKeys = {
    apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
    authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  } as const;
  const missing = (Object.keys(required) as Array<keyof typeof required>)
    .filter((key) => !required[key])
    .map((key) => envKeys[key]);

  if (missing.length > 0) {
    throw new Error(
      `Firebase client configuration is missing: ${missing.join(", ")}`,
    );
  }

  return {
    apiKey: required.apiKey!,
    authDomain: required.authDomain!,
    projectId: required.projectId!,
    appId: required.appId!,
    ...(environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()
      ? {
          storageBucket:
            environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.trim(),
        }
      : {}),
  };
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  const environment = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };
  const hasEnvironmentOverride = Object.values(environment).some(
    (value) => value?.trim(),
  );

  return hasEnvironmentOverride
    ? parseFirebaseWebConfig(environment)
    : defaultFirebaseWebConfig;
}

export function parseFirebaseAdminServiceAccount(
  serialized: string | undefined,
): FirebaseAdminServiceAccount {
  if (!serialized?.trim()) {
    throw new Error(
      "Firebase Admin configuration is missing: FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON",
    );
  }

  let credentials: unknown;
  try {
    credentials = JSON.parse(serialized);
  } catch {
    throw new Error(
      "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON must contain valid JSON.",
    );
  }

  if (
    typeof credentials !== "object" ||
    credentials === null ||
    !("project_id" in credentials) ||
    !("client_email" in credentials) ||
    !("private_key" in credentials) ||
    typeof credentials.project_id !== "string" ||
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string" ||
    !credentials.project_id.trim() ||
    !credentials.client_email.trim() ||
    !credentials.private_key.trim()
  ) {
    throw new Error(
      "Firebase Admin service account must include project_id, client_email, and private_key.",
    );
  }

  return {
    project_id: credentials.project_id.trim(),
    client_email: credentials.client_email.trim(),
    private_key: credentials.private_key.replace(/\\n/g, "\n"),
  };
}
