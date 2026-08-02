-- Migration: 00000000000000_init.sql

CREATE TABLE personal_settings (
    owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_lookup_hash TEXT UNIQUE NOT NULL,
    encrypted_phone TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'te', 'ta', 'kn')),
    country TEXT,
    state TEXT,
    district TEXT,
    city TEXT,
    custom_keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    delivery_time TEXT NOT NULL DEFAULT '08:00' CHECK (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    story_limit INTEGER NOT NULL DEFAULT 10 CHECK (story_limit BETWEEN 1 AND 20),
    digest_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE personal_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    normalized_slug TEXT NOT NULL,
    display_name TEXT NOT NULL,
    interest_type TEXT NOT NULL DEFAULT 'custom',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(owner_id, normalized_slug)
);

CREATE TABLE sent_article_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url_hash TEXT NOT NULL,
    title_hash TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    local_delivery_date DATE NOT NULL,
    delivery_type TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    attempt_count INTEGER DEFAULT 1,
    failure_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(owner_id, delivery_type, local_delivery_date)
);

CREATE TABLE inbound_messages (
    provider_message_id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    command_type TEXT,
    status TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE pending_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_hash TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE
);

-- Row Level Security (RLS)
ALTER TABLE personal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_article_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_confirmations ENABLE ROW LEVEL SECURITY;

-- Owner Policies
CREATE POLICY "Owner access personal_settings"
ON personal_settings
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owner access personal_interests"
ON personal_interests
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owner access sent_article_hashes"
ON sent_article_hashes
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owner access deliveries"
ON deliveries
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owner access inbound_messages"
ON inbound_messages
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owner access pending_confirmations"
ON pending_confirmations
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);
