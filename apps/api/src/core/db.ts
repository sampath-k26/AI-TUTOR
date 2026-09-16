import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "./config";
import * as schema from "../../db/schema";

export const pool = new Pool({ connectionString: config.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
