import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "./config";
import * as schema from "../../db/schema";

export const pool = new Pool({ connectionString: config.DATABASE_URL });

// node-postgres emits 'error' on the Pool for any *idle* client that dies
// (e.g. a network blip, the pooler recycling a connection) — with no listener,
// Node treats that as an unhandled event and crashes the whole process. This
// happened live (a transient DNS failure to Supabase's pooler took down the
// entire API server mid-session). pg automatically discards and replaces the
// broken client; logging here is enough to stay recoverable.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/** The type `db.transaction(async (tx) => ...)` hands its callback — structurally
 * compatible with `Database` for query building, but not the same nominal type
 * (no `$client`), so a repository function that must work either standalone or
 * inside a caller's transaction takes `Executor`, not `Database`. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
