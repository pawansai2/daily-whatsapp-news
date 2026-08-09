-- ============================================================
-- Delivery occurrence model
--
-- Purpose:
-- Replace the old "one delivery type per user per day" model
-- with per-occurrence idempotency.
--
-- This enables:
-- - multiple task reminders per day
-- - snoozed reminders
-- - morning/evening news
-- - daily briefs
-- - newspaper updates
-- - important alerts
-- ============================================================

ALTER TABLE public.deliveries
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reference_id TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Preserve existing delivery history.
--
-- Existing rows receive a unique legacy key so today's successful
-- Telegram delivery and all previous records remain valid.
UPDATE public.deliveries
SET
    scheduled_for = COALESCE(
        scheduled_for,
        created_at
    ),
    idempotency_key = COALESCE(
        idempotency_key,
        'legacy:' || id::text
    ),
    sent_at = CASE
        WHEN status = 'sent'
            THEN COALESCE(sent_at, updated_at)
        ELSE sent_at
    END
WHERE
    scheduled_for IS NULL
    OR idempotency_key IS NULL
    OR (
        status = 'sent'
        AND sent_at IS NULL
    );

-- New duplicate protection:
--
-- same user + same occurrence => blocked
-- same user + another occurrence => allowed
CREATE UNIQUE INDEX IF NOT EXISTS
    deliveries_owner_id_idempotency_key_uidx
ON public.deliveries (
    owner_id,
    idempotency_key
)
WHERE idempotency_key IS NOT NULL;

-- Useful for the future scheduler.
CREATE INDEX IF NOT EXISTS
    deliveries_scheduled_for_idx
ON public.deliveries (
    scheduled_for
);

CREATE INDEX IF NOT EXISTS
    deliveries_owner_type_scheduled_idx
ON public.deliveries (
    owner_id,
    delivery_type,
    scheduled_for
);

-- Remove the old one-per-day uniqueness rule.
--
-- The constraint was created without an explicit name, but locate it
-- by its definition rather than depending only on PostgreSQL's
-- generated constraint name.
DO $$
DECLARE
    old_constraint RECORD;
BEGIN
    FOR old_constraint IN
        SELECT conname
        FROM pg_constraint
        WHERE
            conrelid = 'public.deliveries'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE '%owner_id%'
            AND pg_get_constraintdef(oid) ILIKE '%delivery_type%'
            AND pg_get_constraintdef(oid) ILIKE '%local_delivery_date%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.deliveries DROP CONSTRAINT %I',
            old_constraint.conname
        );
    END LOOP;
END
$$;

COMMENT ON COLUMN public.deliveries.scheduled_for IS
    'Exact occurrence time this delivery is scheduled for.';

COMMENT ON COLUMN public.deliveries.reference_id IS
    'Optional owning object such as task ID, digest schedule ID, or alert ID.';

COMMENT ON COLUMN public.deliveries.idempotency_key IS
    'Stable unique key identifying one logical delivery occurrence for a user.';

COMMENT ON COLUMN public.deliveries.sent_at IS
    'Timestamp when the provider successfully accepted this delivery.';
