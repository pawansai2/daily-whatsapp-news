-- Opportunity Radar data foundation.
-- All opportunity facts are nullable unless they are required to identify a record.

CREATE TABLE public.opportunity_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    base_url TEXT NOT NULL CHECK (base_url ~ '^https://'),
    source_type TEXT NOT NULL
        CHECK (source_type IN ('official', 'third_party')),
    collection_method TEXT NOT NULL
        CHECK (collection_method IN ('rss', 'api', 'website', 'manual')),
    supported_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    supported_domains TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    rate_limit_seconds INTEGER NOT NULL DEFAULT 60
        CHECK (rate_limit_seconds >= 0),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_succeeded_at TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ,
    consecutive_failures INTEGER NOT NULL DEFAULT 0
        CHECK (consecutive_failures >= 0),
    reliability_score NUMERIC(4, 3)
        CHECK (reliability_score BETWEEN 0 AND 1),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE TABLE public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_url TEXT NOT NULL CHECK (canonical_url ~ '^https://'),
    canonical_url_hash CHAR(64) NOT NULL UNIQUE
        CHECK (canonical_url_hash ~ '^[0-9a-f]{64}$'),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    organizer TEXT,
    short_description TEXT,
    full_description TEXT,
    category TEXT,
    primary_domain TEXT,
    additional_domains TEXT[],
    required_skills TEXT[],
    difficulty_level TEXT,
    geography TEXT,
    location TEXT,
    participation_format TEXT,
    individual_eligible BOOLEAN,
    team_eligible BOOLEAN,
    minimum_team_size INTEGER CHECK (minimum_team_size IS NULL OR minimum_team_size > 0),
    maximum_team_size INTEGER CHECK (maximum_team_size IS NULL OR maximum_team_size > 0),
    eligible_education_levels TEXT[],
    eligible_graduation_years INTEGER[],
    eligible_branches TEXT[],
    eligible_countries TEXT[],
    experience_restrictions TEXT,
    registration_opens_on DATE,
    registration_closes_on DATE,
    submission_deadline TIMESTAMPTZ,
    event_starts_on DATE,
    event_ends_on DATE,
    entry_fee_amount NUMERIC(12, 2)
        CHECK (entry_fee_amount IS NULL OR entry_fee_amount >= 0),
    entry_fee_currency CHAR(3)
        CHECK (
            entry_fee_currency IS NULL
            OR entry_fee_currency ~ '^[A-Z]{3}$'
        ),
    prize_details TEXT,
    certificate_available BOOLEAN,
    travel_support BOOLEAN,
    accommodation BOOLEAN,
    food_provided BOOLEAN,
    mentorship BOOLEAN,
    networking BOOLEAN,
    internship_pathway BOOLEAN,
    job_pathway BOOLEAN,
    official_application_url TEXT,
    eligibility_conflicts TEXT[] NOT NULL DEFAULT '{}',
    verified_fields TEXT[] NOT NULL DEFAULT '{}'
        CHECK (
            verified_fields <@ ARRAY[
                'eligibleEducationLevels',
                'eligibleGraduationYears',
                'eligibleBranches',
                'eligibleCountries',
                'teamSize',
                'individualEligible',
                'teamEligible',
                'requiredSkills',
                'experienceRestrictions',
                'primaryDomain',
                'additionalDomains',
                'internshipPathway',
                'jobPathway',
                'certificateAvailable',
                'travelSupport',
                'accommodation',
                'foodProvided',
                'mentorship',
                'networking',
                'entryFeeAmount',
                'entryFeeCurrency',
                'participationFormat',
                'registrationOpensOn',
                'registrationClosesOn',
                'submissionDeadline',
                'officialApplicationUrl'
            ]::TEXT[]
        ),
    verification_status TEXT NOT NULL DEFAULT 'pending_verification'
        CHECK (
            verification_status IN (
                'discovered',
                'extracted',
                'officially_verified',
                'official_source_partial',
                'partially_verified',
                'third_party_reported',
                'pending_verification',
                'unverified',
                'conflicting',
                'cancelled',
                'postponed',
                'expired'
            )
        ),
    lifecycle_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (
            lifecycle_status IN (
                'unknown',
                'upcoming',
                'active',
                'closing_soon',
                'closed',
                'expired',
                'postponed',
                'cancelled'
            )
        ),
    data_completeness SMALLINT
        CHECK (data_completeness IS NULL OR data_completeness BETWEEN 0 AND 100),
    first_discovered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    last_checked_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    CHECK (
        minimum_team_size IS NULL
        OR maximum_team_size IS NULL
        OR minimum_team_size <= maximum_team_size
    ),
    CHECK (
        registration_opens_on IS NULL
        OR registration_closes_on IS NULL
        OR registration_opens_on <= registration_closes_on
    ),
    CHECK (
        event_starts_on IS NULL
        OR event_ends_on IS NULL
        OR event_starts_on <= event_ends_on
    ),
    CHECK (
        official_application_url IS NULL
        OR official_application_url ~ '^https://'
    )
);

