import "server-only";

import { cookies } from "next/headers";

import { isOwnerClaims } from "@/lib/auth/authorization";

import { getFirebaseAdminAuth } from "./admin";
import { FIREBASE_SESSION_COOKIE } from "./session";
import { FirebaseDataClient } from "./store";

export { FIREBASE_SESSION_COOKIE } from "./session";

export async function createClient() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;

  // Create the privileged client lazily so an unauthenticated request is
  // rejected with 401 before Firebase Admin configuration is required.
  let dataClient: FirebaseDataClient | null = null;
  const getDataClient = () => {
    dataClient ??= new FirebaseDataClient();
    return dataClient;
  };

  return {
    from: (table: string) => getDataClient().from(table),
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

          if (!isOwnerClaims(claims)) {
            return {
              data: { claims: null },
              error: {
                code: "NOT_AUTHORIZED",
                message: "This account is not authorized for this deployment.",
              },
            };
          }

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
