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
  started ??= boss.start().then(async (b) => {
    await b.createQueue(QUEUE_NAMES.processMaterial);
    await b.createQueue(QUEUE_NAMES.generateRecommendation);
    return b;
  });
  return started;
}
