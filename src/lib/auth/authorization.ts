import "server-only";

export type AuthClaims = {
  sub?: unknown;
  email?: unknown;
  [key: string]: unknown;
};

function csv(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function claimEmail(claims: AuthClaims): string {
  return typeof claims.email === "string"
    ? claims.email.trim().toLowerCase()
    : "";
}

function claimUid(claims: AuthClaims): string {
  return typeof claims.sub === "string"
    ? claims.sub.trim().toLowerCase()
    : "";
}

/**
 * Private deployment authorization.
 *
 * Firebase authentication is not application authorization. The owner is
 * identified by an explicit server-side allowlist. If neither allowlist is
 * configured, access fails closed rather than granting every account access.
 */
export function isOwnerClaims(claims: AuthClaims | null | undefined): boolean {
  if (!claims) return false;

  const emails = csv("OWNER_EMAIL");
  const uids = csv("OWNER_UID");
  if (emails.size === 0 && uids.size === 0) return false;

  const email = claimEmail(claims);
  const uid = claimUid(claims);
  return Boolean((email && emails.has(email)) || (uid && uids.has(uid)));
}

/**
 * Reviewers are the owner plus optional explicitly configured reviewer
 * identities. In the current single-owner product the owner is the reviewer.
 * The page and the Server Action must use this same function.
 */
export function isReviewerClaims(
  claims: AuthClaims | null | undefined,
): boolean {
  if (isOwnerClaims(claims)) return true;
  if (!claims) return false;

  const email = claimEmail(claims);
  const uid = claimUid(claims);
  const emails = csv("OPPORTUNITY_REVIEWER_EMAILS");
  const uids = csv("OPPORTUNITY_REVIEWER_IDS");

  return Boolean((email && emails.has(email)) || (uid && uids.has(uid)));
}
