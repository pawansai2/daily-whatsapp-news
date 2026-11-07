import "server-only";

import { cookies } from "next/headers";

import { getFirebaseAdminAuth } from "./admin";
import { FIREBASE_SESSION_COOKIE } from "./session";
import { FirebaseDataClient } from "./store";

export { FIREBASE_SESSION_COOKIE } from "./session";

export async function createClient() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  const dataClient = new FirebaseDataClient();

  return {
    from: dataClient.from.bind(dataClient),
    auth: {
      async getClaims() {
        if (!sessionCookie) {
          return {
            data: { claims: null },
            error: { code: "AUTH_REQUIRED", message: "Sign in is required." },
          };
        }

        try {
          const auth = await getFirebaseAdminAuth();
          const claims = await auth.verifySessionCookie(
            sessionCookie,
            true,
          );
          return {
            data: { claims },
            error: null,
          };
        } catch (error) {
          return {
            data: { claims: null },
            error: {
              code: "INVALID_SESSION",
              message:
                error instanceof Error
                  ? error.message
                  : "Firebase session verification failed.",
            },
          };
        }
      },
    },
  };
}