CREATE TABLE public.opportunity_source_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL
        REFERENCES public.opportunities(id) ON DELETE CASCADE,
    source_id UUID NOT NULL
        REFERENCES public.opportunity_sources(id) ON DELETE RESTRICT,
    source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
    source_record_key TEXT,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('official', 'third_party')),
    verification_status TEXT NOT NULL DEFAULT 'pending_verification'
        CHECK (
            verification_status IN (
                'discovered',
                'extracted',
                'officially_verified',
                'official_source_partial',
                'partially_verified',
                'third_party_reported',
                'pending_verification',
                'unverified',
                'conflicting',
                'cancelled',
                'postponed',
                'expired'
            )
        ),
    evidence JSONB,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    UNIQUE (source_id, source_url)
);

CREATE TABLE public.opportunity_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL
        REFERENCES public.opportunities(id) ON DELETE CASCADE,
    source_record_id UUID
        REFERENCES public.opportunity_source_records(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    change_reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE TABLE public.opportunity_field_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL
        REFERENCES public.opportunities(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL
        CHECK (
            field_name = ANY (ARRAY[
                'eligibleEducationLevels',
                'eligibleGraduationYears',
                'eligibleBranches',
                'eligibleCountries',
                'teamSize',
                'requiredSkills',
                'individualEligible',
                'teamEligible',
                'experienceRestrictions',
                'primaryDomain',
                'additionalDomains',
                'internshipPathway',
                'jobPathway',
                'certificateAvailable',
                'travelSupport',
                'accommodation',
                'foodProvided',
                'mentorship',
                'networking',
                'entryFeeAmount',
                'entryFeeCurrency',
                'participationFormat',
                'registrationOpensOn',
                'registrationClosesOn',
                'submissionDeadline',
                'officialApplicationUrl'
            ]::TEXT[])
        ),
    evidence_url TEXT NOT NULL CHECK (evidence_url ~ '^https://'),
    source_name TEXT NOT NULL CHECK (length(trim(source_name)) > 0),
    source_type TEXT NOT NULL
        CHECK (source_type IN ('official', 'third_party')),
    evidence_excerpt TEXT NOT NULL
        CHECK (length(trim(evidence_excerpt)) > 0),
    field_value JSONB,
    decision TEXT NOT NULL
        CHECK (
            decision IN (
                'verified',
                'third_party_reported',
                'conflicting',
                'unverified'
            )
        ),
    reviewer_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE TABLE public.collection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
    triggered_by TEXT NOT NULL DEFAULT 'scheduler',
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    completed_at TIMESTAMPTZ,
    sources_attempted INTEGER NOT NULL DEFAULT 0 CHECK (sources_attempted >= 0),
    records_seen INTEGER NOT NULL DEFAULT 0 CHECK (records_seen >= 0),
    records_added INTEGER NOT NULL DEFAULT 0 CHECK (records_added >= 0),
    records_rejected INTEGER NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
    records_updated INTEGER NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
    error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
    failure_summary TEXT
);

CREATE TABLE public.collection_run_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL
        REFERENCES public.collection_runs(id) ON DELETE CASCADE,
    source_id UUID NOT NULL
        REFERENCES public.opportunity_sources(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    completed_at TIMESTAMPTZ,
    records_seen INTEGER NOT NULL DEFAULT 0 CHECK (records_seen >= 0),
    records_added INTEGER NOT NULL DEFAULT 0 CHECK (records_added >= 0),
    records_rejected INTEGER NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
    error_code TEXT,
    UNIQUE (run_id, source_id)
);

CREATE TABLE public.opportunity_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    education_level TEXT,
    degree TEXT,
    branch_or_discipline TEXT,
    institution TEXT,
    graduation_year INTEGER
        CHECK (
            graduation_year IS NULL
            OR graduation_year BETWEEN 1950 AND 2100
        ),
    eligibility_country TEXT,
    current_status TEXT,
    programming_languages TEXT[],
    technical_skills JSONB,
    projects JSONB,
    experience JSONB,
    certifications TEXT[],
    preferred_domains TEXT[],
    geographic_preferences TEXT[],
    participation_formats TEXT[],
    individual_team_preference TEXT
        CHECK (
            individual_team_preference IS NULL
            OR individual_team_preference IN ('individual', 'team', 'either')
        ),
    available_team_size INTEGER
        CHECK (available_team_size IS NULL OR available_team_size > 0),
    internship_eligible BOOLEAN,
    employment_eligible BOOLEAN,
    travel_available BOOLEAN,
    budget_limit_amount NUMERIC(12, 2)
        CHECK (budget_limit_amount IS NULL OR budget_limit_amount >= 0),
    budget_limit_currency CHAR(3)
        CHECK (
            budget_limit_currency IS NULL
            OR budget_limit_currency ~ '^[A-Z]{3}$'
        ),
    opportunity_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    opportunity_digest_minimum_score SMALLINT NOT NULL DEFAULT 60
        CHECK (opportunity_digest_minimum_score BETWEEN 0 AND 100),
    deadline_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    registration_opening_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    deadline_change_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    timezone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE TABLE public.user_opportunity_tracking (
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL
        REFERENCES public.opportunities(id) ON DELETE CASCADE,
    status TEXT NOT NULL
        CHECK (status IN ('saved', 'applied')),
    notes TEXT,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    PRIMARY KEY (user_id, opportunity_id),
    CHECK (status <> 'applied' OR applied_at IS NOT NULL)
);

CREATE TABLE public.opportunity_alert_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL
        REFERENCES public.opportunities(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel = 'telegram'),
    event_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'sent', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
    telegram_message_id BIGINT,
    failure_code TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    UNIQUE (user_id, opportunity_id, channel, event_key)
);

