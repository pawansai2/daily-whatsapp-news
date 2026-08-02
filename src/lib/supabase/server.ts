import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

function requireServerEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required server environment variable: ${name}`,
    );
  }

  return value;
}

export function hasSupabaseServerConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SECRET_KEY?.trim(),
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = requireServerEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  const supabaseSecretKey = requireServerEnvironmentVariable(
    "SUPABASE_SECRET_KEY",
  );

  cachedAdminClient = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  return cachedAdminClient;
}

/*
 * Temporary compatibility alias.
 * New code should call getSupabaseAdmin().
 */
export const createAdminClient = getSupabaseAdmin;