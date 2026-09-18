import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { supabaseClientOptions } from "./supabaseClientOptions";

/**
 * Lazily constructed for the same reason as core/storage.ts and core/auth.ts:
 * @supabase/supabase-js throws synchronously on an empty URL/key, and the app
 * must boot before real credentials exist. The service-role key is required
 * here (not the anon key) — creating a user via the Admin API is a privileged
 * operation, and every caller of this module must itself be gated by
 * requireAdmin (see core/auth.ts) before reaching it.
 */
let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  adminClient ??= createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, supabaseClientOptions);
  return adminClient;
}

export class SupabaseAdminError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupabaseAdminError";
    this.status = status;
  }
}

/**
 * Creates a fully-confirmed auth user directly via the service-role Admin API —
 * bypasses email confirmation/rate limits entirely (matches scripts/seed.ts's
 * existing demo-user creation pattern, see CLAUDE.md "Environment variables /
 * secrets"). The admin sets the initial password directly; there is no invite
 * email flow at prototype scale.
 */
export async function createAuthUser(email: string, password: string): Promise<{ id: string }> {
  const { data, error } = await getAdminClient().auth.admin.createUser({ email, password, email_confirm: true });

  if (error || !data.user) {
    // Supabase's own wording for a duplicate address varies by version but always
    // mentions "registered" — mapped to 409 so the router can report a clean
    // conflict instead of a generic 400 for the single most common failure mode.
    const status = error?.message.toLowerCase().includes("registered") ? 409 : 400;
    throw new SupabaseAdminError(error?.message ?? "Failed to create auth user", status);
  }

  return { id: data.user.id };
}
