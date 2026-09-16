import WebSocket from "ws";
import type { SupabaseClientOptions } from "@supabase/supabase-js";

/**
 * @supabase/supabase-js always constructs a Realtime client, which requires a
 * native WebSocket global — present in Node 22+ but not Node 20. We don't use
 * Realtime anywhere, but createClient() still throws at construction time on
 * Node 20 without this. Verified: without this option, createClient() throws
 * "Node.js 20 detected without native WebSocket support" immediately.
 */
export const supabaseClientOptions: SupabaseClientOptions<"public"> = {
  // `ws`'s types and Node's built-in (undici-based) global `WebSocket` type
  // declaration conflict on the constructor signature — this is a real,
  // structurally-compatible implementation at runtime, hence the cast.
  realtime: { transport: WebSocket as unknown as NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"] },
};
