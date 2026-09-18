import PgBoss from "pg-boss";
import { config } from "../core/config";

export const QUEUE_NAMES = {
  processMaterial: "process-material",
  generateRecommendation: "generate-recommendation",
} as const;

/**
 * Postgres-native queue (decision A3/D13) — pg-boss creates and manages its own
 * schema in the same database, so there is no separate broker to run/deploy.
 */
export const boss = new PgBoss({
  connectionString: config.DATABASE_URL,
  retryLimit: 3,
  retryBackoff: true,
});

boss.on("error", (err) => {
  console.error("pg-boss error:", err);
});

let started: Promise<PgBoss> | null = null;

export async function ensureBossStarted(): Promise<PgBoss> {
  started ??= boss
    .start()
    .then(async (b) => {
      await b.createQueue(QUEUE_NAMES.processMaterial);
      await b.createQueue(QUEUE_NAMES.generateRecommendation);
      return b;
    })
    .catch((err) => {
      // `??=` only re-assigns when `started` is null/undefined — a rejected
      // promise is still a non-null value, so without this reset a single
      // transient startup failure (e.g. Postgres briefly unreachable) would
      // permanently break every enqueue/worker call with the same stale
      // rejection, even after Postgres recovers. Found via code audit.
      started = null;
      throw err;
    });
  return started;
}
