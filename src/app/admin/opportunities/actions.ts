"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  OPPORTUNITY_VERIFIED_FIELDS,
} from "@/lib/opportunities/schema";
import {
  parseVerifiedFieldValue,
  type VerifiableField,
} from "@/lib/opportunities/verification";
import { createClient } from "@/lib/firebase/server";
import { getFirebaseAdminClient } from "@/lib/firebase/store";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reviewerIds(): Set<string> {
  return new Set(
    (process.env.OPPORTUNITY_REVIEWER_IDS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function value(formData: FormData, name: string): string {
  const item = formData.get(name);
  return typeof item === "string" ? item.trim() : "";
}

function backToQueue(result: string): never {
  redirect(`/admin/opportunities?${result}`);
}

export async function reviewOpportunityEvidence(formData: FormData) {
  const authClient = await createClient();
  const { data: claimsData, error: claimsError } =
    await authClient.auth.getClaims();
  const reviewerId = claimsData?.claims?.sub;

  if (
    claimsError ||
    !reviewerId ||
    !reviewerIds().has(reviewerId.toLowerCase())
  ) {
    redirect("/login");
  }

  const opportunityId = value(formData, "opportunityId");
  const field = value(formData, "field");
  const sourceName = value(formData, "sourceName");
  const sourceUrl = value(formData, "sourceUrl");
  const sourceType = value(formData, "sourceType");
  const excerpt = value(formData, "excerpt").slice(0, 2000);
  const decision = value(formData, "decision");
  const rawFactValue = value(formData, "factValue");

  if (!uuid.test(opportunityId)) {
    backToQueue("error=invalid_opportunity");
  }
  if (!sourceName || sourceName.length > 200 || !excerpt) {
    backToQueue("error=invalid_evidence");
  }
  let evidenceUrl: URL;
  try {
    evidenceUrl = new URL(sourceUrl);
  } catch {
    backToQueue("error=invalid_evidence");
  }
  if (
    evidenceUrl.protocol !== "https:" ||
    evidenceUrl.username ||
    evidenceUrl.password
  ) {
    backToQueue("error=invalid_evidence");
  }
  if (sourceType !== "official" && sourceType !== "third_party") {
    backToQueue("error=invalid_evidence");
  }
  if (
    decision !== "verified" &&
    decision !== "third_party_reported" &&
    decision !== "conflicting" &&
    decision !== "unverified"
  ) {
    backToQueue("error=invalid_decision");
  }
  if (decision === "verified" && sourceType !== "official") {
    backToQueue("error=official_source_required");
  }

  let parsedFact: ReturnType<typeof parseVerifiedFieldValue> | null = null;
  if (decision === "verified" || decision === "conflicting") {
    try {
      parsedFact = parseVerifiedFieldValue(field, rawFactValue);
    } catch {
      backToQueue("error=invalid_fact");
    }
  } else if (!OPPORTUNITY_VERIFIED_FIELDS.includes(
    field as typeof OPPORTUNITY_VERIFIED_FIELDS[number],
  )) {
    backToQueue("error=invalid_fact");
  }

  const admin = getFirebaseAdminClient();
  const { data: opportunity, error: opportunityError } = await admin
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError || !opportunity) {
    console.error("opportunity_review_lookup_failed", {
      code: opportunityError?.code ?? "NOT_FOUND",
    });
    backToQueue("error=review_failed");
  }

  const fieldName = parsedFact?.field ?? field as VerifiableField;
  const currentValue = parsedFact?.column
    ? opportunity[parsedFact.column]
    : parsedFact?.field === "teamSize"
      ? {
          minimumTeamSize: opportunity.minimum_team_size,
          maximumTeamSize: opportunity.maximum_team_size,
        }
      : null;
  const manualSourceName =
    `Manual evidence: ${sourceName} (${evidenceUrl.hostname})`
      .slice(0, 200);
  const { data: source, error: sourceError } = await admin
    .from("opportunity_sources")
    .upsert(
      {
        name: manualSourceName,
        category: "Manual verification",
        base_url: evidenceUrl.origin,
        source_type: sourceType,
        collection_method: "manual",
        supported_categories: [],
        supported_domains: [],
        rate_limit_seconds: 0,
        is_enabled: false,
        notes: "Reviewer-added evidence source; not scheduled for collection.",
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  if (sourceError || !source?.id) {
    console.error("opportunity_evidence_source_upsert_failed", {
      code: sourceError?.code ?? "MISSING_SOURCE_ID",
    });
    backToQueue("error=review_failed");
  }

  const reviewedAt = new Date().toISOString();
  const { error: evidenceError } = await admin
    .from("opportunity_field_evidence")
    .insert({
      opportunity_id: opportunityId,
      field_name: fieldName,
      evidence_url: evidenceUrl.toString(),
      source_name: sourceName,
      source_type: sourceType,
      evidence_excerpt: excerpt,
      field_value: parsedFact?.value ?? null,
      decision,
      reviewer_id: reviewerId,
      reviewed_at: reviewedAt,
    });

  if (evidenceError) {
    console.error("opportunity_evidence_insert_failed", {
      code: evidenceError.code,
    });
    backToQueue("error=review_failed");
  }

  const sourceStatus =
    decision === "verified"
      ? "official_source_partial"
      : decision;
  const { error: provenanceError } = await admin
    .from("opportunity_source_records")
    .upsert(
      {
        opportunity_id: opportunityId,
        source_id: source.id,
        source_url: evidenceUrl.toString(),
        source_record_key: `manual-review:${fieldName}`,
        source_type: sourceType,
        verification_status: sourceStatus,
        evidence: {
          field_name: fieldName,
          field_value: parsedFact?.value ?? null,
          excerpt,
          reviewer_id: reviewerId,
          reviewed_at: reviewedAt,
        },
        last_seen_at: reviewedAt,
      },
      { onConflict: "source_id,source_url" },
    );
  if (provenanceError) {
    console.error("opportunity_evidence_provenance_upsert_failed", {
      code: provenanceError.code,
    });
    backToQueue("error=review_failed");
  }

  const now = reviewedAt;
  if (decision === "conflicting") {
    const { error } = await admin
      .from("opportunities")
      .update({
        verification_status: "conflicting",
        updated_at: now,
      })
      .eq("id", opportunityId);
    if (error) {
      console.error("opportunity_conflict_status_update_failed", {
        code: error.code,
      });
      backToQueue("error=review_failed");
    }
  } else if (decision === "verified" && parsedFact) {
    const existingFields = Array.isArray(opportunity.verified_fields)
      ? opportunity.verified_fields.filter(
          (item: unknown): item is string => typeof item === "string",
        )
      : [];
    const verifiedFields = Array.from(
      new Set([...existingFields, parsedFact.field]),
    );

    if (
      JSON.stringify(currentValue) !== JSON.stringify(parsedFact.value)
    ) {
      const { error: historyError } = await admin
        .from("opportunity_changes")
        .insert({
          opportunity_id: opportunityId,
          field_name: parsedFact.field,
          previous_value: currentValue ?? null,
          new_value: parsedFact.value,
          change_reason: "Manual verification from cited official evidence.",
        });
      if (historyError) {
        console.error("opportunity_change_history_insert_failed", {
          code: historyError.code,
        });
        backToQueue("error=review_failed");
      }
    }

    const factUpdate = parsedFact.column
      ? { [parsedFact.column]: parsedFact.value }
      : parsedFact.field === "teamSize" &&
          typeof parsedFact.value === "object" &&
          parsedFact.value !== null
        ? parsedFact.value
        : null;
    if (!factUpdate) {
      backToQueue("error=invalid_fact");
    }

    const { error: updateError } = await admin
      .from("opportunities")
      .update({
        ...factUpdate,
        verified_fields: verifiedFields,
        verification_status: "official_source_partial",
        last_verified_at: now,
        updated_at: now,
      })
      .eq("id", opportunityId);
    if (updateError) {
      console.error("opportunity_verified_fact_update_failed", {
        code: updateError.code,
      });
      backToQueue("error=review_failed");
    }
  } else if (decision === "third_party_reported") {
    const { error } = await admin
      .from("opportunities")
      .update({
        verification_status: "third_party_reported",
        updated_at: now,
      })
      .eq("id", opportunityId);
    if (error) {
      console.error("opportunity_third_party_status_update_failed", {
        code: error.code,
      });
      backToQueue("error=review_failed");
    }
  } else if (decision === "unverified") {
    const { error } = await admin
      .from("opportunities")
      .update({
        verification_status: "unverified",
        updated_at: now,
      })
      .eq("id", opportunityId);
    if (error) {
      console.error("opportunity_unverified_status_update_failed", {
        code: error.code,
      });
      backToQueue("error=review_failed");
    }
  }

  revalidatePath("/opportunities");
  revalidatePath("/admin/opportunities");
  backToQueue("saved=1");
}
