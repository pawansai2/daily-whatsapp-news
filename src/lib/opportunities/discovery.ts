import type { FirebaseDataClient } from "@/lib/firebase/store";

import {
  DEFAULT_OPPORTUNITY_SOURCES,
  ensureDefaultOpportunitySources,
} from "@/lib/opportunities/sources";
import { fetchApiCandidates } from "@/lib/opportunities/api";
import {
  entryToCandidate,
  fetchRssSource,
  isLikelySameOpportunity,
  isSourceRateLimited,
  type OpportunityCandidate,
  type OpportunitySource,
  SourceCollectionError,
} from "@/lib/opportunities/rss";

type CollectionSummary = {
  runId: string;
  status: "succeeded" | "partial" | "failed";
  sourcesAttempted: number;
  recordsSeen: number;
  recordsAdded: number;
  errorCount: number;
  skipped?: boolean;
  reason?: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  organizer: string | null;
  category: string | null;
  submission_deadline: string | null;
  registration_closes_on: string | null;
};

type OpportunitySourceRow = OpportunitySource & {
  is_enabled: boolean;
};

export type SourceTaskOutcome<T, R> =
  | { source: T; status: "succeeded"; value: R }
  | { source: T; status: "failed"; error: unknown };

export async function runSourceTasksIndependently<T, R>(
  sources: readonly T[],
  task: (source: T) => Promise<R>,
): Promise<SourceTaskOutcome<T, R>[]> {
  const outcomes: SourceTaskOutcome<T, R>[] = [];

  for (const source of sources) {
    try {
      outcomes.push({
        source,
        status: "succeeded",
        value: await task(source),
      });
    } catch (error) {
      outcomes.push({
        source,
        status: "failed",
        error,
      });
    }
  }

  return outcomes;
}

function sourceErrorCode(error: unknown): string {
  return error instanceof SourceCollectionError
    ? error.code
    : "SOURCE_PROCESSING_FAILED";
}

function toComparableOpportunity(
  row: OpportunityRow,
): Parameters<typeof isLikelySameOpportunity>[0] {
  return {
    title: row.title,
    organizer: row.organizer,
    category: row.category,
    submissionDeadline: row.submission_deadline,
    registrationClosesOn: row.registration_closes_on,
  };
}

async function findExistingOpportunity(
  admin: FirebaseDataClient,
  source: OpportunitySource,
  candidate: OpportunityCandidate,
): Promise<OpportunityRow | null> {
  const { data: provenance, error: provenanceError } = await admin
    .from("opportunity_source_records")
    .select("opportunity_id")
    .eq("source_id", source.id)
    .eq("source_record_key", candidate.sourceRecordKey)
    .maybeSingle();

  if (provenanceError) {
    throw new Error(`Opportunity provenance lookup failed: ${provenanceError.code}`);
  }

  if (provenance && typeof provenance.opportunity_id === "string") {
    const { data: linked, error: linkedError } = await admin
      .from("opportunities")
      .select(
        "id,title,organizer,category,submission_deadline,registration_closes_on",
      )
      .eq("id", provenance.opportunity_id)
      .maybeSingle();

    if (linkedError) {
      throw new Error(`Opportunity provenance record lookup failed: ${linkedError.code}`);
    }

    if (linked) return linked as OpportunityRow;
  }

  const { data: exact, error: exactError } = await admin
    .from("opportunities")
    .select(
      "id,title,organizer,category,submission_deadline,registration_closes_on",
    )
    .eq(
      "canonical_url_hash",
      candidate.opportunity.canonicalUrlHash,
    )
    .maybeSingle();

  if (exactError) {
    throw new Error(`Opportunity lookup failed: ${exactError.code}`);
  }

  if (exact) {
    return exact as OpportunityRow;
  }

  const organizer = candidate.opportunity.organizer;
  const category = candidate.opportunity.category;
  let query = admin
    .from("opportunities")
    .select(
      "id,title,organizer,category,submission_deadline,registration_closes_on",
    );

  if (organizer) {
    query = query.eq("organizer", organizer);
  } else if (category) {
    query = query.eq("category", category);
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data: candidates, error: duplicateError } = await query.limit(100);

  if (duplicateError) {
    throw new Error(`Opportunity duplicate lookup failed: ${duplicateError.code}`);
  }

  for (const row of (candidates ?? []) as OpportunityRow[]) {
    if (
      !isLikelySameOpportunity(
        candidate.opportunity,
        toComparableOpportunity(row),
      )
    ) {
      continue;
    }

    const { data: sameSource, error: sameSourceError } = await admin
      .from("opportunity_source_records")
      .select("id")
      .eq("opportunity_id", row.id)
      .eq("source_id", source.id)
      .limit(1);

    if (sameSourceError) {
      throw new Error(`Opportunity source provenance lookup failed: ${sameSourceError.code}`);
    }

    // Different records from the same source are distinct opportunities even
    // when their titles share a generic prefix (for example Codeforces rounds).
    if ((sameSource ?? []).length > 0) continue;

    return row;
  }

  return null;
}