CREATE INDEX opportunities_deadline_idx
    ON public.opportunities (submission_deadline)
    WHERE submission_deadline IS NOT NULL;
CREATE INDEX opportunities_registration_close_idx
    ON public.opportunities (registration_closes_on)
    WHERE registration_closes_on IS NOT NULL;
CREATE INDEX opportunities_verification_lifecycle_idx
    ON public.opportunities (verification_status, lifecycle_status);
CREATE INDEX opportunity_source_records_opportunity_idx
    ON public.opportunity_source_records (opportunity_id);
CREATE INDEX opportunity_changes_history_idx
    ON public.opportunity_changes (opportunity_id, changed_at DESC);
CREATE INDEX opportunity_field_evidence_history_idx
    ON public.opportunity_field_evidence (opportunity_id, reviewed_at DESC);
CREATE INDEX collection_runs_started_idx
    ON public.collection_runs (started_at DESC);
CREATE INDEX collection_run_sources_source_idx
    ON public.collection_run_sources (source_id, started_at DESC);
CREATE INDEX user_opportunity_tracking_user_status_idx
    ON public.user_opportunity_tracking (user_id, status);
CREATE INDEX opportunity_alert_deliveries_retry_idx
    ON public.opportunity_alert_deliveries (status, updated_at)
    WHERE status IN ('processing', 'failed');

