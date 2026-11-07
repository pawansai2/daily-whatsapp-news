import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/firebase/server";
import {
  categoryCounts,
  earliestDeadline,
  viewCounts,
  type BrowseOpportunity,
} from "@/lib/opportunities/browse";
import {
  evaluateEligibility,
  scoreOpportunity,
} from "@/lib/opportunities/intelligence";
import {
  profileFromRow,
  scoringOpportunityFromRow,
} from "@/lib/opportunities/detail";
import { OPPORTUNITY_VERIFIED_FIELDS } from "@/lib/opportunities/schema";
import { OPPORTUNITY_CATEGORIES } from "@/lib/opportunities/taxonomy";

export const dynamic = "force-dynamic";

type DashboardSettings = {
  digest_enabled: boolean | null;
  delivery_time: string | null;
  timezone: string | null;
};

function isDashboardSettings(value: unknown): value is DashboardSettings {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    (typeof row.digest_enabled === "boolean" ||
      row.digest_enabled === null) &&
    (typeof row.delivery_time === "string" ||
      row.delivery_time === null) &&
    (typeof row.timezone === "string" || row.timezone === null)
  );
}

function getCurrentMinutesInTimezone(
  timezone: string,
): number {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );

  const parts =
    formatter.formatToParts(new Date());

  const hour = Number(
    parts.find(
      (part) => part.type === "hour",
    )?.value ?? "0",
  );

  const minute = Number(
    parts.find(
      (part) => part.type === "minute",
    )?.value ?? "0",
  );

  return hour * 60 + minute;
}

