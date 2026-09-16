import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud in dev console rather than a silent, confusing failure the first time
  // someone calls supabase.auth.* before .env is filled in (see CLAUDE.md).
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — auth will not work until apps/web/.env is filled in.",
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");