CREATE FUNCTION public.refresh_opportunity_lifecycle(
    p_as_of_date DATE DEFAULT current_date
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    opportunity_row RECORD;
    new_status TEXT;
    earliest_deadline DATE;
    opening_date DATE;
    updated_count INTEGER := 0;
BEGIN
    FOR opportunity_row IN
        SELECT
            id,
            lifecycle_status,
            registration_opens_on,
            registration_closes_on,
            submission_deadline,
            verified_fields
        FROM public.opportunities
        WHERE lifecycle_status NOT IN ('closed', 'expired', 'cancelled', 'postponed')
    LOOP
        earliest_deadline := NULL;
        opening_date := NULL;

        IF 'registrationClosesOn' = ANY (opportunity_row.verified_fields) THEN
            earliest_deadline := opportunity_row.registration_closes_on;
        END IF;

        IF 'submissionDeadline' = ANY (opportunity_row.verified_fields)
            AND opportunity_row.submission_deadline IS NOT NULL
            AND (
                earliest_deadline IS NULL
                OR (opportunity_row.submission_deadline AT TIME ZONE 'UTC')::DATE
                    < earliest_deadline
            )
        THEN
            earliest_deadline :=
                (opportunity_row.submission_deadline AT TIME ZONE 'UTC')::DATE;
        END IF;

        IF 'registrationOpensOn' = ANY (opportunity_row.verified_fields) THEN
            opening_date := opportunity_row.registration_opens_on;
        END IF;

        new_status := opportunity_row.lifecycle_status;
        IF earliest_deadline IS NOT NULL AND earliest_deadline < p_as_of_date THEN
            new_status := 'expired';
        ELSIF earliest_deadline IS NOT NULL
            AND earliest_deadline <= p_as_of_date + 7
        THEN
            new_status := 'closing_soon';
        ELSIF opening_date IS NOT NULL AND opening_date > p_as_of_date THEN
            new_status := 'upcoming';
        ELSIF earliest_deadline IS NOT NULL THEN
            new_status := 'active';
        END IF;

        IF new_status IS DISTINCT FROM opportunity_row.lifecycle_status THEN
            UPDATE public.opportunities
            SET lifecycle_status = new_status,
                updated_at = timezone('utc'::TEXT, now())
            WHERE id = opportunity_row.id
                AND lifecycle_status = opportunity_row.lifecycle_status;

            IF FOUND THEN
                INSERT INTO public.opportunity_changes (
                    opportunity_id,
                    field_name,
                    previous_value,
                    new_value,
                    change_reason
                )
                VALUES (
                    opportunity_row.id,
                    'lifecycle_status',
                    to_jsonb(opportunity_row.lifecycle_status),
                    to_jsonb(new_status),
                    'Automated lifecycle refresh using verified dates.'
                );
                updated_count := updated_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN updated_count;
END;
$$;

ALTER TABLE public.opportunity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_field_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_run_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_opportunity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read opportunity sources"
    ON public.opportunity_sources FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "Authenticated users can read opportunities"
    ON public.opportunities FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "Authenticated users can read opportunity source records"
    ON public.opportunity_source_records FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "Authenticated users can read opportunity changes"
    ON public.opportunity_changes FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "Authenticated users can read opportunity evidence"
    ON public.opportunity_field_evidence FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "Authenticated users can read collection runs"
    ON public.collection_runs FOR SELECT TO authenticated
    USING (TRUE);
CREATE POLICY "Authenticated users can read source run status"
    ON public.collection_run_sources FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "Users manage own opportunity profile"
    ON public.opportunity_profiles FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users manage own opportunity tracking"
    ON public.user_opportunity_tracking FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users read own opportunity alert history"
    ON public.opportunity_alert_deliveries FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON
    public.opportunity_sources,
    public.opportunities,
    public.opportunity_source_records,
    public.opportunity_changes,
    public.opportunity_field_evidence,
    public.collection_runs,
    public.collection_run_sources
TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.opportunity_profiles,
    public.user_opportunity_tracking
TO authenticated;
GRANT SELECT ON public.opportunity_alert_deliveries TO authenticated;
GRANT ALL ON
    public.opportunity_sources,
    public.opportunities,
    public.opportunity_source_records,
    public.opportunity_changes,
    public.opportunity_field_evidence,
    public.collection_runs,
    public.collection_run_sources,
    public.opportunity_profiles,
    public.user_opportunity_tracking,
    public.opportunity_alert_deliveries
TO service_role;
REVOKE ALL ON FUNCTION public.refresh_opportunity_lifecycle(DATE)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_opportunity_lifecycle(DATE)
TO service_role;

COMMENT ON TABLE public.opportunities IS
    'Canonical opportunity facts; NULL means unknown, while documented zero/false values remain explicit.';
COMMENT ON TABLE public.opportunity_source_records IS
    'Source provenance and field evidence for each discovered opportunity.';
COMMENT ON TABLE public.opportunity_changes IS
    'Append-only history for meaningful opportunity field changes.';
COMMENT ON TABLE public.opportunity_field_evidence IS
    'Reviewer-recorded source evidence; evidence is not an automated claim of truth.';
COMMENT ON TABLE public.opportunity_profiles IS
    'Private, editable user facts used for explainable eligibility evaluation.';
COMMENT ON TABLE public.user_opportunity_tracking IS
    'Per-user saved/applied state; absence of a row means not saved.';
COMMENT ON TABLE public.opportunity_alert_deliveries IS
    'Idempotent per-user Telegram opportunity alert attempts and recovery state.';