function formatDeliveryTime(
  value: string,
): string {
  const [hourText, minuteText] =
    value.split(":");

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return value;
  }

  const period =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${String(displayHour).padStart(
    2,
    "0",
  )}:${String(minute).padStart(
    2,
    "0",
  )} ${period}`;
}

function getNextDeliveryLabel(
  settings: DashboardSettings,
): string {
  if (!settings.digest_enabled) {
    return "Digest paused";
  }

  const deliveryTime =
    settings.delivery_time ?? "08:00";

  const timezone =
    settings.timezone ?? "Asia/Kolkata";

  const [hourText, minuteText] =
    deliveryTime.split(":");

  const deliveryMinutes =
    Number(hourText) * 60 +
    Number(minuteText);

  if (!Number.isFinite(deliveryMinutes)) {
    return formatDeliveryTime(
      deliveryTime,
    );
  }

  let currentMinutes: number;

  try {
    currentMinutes =
      getCurrentMinutesInTimezone(
        timezone,
      );
  } catch {
    currentMinutes =
      getCurrentMinutesInTimezone(
        "Asia/Kolkata",
      );
  }

  const day =
    currentMinutes < deliveryMinutes
      ? "Today"
      : "Tomorrow";

  return `${day} at ${formatDeliveryTime(
    deliveryTime,
  )}`;
}

export default async function DashboardPage() {
  const firebaseStore =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await firebaseStore.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const [
    {
      data: settings,
      error: settingsError,
    },
    {
      data: telegramChannel,
      error: telegramError,
    },
    {
      data: opportunityRows,
      error: opportunitiesError,
    },
    {
      data: trackingRows,
      error: trackingError,
    },
    {
      data: opportunityProfile,
      error: opportunityProfileError,
    },
  ] = await Promise.all([
    firebaseStore
      .from("personal_settings")
      .select(
        "digest_enabled, delivery_time, timezone",
      )
      .eq("owner_id", userId)
      .maybeSingle(),

    firebaseStore
      .from("user_channels")
      .select(
        "username, verified_at, is_active",
      )
      .eq("user_id", userId)
      .eq("channel", "telegram")
      .maybeSingle(),

    firebaseStore
      .from("opportunities")
      .select(
        "id,title,organizer,company,institution,short_description,category,subcategory,primary_domain,additional_domains,required_skills,geography,location,participation_format,individual_eligible,team_eligible,minimum_team_size,maximum_team_size,eligible_education_levels,eligible_graduation_years,eligible_branches,eligible_countries,experience_restrictions,registration_opens_on,registration_closes_on,submission_deadline,entry_fee_amount,entry_fee_currency,certificate_available,travel_support,accommodation,food_provided,mentorship,networking,internship_pathway,job_pathway,verified_fields,eligibility_conflicts,first_discovered_at,verification_status,lifecycle_status",
      )
      .limit(500),

    firebaseStore
      .from("user_opportunity_tracking")
      .select("opportunity_id,status")
      .eq("user_id", userId),

    firebaseStore
      .from("opportunity_profiles")
      .select(
        "education_level,graduation_year,branch_or_discipline,eligibility_country,available_team_size,individual_team_preference,technical_skills,preferred_domains,budget_limit_amount,budget_limit_currency",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (settingsError) {
    console.error(
      "dashboard_settings_load_failed",
      {
        code: settingsError.code,
      },
    );
  }

  const dashboardSettings = isDashboardSettings(settings)
    ? settings
    : null;
  const settingsShapeInvalid = Boolean(settings && !dashboardSettings);
  if (settingsShapeInvalid) {
    console.error("dashboard_settings_shape_invalid");
  }

  const digestEnabled =
    dashboardSettings?.digest_enabled ?? false;

  const telegramConnected =
    Boolean(
      telegramChannel?.is_active &&
        telegramChannel?.verified_at,
    );

  const nextDelivery =
    dashboardSettings
      ? getNextDeliveryLabel(dashboardSettings)
      : "Configure settings first";

  const trackingByOpportunity = new Map<
    string,
    "saved" | "applied"
  >();
  for (const row of trackingRows ?? []) {
    if (
      typeof row.opportunity_id === "string" &&
      (row.status === "saved" || row.status === "applied")
    ) {
      trackingByOpportunity.set(row.opportunity_id, row.status);
    }
  }

  const savedTimezone = dashboardSettings?.timezone ?? "Asia/Kolkata";
  let dashTimezone = "Asia/Kolkata";
  try {
    new Intl.DateTimeFormat("en", { timeZone: savedTimezone }).format();
    dashTimezone = savedTimezone;
  } catch {
    dashTimezone = "Asia/Kolkata";
  }

  const dashboardProfile = profileFromRow(
    opportunityProfile as Record<string, unknown> | null,
  );
  const allowedVerifiedFields = new Set<string>(OPPORTUNITY_VERIFIED_FIELDS);
  const browseItems = (opportunityRows ?? []).map((row) => {
    const id = String(row.id);
    const verifiedFields = Array.isArray(row.verified_fields)
      ? row.verified_fields.filter(
          (field): field is string =>
            typeof field === "string" && allowedVerifiedFields.has(field),
        )
      : [];
    const facts = scoringOpportunityFromRow(
      row as Record<string, unknown>,
      verifiedFields,
    );
    const conflicts = Array.isArray(row.eligibility_conflicts)
      ? row.eligibility_conflicts.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const eligibility = evaluateEligibility(
      dashboardProfile,
      facts,
      conflicts,
      verifiedFields,
    );
    const score = scoreOpportunity(dashboardProfile, facts, {
      timezone: dashTimezone,
      verifiedFields,
      eligibilityConflicts: conflicts,
    });

    return {
      id,
      title: String(row.title ?? "Untitled opportunity"),
      organizer: typeof row.organizer === "string" ? row.organizer : null,
      company: typeof row.company === "string" ? row.company : null,
      institution:
        typeof row.institution === "string" ? row.institution : null,
      description:
        typeof row.short_description === "string"
          ? row.short_description
          : null,
      category: typeof row.category === "string" ? row.category : null,
      subcategory:
        typeof row.subcategory === "string" ? row.subcategory : null,
      domains: [
        ...(verifiedFields.includes("primaryDomain") &&
        typeof row.primary_domain === "string"
          ? [row.primary_domain]
          : []),
        ...(verifiedFields.includes("additionalDomains") &&
        Array.isArray(row.additional_domains)
          ? row.additional_domains.filter(
              (value): value is string => typeof value === "string",
            )
          : []),
      ],
      format: verifiedFields.includes("participationFormat") &&
        typeof row.participation_format === "string"
        ? row.participation_format
        : null,
      geography: typeof row.geography === "string" ? row.geography : null,
      location: typeof row.location === "string" ? row.location : null,
      registrationOpensOn:
        typeof row.registration_opens_on === "string"
          ? row.registration_opens_on
          : null,
      registrationClosesOn:
        verifiedFields.includes("registrationClosesOn") &&
        typeof row.registration_closes_on === "string"
          ? row.registration_closes_on
          : null,
      submissionDeadline:
        verifiedFields.includes("submissionDeadline") &&
        typeof row.submission_deadline === "string"
          ? row.submission_deadline
          : null,
      entryFeeAmount: verifiedFields.includes("entryFeeAmount") &&
        typeof row.entry_fee_amount === "number"
        ? row.entry_fee_amount
        : null,
      verificationStatus:
        typeof row.verification_status === "string"
          ? row.verification_status
          : "unverified",
      lifecycleStatus:
        typeof row.lifecycle_status === "string"
          ? row.lifecycle_status
          : "unknown",
      eligibilityStatus: eligibility.status,
      score: score.score,
      trackingStatus:
        trackingByOpportunity.get(id) ?? null,
    } satisfies BrowseOpportunity;
  });

  const opportunityCategoryCounts = categoryCounts(browseItems);
  const opportunityViews = viewCounts(browseItems);

  const dashboardNow = new Date();
  const today = dashboardNow.toISOString().slice(0, 10);
  const tomorrow = new Date(dashboardNow.getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const activeItems = browseItems.filter(
    (item) => item.lifecycleStatus !== "expired" &&
      item.lifecycleStatus !== "cancelled" &&
      item.lifecycleStatus !== "closed",
  );
  const latestItems = [...activeItems]
    .sort((left, right) => {
      const leftRow = (opportunityRows ?? []).find((row) => row.id === left.id);
      const rightRow = (opportunityRows ?? []).find((row) => row.id === right.id);
      return String(rightRow?.first_discovered_at ?? "").localeCompare(
        String(leftRow?.first_discovered_at ?? ""),
      );
    })
    .slice(0, 4);
  const closingToday = activeItems.filter(
    (item) => earliestDeadline(item)?.slice(0, 10) === today,
  );
  const closingTomorrow = activeItems.filter(
    (item) => earliestDeadline(item)?.slice(0, 10) === tomorrow,
  );

  return (
    <>
      <AppNav />

      <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-900">
          Dashboard
        </h1>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">
              Digest Status
            </h2>

            <p
              className={`mt-4 text-xl font-semibold ${
                digestEnabled
                  ? "text-green-600"
                  : "text-gray-500"
              }`}
            >
              {digestEnabled
                ? "Active"
                : "Paused"}
            </p>

            <div className="mt-4">
              <p
                className={`font-medium ${
                  telegramConnected
                    ? "text-green-700"
                    : "text-amber-700"
                }`}
              >
                {telegramConnected
                  ? "Telegram connected"
                  : "Telegram not connected"}
              </p>

              {telegramConnected &&
              telegramChannel?.username ? (
                <p className="mt-1 text-sm text-gray-500">
                  @{telegramChannel.username}
                </p>
              ) : null}

              <Link
                href="/settings/telegram"
                className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
              >
                {telegramConnected
                  ? "Manage Telegram"
                  : "Connect Telegram"}
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">
              Next Delivery
            </h2>

            <p className="mt-4 text-xl text-gray-900">
              {nextDelivery}
            </p>

            {dashboardSettings?.timezone ? (
              <p className="mt-2 text-sm text-gray-500">
                {dashboardSettings.timezone}
              </p>
            ) : null}
          </section>
        </div>

        {settingsError || telegramError || settingsShapeInvalid ||
        opportunityProfileError ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
          >
            Some dashboard information could not be loaded.
          </div>
        ) : null}

        <section className="mt-10 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Opportunity Radar
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                Technology opportunities
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Hackathons, ideathons, innovation challenges, competitions,
                events, internships, jobs, research and startup programmes in
                one discovery view.
              </p>
            </div>
            <Link
              href="/opportunities"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Open Opportunity Radar
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OPPORTUNITY_CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/opportunities?category=${category.id}`}
                className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-800">
                  {category.label}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                  {opportunityCategoryCounts[category.id]}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-6 grid gap-4 border-t border-gray-200 pt-5 md:grid-cols-3">
            {[
              { label: "Latest opportunities", items: latestItems },
              { label: "Closing today", items: closingToday },
              { label: "Closing tomorrow", items: closingTomorrow },
            ].map((section) => (
              <section key={section.label} className="rounded-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  {section.label}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {section.items.length}
                  </span>
                </h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {section.items.length > 0 ? section.items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/opportunities/${item.id}`} className="text-blue-700 hover:underline">
                        {item.title}
                      </Link>
                    </li>
                  )) : (
                    <li className="text-gray-500">None currently.</li>
                  )}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-5 text-sm">
            {[
              { id: "recommended", label: "Recommended" },
              { id: "closing_soon", label: "Closing soon" },
              { id: "upcoming", label: "Upcoming" },
              { id: "verified", label: "Verified" },
              { id: "saved", label: "Saved" },
              { id: "applied", label: "Applied" },
              { id: "expired", label: "Expired / cancelled" },
            ].map((view) => (
              <Link
                key={view.id}
                href={`/opportunities?view=${view.id}`}
                className="rounded-full border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                {view.label}
                <span className="ml-2 text-xs text-gray-500">
                  {opportunityViews[view.id as keyof typeof opportunityViews]}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {opportunitiesError || trackingError ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"
          >
            Opportunity summary could not be fully loaded.
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/settings"
            className="rounded-md bg-gray-200 px-5 py-3 font-medium text-gray-900 hover:bg-gray-300"
          >
            Settings
          </Link>

          <Link
            href="/news-preview"
            className="rounded-md bg-gray-200 px-5 py-3 font-medium text-gray-900 hover:bg-gray-300"
          >
            Preview Digest
          </Link>
        </div>
      </div>
      </main>
    </>
  );
}
