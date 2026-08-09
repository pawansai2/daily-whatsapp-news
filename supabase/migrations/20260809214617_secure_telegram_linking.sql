-- ============================================================
-- Secure Telegram account linking
--
-- Atomically consumes a short-lived link token and associates
-- the Telegram chat with the authenticated application user
-- that generated that token.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_telegram_link(
    p_token_hash TEXT,
    p_chat_id TEXT,
    p_username TEXT DEFAULT NULL
)
RETURNS TABLE (
    link_status TEXT,
    linked_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_id UUID;
    v_user_id UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_used_at TIMESTAMP WITH TIME ZONE;
    v_now TIMESTAMP WITH TIME ZONE :=
        timezone('utc'::text, now());
BEGIN
    -- Basic defensive validation.
    IF
        p_token_hash IS NULL
        OR length(trim(p_token_hash)) = 0
        OR p_chat_id IS NULL
        OR length(trim(p_chat_id)) = 0
    THEN
        RETURN QUERY
        SELECT
            'invalid'::TEXT,
            NULL::UUID;

        RETURN;
    END IF;

    -- Lock the token row so two simultaneous webhook requests
    -- cannot consume the same token independently.
    SELECT
        token.id,
        token.user_id,
        token.expires_at,
        token.used_at
    INTO
        v_token_id,
        v_user_id,
        v_expires_at,
        v_used_at
    FROM public.telegram_link_tokens AS token
    WHERE
        token.token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'invalid'::TEXT,
            NULL::UUID;

        RETURN;
    END IF;

    -- Telegram may retry a webhook.
    -- If this exact chat already consumed the token successfully,
    -- return an idempotent result instead of reporting failure.
    IF v_used_at IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.user_channels AS channel_row
            WHERE
                channel_row.user_id = v_user_id
                AND channel_row.channel = 'telegram'
                AND channel_row.external_chat_id = p_chat_id
                AND channel_row.is_active = TRUE
        ) THEN
            RETURN QUERY
            SELECT
                'already_linked'::TEXT,
                v_user_id;

            RETURN;
        END IF;

        RETURN QUERY
        SELECT
            'invalid'::TEXT,
            NULL::UUID;

        RETURN;
    END IF;

    IF v_expires_at <= v_now THEN
        RETURN QUERY
        SELECT
            'expired'::TEXT,
            NULL::UUID;

        RETURN;
    END IF;

    -- A Telegram chat may belong to only one application account.
    IF EXISTS (
        SELECT 1
        FROM public.user_channels AS channel_row
        WHERE
            channel_row.channel = 'telegram'
            AND channel_row.external_chat_id = p_chat_id
            AND channel_row.user_id <> v_user_id
    ) THEN
        RETURN QUERY
        SELECT
            'chat_already_linked'::TEXT,
            NULL::UUID;

        RETURN;
    END IF;

    INSERT INTO public.user_channels (
        user_id,
        channel,
        external_chat_id,
        username,
        verified_at,
        is_active,
        updated_at
    )
    VALUES (
        v_user_id,
        'telegram',
        p_chat_id,
        NULLIF(trim(p_username), ''),
        v_now,
        TRUE,
        v_now
    )
    ON CONFLICT (
        user_id,
        channel
    )
    DO UPDATE SET
        external_chat_id =
            EXCLUDED.external_chat_id,
        username =
            EXCLUDED.username,
        verified_at =
            EXCLUDED.verified_at,
        is_active = TRUE,
        updated_at =
            EXCLUDED.updated_at;

    UPDATE public.telegram_link_tokens
    SET used_at = v_now
    WHERE id = v_token_id;

    RETURN QUERY
    SELECT
        'linked'::TEXT,
        v_user_id;

    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY
        SELECT
            'chat_already_linked'::TEXT,
            NULL::UUID;

        RETURN;
END;
$$;


-- Database functions are executable by PUBLIC by default unless
-- privileges are explicitly restricted.
REVOKE ALL
ON FUNCTION public.claim_telegram_link(
    TEXT,
    TEXT,
    TEXT
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.claim_telegram_link(
    TEXT,
    TEXT,
    TEXT
)
FROM anon;

REVOKE ALL
ON FUNCTION public.claim_telegram_link(
    TEXT,
    TEXT,
    TEXT
)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.claim_telegram_link(
    TEXT,
    TEXT,
    TEXT
)
TO service_role;


COMMENT ON FUNCTION public.claim_telegram_link(
    TEXT,
    TEXT,
    TEXT
) IS
    'Atomically consumes a Telegram link token and associates the Telegram chat with its application user.';
