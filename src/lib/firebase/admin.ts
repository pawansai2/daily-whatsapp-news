import "server-only";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  getAuth,
} from "firebase-admin/auth";
import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  parseFirebaseAdminServiceAccount,
} from "./config";

const APP_NAME = "daily-whatsapp-news";

export function getFirebaseAdminApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const credentials = parseFirebaseAdminServiceAccount(
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON,
  );
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (clientProjectId && credentials.project_id !== clientProjectId) {
    throw new Error(
      "Firebase client and Admin configurations must use the same project ID.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key,
      }),
      projectId: credentials.project_id,
    },
    APP_NAME,
  );
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

export function hasFirebaseAdminConfiguration(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim(),
  );
}
