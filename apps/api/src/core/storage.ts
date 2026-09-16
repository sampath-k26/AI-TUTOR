import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

/**
 * Lazily constructed: @supabase/supabase-js throws synchronously if the URL/key
 * are empty, so this must not run at import time (the app boots before real
 * Supabase credentials exist — see CLAUDE.md "Environment variables / secrets").
 * Only an actual storage operation needs to fail before credentials are set.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  client ??= createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  return client;
}

export async function uploadMaterialFile(path: string, fileBuffer: Buffer, contentType: string): Promise<string> {
  const { data, error } = await getClient()
    .storage.from(config.SUPABASE_STORAGE_BUCKET)
    .upload(path, fileBuffer, { contentType });

  if (error || !data) {
    throw new Error(`Storage upload failed: ${error?.message ?? "unknown error"}`);
  }
  return data.path;
}

export async function downloadMaterialFile(path: string): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(config.SUPABASE_STORAGE_BUCKET).download(path);

  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? "unknown error"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}
