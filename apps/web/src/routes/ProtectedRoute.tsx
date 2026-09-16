import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { apiClient } from "../lib/apiClient";

/**
 * Gates authenticated routes and bootstraps the profiles row for a first-time
 * user (see docs/02-DECISIONS-LOG.md — profiles.id = Supabase auth user id,
 * created on first authenticated request rather than via a DB trigger, so it
 * works the same way against local Postgres and against real Supabase).
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (session) {
      apiClient
        .get("/me")
        .then(() => setProfileReady(true))
        .catch(() => setProfileReady(true)); // don't hard-block the UI on a transient profile-sync failure
    }
  }, [session]);

  if (loading) return <p>Loading…</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profileReady) return <p>Loading…</p>;

  return <>{children}</>;
}
