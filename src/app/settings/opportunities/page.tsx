import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/firebase/server";

import { saveOpportunityProfile } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function stringList(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string =>
      typeof item === "string"
    ).join(", ");
  }
  return "";
}

export default async function OpportunityProfilePage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const firebaseStore = await createClient();
  const { data: claimsData, error: claimsError } =
    await firebaseStore.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const { data: profile, error } = await firebaseStore
    .from("opportunity_profiles")
    .select(
      "education_level, degree, branch_or_discipline, graduation_year, eligibility_country, current_status, available_team_size, individual_team_preference, technical_skills, skill_proficiency, projects, experience, certifications, preferred_domains, preferred_formats, preferred_locations, travel_available, internship_eligible, employment_eligible, budget_limit_amount, budget_limit_currency, opportunity_digest_enabled, opportunity_digest_minimum_score",
    )
    .eq("user_id", userId)
    .maybeSingle();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl p-8">
        <Link
          href="/opportunities"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Back to opportunities
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Eligibility profile
        </h1>
        <p className="mt-2 text-gray-600">
          Add only details you are comfortable storing. Missing information
          stays unknown; it will not be treated as an eligibility failure.
          Country means the citizenship or residency basis relevant to
          opportunity rules, not necessarily your current location.
        </p>

        {params.saved ? (
          <p role="status" className="mt-5 rounded-md bg-green-50 p-3 text-green-800">
            Profile saved.
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-red-800">
            {params.error === "invalid_profile"
              ? "Check the profile fields and try again."
              : "The profile could not be saved."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-red-800">
            Profile data could not be loaded.
          </p>
        ) : null}

        <form action={saveOpportunityProfile} className="mt-8 space-y-5 rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Education level
              <input
                name="educationLevel"
                maxLength={100}
                defaultValue={profile?.education_level ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Degree
              <input
                name="degree"
                maxLength={100}
                defaultValue={profile?.degree ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Branch or discipline
              <input
                name="branchOrDiscipline"
                maxLength={150}
                defaultValue={profile?.branch_or_discipline ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Graduation year
              <input
                name="graduationYear"
                type="number"
                min={1950}
                max={2100}
                defaultValue={profile?.graduation_year ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Eligibility country
              <input
                name="countryOfEligibility"
                maxLength={100}
                defaultValue={profile?.eligibility_country ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Current status
              <input
                name="currentStatus"
                maxLength={100}
                placeholder="Student, graduate, professional"
                defaultValue={profile?.current_status ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Available team size
              <input
                name="availableTeamSize"
                type="number"
                min={1}
                max={100}
                defaultValue={profile?.available_team_size ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Participation preference
              <select
                name="individualTeamPreference"
                defaultValue={profile?.individual_team_preference ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="">Not specified</option>
                <option value="individual">Individual</option>
                <option value="team">Team</option>
                <option value="either">Either</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Budget limit currency (ISO code)
              <input
                name="budgetLimitCurrency"
                maxLength={3}
                placeholder="INR"
                defaultValue={profile?.budget_limit_currency?.trim() ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2 uppercase"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Skills
            <input
              name="skills"
              defaultValue={stringList(profile?.technical_skills)}
              placeholder="Python, CAD, public speaking"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
            <span className="mt-1 block font-normal text-gray-500">
              Separate items with commas.
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Preferred domains
            <input
              name="preferredDomains"
              defaultValue={stringList(profile?.preferred_domains)}
              placeholder="Space, software engineering, climate"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Skill proficiency notes
            <textarea
              name="skillProficiency"
              rows={2}
              maxLength={2000}
              defaultValue={profile?.skill_proficiency ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Python: advanced; CAD: intermediate"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Projects
            <textarea
              name="projects"
              rows={3}
              maxLength={5000}
              defaultValue={profile?.projects ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Experience
            <textarea
              name="experience"
              rows={3}
              maxLength={5000}
              defaultValue={profile?.experience ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Certifications
            <textarea
              name="certifications"
              rows={2}
              maxLength={3000}
              defaultValue={profile?.certifications ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-700">
              Preferred formats
            </legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-700">
              {(["online", "offline", "hybrid"] as const).map((format) => (
                <label key={format} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`format_${format}`}
                    defaultChecked={Array.isArray(profile?.preferred_formats) &&
                      profile.preferred_formats.includes(format)}
                  />
                  {format[0].toUpperCase() + format.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium text-gray-700">
            Preferred locations
            <input
              name="preferredLocations"
              defaultValue={stringList(profile?.preferred_locations)}
              placeholder="India, Bengaluru, remote"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Travel available
              <select
                name="travelAvailable"
                defaultValue={profile?.travel_available === true
                  ? "true"
                  : profile?.travel_available === false
                    ? "false"
                    : ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Internship eligible
              <select
                name="internshipEligible"
                defaultValue={profile?.internship_eligible === true
                  ? "true"
                  : profile?.internship_eligible === false
                    ? "false"
                    : ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Employment eligible
              <select
                name="employmentEligible"
                defaultValue={profile?.employment_eligible === true
                  ? "true"
                  : profile?.employment_eligible === false
                    ? "false"
                    : ""}
                className="mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Maximum entry budget
            <input
              name="budgetLimitAmount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={profile?.budget_limit_amount ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <div className="rounded-md border border-gray-200 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-gray-800">
              <input
                name="digestEnabled"
                type="checkbox"
                defaultChecked={profile?.opportunity_digest_enabled ?? true}
                className="h-4 w-4"
              />
              Include verified matches in my daily Telegram digest
            </label>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Minimum match score
              <input
                name="minimumDigestScore"
                type="number"
                min={0}
                max={100}
                defaultValue={                profile?.opportunity_digest_minimum_score ?? 60}
                className="mt-1 w-full rounded-md border px-3 py-2 sm:max-w-40"
              />
            </label>
            <p className="mt-2 text-xs text-gray-600">
              New matches are included in the existing daily digest only.
              Immediate push alerts are not enabled. Matches must meet the
              score threshold and verified eligibility checks.
            </p>
            <a
              href="/settings/telegram"
              className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
            >
              Connect or verify Telegram
            </a>
          </div>

          <button
            type="submit"
            className="rounded-md bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
          >
            Save profile
          </button>
        </form>
      </main>
    </>
  );
}
