jest.mock("server-only", () => ({}));

import {
  isOwnerClaims,
  isReviewerClaims,
} from "@/lib/auth/authorization";

const originalEmail = process.env.OWNER_EMAIL;
const originalUid = process.env.OWNER_UID;
const originalReviewerIds = process.env.OPPORTUNITY_REVIEWER_IDS;
const originalReviewerEmails = process.env.OPPORTUNITY_REVIEWER_EMAILS;

afterEach(() => {
  for (const [name, value] of [
    ["OWNER_EMAIL", originalEmail],
    ["OWNER_UID", originalUid],
    ["OPPORTUNITY_REVIEWER_IDS", originalReviewerIds],
    ["OPPORTUNITY_REVIEWER_EMAILS", originalReviewerEmails],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("owner authorization", () => {
  test("fails closed when no owner allowlist is configured", () => {
    delete process.env.OWNER_EMAIL;
    delete process.env.OWNER_UID;
    expect(isOwnerClaims({ sub: "uid-1", email: "owner@example.com" })).toBe(false);
  });

  test("accepts only the configured owner email or UID", () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    process.env.OWNER_UID = "owner-uid";
    expect(isOwnerClaims({ sub: "other", email: "OWNER@example.com" })).toBe(true);
    expect(isOwnerClaims({ sub: "owner-uid" })).toBe(true);
    expect(isOwnerClaims({ sub: "other", email: "other@example.com" })).toBe(false);
    expect(isOwnerClaims(null)).toBe(false);
  });

  test("owner is always a reviewer and explicit reviewers are additive", () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    delete process.env.OPPORTUNITY_REVIEWER_IDS;
    delete process.env.OPPORTUNITY_REVIEWER_EMAILS;
    expect(isReviewerClaims({ sub: "x", email: "owner@example.com" })).toBe(true);
    expect(isReviewerClaims({ sub: "x", email: "reviewer@example.com" })).toBe(false);

    process.env.OPPORTUNITY_REVIEWER_EMAILS = "reviewer@example.com";
    expect(isReviewerClaims({ sub: "x", email: "reviewer@example.com" })).toBe(true);
  });
});
