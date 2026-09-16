import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { profiles } from "../../db/schema";

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

interface SupabaseAccessTokenClaims {
  sub: string;
  email?: string;
}

/**
 * Verifies the Supabase-issued JWT locally (HS256, project JWT secret) rather than
 * calling Supabase's Auth API per request — see docs/03-ARCHITECTURE.md §7.
 * This is defense layer 1 (AuthN + the user_id every service call scopes by);
 * Postgres RLS is defense layer 2 (see decision D16).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);

  if (!config.SUPABASE_JWT_SECRET) {
    // Fails closed rather than silently trusting an unverifiable token.
    res.status(500).json({ error: "Auth is not configured (SUPABASE_JWT_SECRET missing)" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.SUPABASE_JWT_SECRET) as SupabaseAccessTokenClaims;
    req.user = { id: decoded.sub, email: decoded.email ?? "" };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
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
