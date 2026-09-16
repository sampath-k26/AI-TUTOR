import type { NextFunction, Request, Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { profiles } from "../../db/schema";
import { supabaseClientOptions } from "./supabaseClientOptions";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Lazily constructed for the same reason as core/storage.ts: @supabase/supabase-js
 * throws synchronously on an empty URL/key, and the app must boot before real
 * credentials exist. Only the anon/publishable key is needed here — verifying a
 * JWT's signature never requires a privileged key.
 */
let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient {
  authClient ??= createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, supabaseClientOptions);
  return authClient;
}

/**
 * Verifies the Supabase-issued JWT via supabase-js's getClaims() — Supabase's own
 * recommended verification path (see docs/03-ARCHITECTURE.md §7), not a hand-rolled
 * HS256 check: Supabase moved new projects to asymmetric (ES256/JWKS) signing keys
 * in 2025, so a static shared secret is no longer a reliable way to verify every
 * project's tokens. getClaims() handles both legacy HS256 and current asymmetric
 * keys transparently, fetching/caching the project's JWKS as needed.
 * This is defense layer 1 (AuthN + the user_id every service call scopes by);
 * Postgres RLS is defense layer 2 (see decision D16).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    // Fails closed rather than silently trusting an unverifiable token.
    res.status(500).json({ error: "Auth is not configured (SUPABASE_URL/SUPABASE_ANON_KEY missing)" });
    return;
  }

  const { data, error } = await getAuthClient().auth.getClaims(token);

  if (error || !data) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = { id: data.claims.sub, email: data.claims.email ?? "" };
  next();
}

/**
 * Must run after requireAuth. Queries the profiles table (not the JWT) for role,
 * since role is application state we own, not a Supabase auth claim.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const [profile] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, req.user.id)).limit(1);

  if (profile?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