async function persistCandidate(
  admin: FirebaseDataClient,
  source: OpportunitySource,
  candidate: OpportunityCandidate,
  checkedAt: string,
): Promise<boolean> {
  let existing = await findExistingOpportunity(admin, source, candidate);
  let opportunityId = existing?.id;
  let created = false;

  if (!opportunityId) {
    const opportunity = candidate.opportunity;
    const { data: inserted, error: insertError } = await admin
      .from("opportunities")
      .insert({
        canonical_url: opportunity.canonicalUrl,
        canonical_url_hash: opportunity.canonicalUrlHash,
        title: opportunity.title,
        organizer: opportunity.organizer ?? null,
        company: opportunity.company ?? null,
        institution: opportunity.institution ?? null,
        subcategory: opportunity.subcategory ?? null,
        short_description: opportunity.shortDescription ?? null,
        full_description: opportunity.fullDescription ?? null,
        category: opportunity.category ?? null,
        primary_domain: opportunity.primaryDomain ?? null,
        additional_domains: opportunity.additionalDomains ?? null,
        required_skills: opportunity.requiredSkills ?? null,
        difficulty_level: opportunity.difficultyLevel ?? null,
        geography: opportunity.geography ?? null,
        location: opportunity.location ?? null,
        participation_format: opportunity.participationFormat ?? null,
        individual_eligible: opportunity.individualEligible ?? null,
        team_eligible: opportunity.teamEligible ?? null,
        minimum_team_size: opportunity.minimumTeamSize ?? null,
        maximum_team_size: opportunity.maximumTeamSize ?? null,
        eligible_education_levels:
          opportunity.eligibleEducationLevels ?? null,
        eligible_graduation_years:
          opportunity.eligibleGraduationYears ?? null,
        eligible_branches: opportunity.eligibleBranches ?? null,
        eligible_countries: opportunity.eligibleCountries ?? null,
        experience_restrictions:
          opportunity.experienceRestrictions ?? null,
        registration_opens_on:
          opportunity.registrationOpensOn ?? null,
        registration_closes_on:
          opportunity.registrationClosesOn ?? null,
        submission_deadline:
          opportunity.submissionDeadline ?? null,
        event_starts_on: opportunity.eventStartsOn ?? null,
        event_ends_on: opportunity.eventEndsOn ?? null,
        entry_fee_amount: opportunity.entryFeeAmount ?? null,
        entry_fee_currency: opportunity.entryFeeCurrency ?? null,
        prize_details: opportunity.prizeDetails ?? null,
        certificate_available:
          opportunity.certificateAvailable ?? null,
        travel_support: opportunity.travelSupport ?? null,
        accommodation: opportunity.accommodation ?? null,
        food_provided: opportunity.foodProvided ?? null,
        mentorship: opportunity.mentorship ?? null,
        networking: opportunity.networking ?? null,
        internship_pathway: opportunity.internshipPathway ?? null,
        job_pathway: opportunity.jobPathway ?? null,
        official_application_url:
          opportunity.officialApplicationUrl ?? null,
        eligibility_conflicts: opportunity.eligibilityConflicts,
        verified_fields: opportunity.verifiedFields,
        verification_status: opportunity.verificationStatus,
        lifecycle_status: opportunity.lifecycleStatus,
        data_completeness: opportunity.dataCompleteness ?? null,
        first_discovered_at: checkedAt,
        last_checked_at: checkedAt,
        updated_at: checkedAt,
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") {
      existing = await findExistingOpportunity(admin, source, candidate);
      opportunityId = existing?.id;
    } else if (insertError) {
      throw new Error(`Opportunity insert failed: ${insertError.code}`);
    } else if (typeof inserted?.id !== "string") {
      throw new Error("Opportunity insert returned no record ID.");
    } else {
      opportunityId = inserted.id;
      created = true;
    }
  } else {
    const { error: updateError } = await admin
      .from("opportunities")
      .update({
        last_checked_at: checkedAt,
        updated_at: checkedAt,
      })
      .eq("id", opportunityId);

    if (updateError) {
      throw new Error(`Opportunity check timestamp update failed: ${updateError.code}`);
    }
  }

  if (!opportunityId) {
    throw new Error("Opportunity duplicate could not be resolved after insert conflict.");
  }

  const { error: provenanceError } = await admin
    .from("opportunity_source_records")
    .upsert(
      {
        opportunity_id: opportunityId,
        source_id: source.id,
        source_url: candidate.sourceUrl,
        source_record_key: candidate.sourceRecordKey,
        source_type: source.source_type,
        verification_status: "pending_verification",
        evidence: candidate.evidence,
        last_seen_at: checkedAt,
      },
      {
        onConflict: "source_id,source_url",
      },
    );

  if (provenanceError) {
    throw new Error(`Opportunity provenance write failed: ${provenanceError.code}`);
  }

  return created;
}

async function updateSourceHealth(
  admin: FirebaseDataClient,
  source: OpportunitySource,
  succeeded: boolean,
  checkedAt: string,
): Promise<void> {
  const update = succeeded
    ? {
        last_succeeded_at: checkedAt,
        consecutive_failures: 0,
        updated_at: checkedAt,
      }
    : {
        last_failed_at: checkedAt,
        consecutive_failures: source.consecutive_failures + 1,
        updated_at: checkedAt,
      };

  const { error } = await admin
    .from("opportunity_sources")
    .update(update)
    .eq("id", source.id);

  if (error) {
    throw new Error(`Source health update failed: ${error.code}`);
  }
}

export type DiscoveryDryRunCandidate = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  title: string;
  url: string;
  category: string | null;
  domains: string[];
  extractedFields: string[];
  canonicalUrl: string;
  publishedAt: string | null;
};

