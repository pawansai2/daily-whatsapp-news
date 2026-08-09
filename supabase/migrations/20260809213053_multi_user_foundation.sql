-- ============================================================
-- Multi-user foundation
--
-- Adds:
--   profiles
--   user_channels
--   telegram_link_tokens
--
-- Also makes phone data optional because Telegram is now the
-- primary channel.
--
-- Existing owner_id columns are intentionally preserved.
-- ============================================================


-- ============================================================
-- 1. USER PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    display_name TEXT,

    language TEXT NOT NULL DEFAULT 'en',

    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    created_at TIMESTAMP WITH TIME ZONE
        NOT NULL
        DEFAULT timezone('utc'::text, now()),

    updated_at TIMESTAMP WITH TIME ZONE
        NOT NULL
        DEFAULT timezone('utc'::text, now())
);


-- ============================================================
-- 2. PER-USER DELIVERY CHANNELS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    channel TEXT NOT NULL
        CHECK (
            channel IN (
                'telegram',
                'whatsapp',
                'email'
            )
        ),

    external_chat_id TEXT,

    username TEXT,

    verified_at TIMESTAMP WITH TIME ZONE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE
        NOT NULL
        DEFAULT timezone('utc'::text, now()),

    updated_at TIMESTAMP WITH TIME ZONE
        NOT NULL
        DEFAULT timezone('utc'::text, now()),

    UNIQUE(user_id, channel)
);


-- One Telegram chat must not be connected to two different
-- application users simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS
    user_channels_telegram_chat_uidx
ON public.user_channels (
    external_chat_id
)
WHERE
    channel = 'telegram'
    AND external_chat_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    user_channels_user_id_idx
ON public.user_channels (
    user_id
);


-- ============================================================
-- 3. SECURE TELEGRAM LINK TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    used_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE
        NOT NULL
        DEFAULT timezone('utc'::text, now())
);


CREATE INDEX IF NOT EXISTS
    telegram_link_tokens_user_id_idx
ON public.telegram_link_tokens (
    user_id
);


CREATE INDEX IF NOT EXISTS
    telegram_link_tokens_expiry_idx
ON public.telegram_link_tokens (
    expires_at
)
WHERE used_at IS NULL;


-- ============================================================
-- 4. PHONE BECOMES OPTIONAL
-- ============================================================

ALTER TABLE public.personal_settings
    ALTER COLUMN phone_lookup_hash DROP NOT NULL,
    ALTER COLUMN encrypted_phone DROP NOT NULL;


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_channels
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.telegram_link_tokens
    ENABLE ROW LEVEL SECURITY;


-- Profile: user can read their own profile.
DROP POLICY IF EXISTS
    "Users can read own profile"
ON public.profiles;

CREATE POLICY
    "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = id
);


-- Profile: user can update their own profile.
DROP POLICY IF EXISTS
    "Users can update own profile"
ON public.profiles;

CREATE POLICY
    "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) = id
)
WITH CHECK (
    (SELECT auth.uid()) = id
);


-- Channels are readable only by their owning user.
--
-- Channel creation/linking will be performed by trusted
-- server-side code using the Supabase service role.
DROP POLICY IF EXISTS
    "Users can read own channels"
ON public.user_channels;

CREATE POLICY
    "Users can read own channels"
ON public.user_channels
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
);


-- Telegram link tokens intentionally receive no authenticated
-- CRUD policy.
--
-- They are created and consumed only by trusted server-side
-- application code using the service role.
-- RLS therefore blocks normal client access.


-- ============================================================
-- 6. AUTOMATIC PROFILE CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        display_name
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            split_part(
                COALESCE(NEW.email, ''),
                '@',
                1
            )
        )
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    on_auth_user_created_profile
ON auth.users;

CREATE TRIGGER
    on_auth_user_created_profile
AFTER INSERT
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();


-- ============================================================
-- 7. BACKFILL EXISTING USERS
-- ============================================================

INSERT INTO public.profiles (
    id,
    display_name
)
SELECT
    users.id,
    COALESCE(
        users.raw_user_meta_data ->> 'full_name',
        users.raw_user_meta_data ->> 'name',
        split_part(
            COALESCE(users.email, ''),
            '@',
            1
        )
    )
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 8. DOCUMENTATION
-- ============================================================

COMMENT ON TABLE public.profiles IS
    'Per-user application profile linked one-to-one with Supabase Auth.';

COMMENT ON TABLE public.user_channels IS
    'Verified delivery channels belonging to individual application users.';

COMMENT ON COLUMN public.user_channels.external_chat_id IS
    'Provider-specific destination identifier such as a Telegram chat ID.';

COMMENT ON TABLE public.telegram_link_tokens IS
    'Short-lived hashed tokens used to securely associate Telegram chats with authenticated users.';