export type DiscoveryDryRunResult = {
  status: "succeeded" | "partial" | "failed";
  sourcesAttempted: number;
  recordsSeen: number;
  candidates: DiscoveryDryRunCandidate[];
  errors: Array<{ sourceId: string; code: string }>;
  persisted: 0;
};

/**
 * Fetches and normalizes real sources without creating runs, opportunities or
 * provenance records. This is the safe way to validate extraction quality
 * before enabling persistence.
 */
export async function runOpportunityDiscoveryDryRun(
  admin: FirebaseDataClient,
  now: Date = new Date(),
  fetcher: typeof fetch = fetch,
  candidateLimit = 100,
): Promise<DiscoveryDryRunResult> {
  void now;
  const { data: rawSources, error } = await admin
    .from("opportunity_sources")
    .select(
      "id,name,category,base_url,source_type,collection_method,supported_categories,supported_domains,rate_limit_seconds,last_succeeded_at,consecutive_failures,is_enabled",
    )
    .eq("is_enabled", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Source registry could not be loaded: ${error.code}`);
  }

  const configured = (rawSources ?? []) as OpportunitySourceRow[];
  const sources: OpportunitySource[] = configured.length > 0
    ? configured
    : DEFAULT_OPPORTUNITY_SOURCES.map((source, index) => ({
        ...source,
        id: `default-${index + 1}`,
        supported_categories: [...source.supported_categories],
        supported_domains: [...source.supported_domains],
        last_succeeded_at: null,
        consecutive_failures: 0,
      }));

  const candidates: DiscoveryDryRunCandidate[] = [];
  const errors: Array<{ sourceId: string; code: string }> = [];
  let recordsSeen = 0;

  for (const source of sources) {
    try {
      const entries = await fetchRssSource(source, fetcher);
      recordsSeen += entries.length;

      for (const entry of entries) {
        if (candidates.length >= candidateLimit) break;
        const candidate = entryToCandidate(source, entry);
        if (!candidate) continue;
        const opportunity = candidate.opportunity;
        candidates.push({
          sourceId: source.id,
          sourceName: source.name,
          sourceType: source.source_type,
          title: opportunity.title,
          url: candidate.sourceUrl,
          category: opportunity.category ?? null,
          domains: [
            ...(opportunity.primaryDomain ? [opportunity.primaryDomain] : []),
            ...(opportunity.additionalDomains ?? []),
          ],
          extractedFields: [
            "title",
            "description",
            ...(opportunity.category ? ["category"] : []),
            ...(opportunity.primaryDomain ? ["primaryDomain"] : []),
            ...(opportunity.participationFormat ? ["participationFormat"] : []),
            ...(opportunity.minimumTeamSize != null ||
            opportunity.maximumTeamSize != null
              ? ["teamSize"]
              : []),
            ...(opportunity.entryFeeAmount != null ? ["entryFee"] : []),
            ...(opportunity.individualEligible != null
              ? ["individualEligible"]
              : []),
            ...(opportunity.teamEligible != null ? ["teamEligible"] : []),
          ],
          canonicalUrl: opportunity.canonicalUrl,
          publishedAt: candidate.evidence.publishedAt,
        });
      }
    } catch (sourceError) {
      errors.push({ sourceId: source.id, code: sourceErrorCode(sourceError) });
    }
  }

  return {
    status: errors.length === 0
      ? "succeeded"
      : candidates.length > 0
        ? "partial"
        : "failed",
    sourcesAttempted: sources.length,
    recordsSeen,
    candidates,
    errors,
    persisted: 0,
  };
}

export async function runOpportunityDiscovery(
  admin: FirebaseDataClient,
  now: Date = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<CollectionSummary> {
  const staleBefore = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const { data: activeRuns, error: activeRunError } = await admin
    .from("collection_runs")
    .select("id,started_at")
    .eq("status", "running")
    .gte("started_at", staleBefore)
    .limit(1);

  if (activeRunError) {
    throw new Error(`Collection run lock lookup failed: ${activeRunError.code}`);
  }

  const activeRun = (activeRuns ?? [])[0];
  if (activeRun && typeof activeRun.id === "string") {
    return {
      runId: activeRun.id,
      status: "partial",
      sourcesAttempted: 0,
      recordsSeen: 0,
      recordsAdded: 0,
      errorCount: 0,
      skipped: true,
      reason: "DISCOVERY_ALREADY_RUNNING",
    };
  }

  await ensureDefaultOpportunitySources(admin);

  const checkedAt = now.toISOString();
  const { data: run, error: runError } = await admin
    .from("collection_runs")
    .insert({
      status: "running",
      triggered_by: "scheduler",
      started_at: checkedAt,
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(`Collection run could not be created: ${runError.code}`);
  }
  if (!run || typeof run.id !== "string") {
    throw new Error("Collection run creation returned no document ID.");
  }

  const runId = run.id;
  const { data: rawSources, error: sourcesError } = await admin
    .from("opportunity_sources")
    .select(
      "id,name,category,base_url,source_type,collection_method,supported_categories,supported_domains,rate_limit_seconds,last_succeeded_at,consecutive_failures,is_enabled",
    )
    .eq("is_enabled", true)
    .order("name", { ascending: true });

  if (sourcesError) {
    const { error: runFailureUpdateError } = await admin
      .from("collection_runs")
      .update({
        status: "failed",
        completed_at: checkedAt,
        error_count: 1,
        failure_summary: "SOURCE_REGISTRY_QUERY_FAILED",
      })
      .eq("id", runId);

    if (runFailureUpdateError) {
      console.error("opportunity_run_failure_record_failed", {
        runId,
        code: runFailureUpdateError.code,
      });
    }

    throw new Error(`Source registry could not be loaded: ${sourcesError.code}`);
  }

  const sources = (rawSources ?? []) as OpportunitySourceRow[];
  let recordsSeen = 0;
  let recordsAdded = 0;
  let recordsRejected = 0;
  let errorCount = 0;
  let sourceSucceededCount = 0;

  const outcomes = await runSourceTasksIndependently(
    sources,
    async (source) => {
    const { error: sourceRunInsertError } = await admin
      .from("collection_run_sources")
      .insert({
        run_id: runId,
        source_id: source.id,
        status: "running",
        started_at: checkedAt,
      });

    if (sourceRunInsertError) {
      throw new Error(
        `Source run record could not be created: ${sourceRunInsertError.code}`,
      );
    }

    if (isSourceRateLimited(source, now)) {
      const { error: skipError } = await admin
        .from("collection_run_sources")
        .update({
          status: "skipped",
          completed_at: checkedAt,
          error_code: "SOURCE_RATE_LIMITED",
        })
        .eq("run_id", runId)
        .eq("source_id", source.id);

      if (skipError) {
        throw new Error(`Rate-limited source could not be marked skipped: ${skipError.code}`);
      }

      return {
        recordsSeen: 0,
        recordsAdded: 0,
        recordsRejected: 0,
      };
    }

    let sourceAdded = 0;
    let sourceRejected = 0;
    let sourceSeen = 0;
    const candidates: OpportunityCandidate[] = [];

    if (source.collection_method === "api") {
      const apiCandidates = await fetchApiCandidates(source, fetcher);
      candidates.push(...apiCandidates);
      sourceSeen = apiCandidates.length;
    } else {
      const entries = await fetchRssSource(source, fetcher);
      sourceSeen = entries.length;

      for (const entry of entries) {
        try {
          const candidate = entryToCandidate(source, entry);
          if (candidate) candidates.push(candidate);
        } catch (error) {
          if (
            error instanceof SourceCollectionError &&
            error.code === "SOURCE_INVALID_RSS"
          ) {
            sourceRejected += 1;
            console.error("opportunity_entry_rejected", {
              runId,
              sourceId: source.id,
              code: error.code,
            });
            continue;
          }

          throw error;
        }
      }
    }

    for (const candidate of candidates) {
      if (await persistCandidate(admin, source, candidate, checkedAt)) {
        sourceAdded += 1;
      }
    }

    const { error: sourceRunUpdateError } = await admin
      .from("collection_run_sources")
      .update({
        status: "succeeded",
        completed_at: checkedAt,
        records_seen: sourceSeen,
        records_added: sourceAdded,
        records_rejected: sourceRejected,
      })
      .eq("run_id", runId)
      .eq("source_id", source.id);

    if (sourceRunUpdateError) {
      throw new Error(`Source run result update failed: ${sourceRunUpdateError.code}`);
    }

    await updateSourceHealth(admin, source, true, checkedAt);

    return {
      recordsSeen: sourceSeen,
      recordsAdded: sourceAdded,
      recordsRejected: sourceRejected,
    };
  });

  for (const outcome of outcomes) {
    const source = outcome.source;
    if (outcome.status === "succeeded") {
      sourceSucceededCount += 1;
      recordsSeen += outcome.value.recordsSeen;
      recordsAdded += outcome.value.recordsAdded;
      recordsRejected += outcome.value.recordsRejected;
      continue;
    }

    errorCount += 1;
    const errorCode = sourceErrorCode(outcome.error);
    console.error("opportunity_source_collection_failed", {
      runId,
      sourceId: source.id,
      code: errorCode,
    });

    try {
      await updateSourceHealth(admin, source, false, checkedAt);
      const { error: sourceRunUpdateError } = await admin
        .from("collection_run_sources")
        .update({
          status: "failed",
          completed_at: checkedAt,
          error_code: errorCode,
        })
        .eq("run_id", runId)
        .eq("source_id", source.id);

      if (sourceRunUpdateError) {
        console.error("opportunity_source_run_failure_record_failed", {
          runId,
          sourceId: source.id,
          code: sourceRunUpdateError.code,
        });
      }
    } catch (recordingError) {
      console.error("opportunity_source_failure_state_update_failed", {
        runId,
        sourceId: source.id,
        message: recordingError instanceof Error
          ? recordingError.message
          : "unknown",
      });
    }
  }

  const status =
    errorCount === 0
      ? "succeeded"
      : sourceSucceededCount === 0
        ? "failed"
        : "partial";

  const { error: runUpdateError } = await admin
    .from("collection_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      sources_attempted: sources.length,
      records_seen: recordsSeen,
      records_added: recordsAdded,
      records_rejected: recordsRejected,
      error_count: errorCount,
      failure_summary:
        errorCount > 0
          ? "One or more sources failed; inspect per-source run records."
          : null,
    })
    .eq("id", runId);

  if (runUpdateError) {
    throw new Error(`Collection run result update failed: ${runUpdateError.code}`);
  }

  return {
    runId,
    status,
    sourcesAttempted: sources.length,
    recordsSeen,
    recordsAdded,
    errorCount,
  };
}
