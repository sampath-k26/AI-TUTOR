import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { apiClient } from "../lib/apiClient";
import { ProfileContext } from "../lib/ProfileContext";
import type { Profile } from "../lib/types";

/**
 * Gates authenticated routes and bootstraps the profiles row for a first-time
 * user (see docs/02-DECISIONS-LOG.md — profiles.id = Supabase auth user id,
 * created on first authenticated request rather than via a DB trigger, so it
 * works the same way against local Postgres and against real Supabase).
 * Also fetches the profile once here and exposes it via ProfileContext so
 * role-gated UI (e.g. the Admin Dashboard link) doesn't need its own fetch.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (session) {
      apiClient
        .get<{ profile: Profile }>("/me")
        .then((res) => setProfile(res.profile))
        .catch(() => {})
        .finally(() => setProfileReady(true)); // don't hard-block the UI on a transient profile-sync failure
    }
  }, [session]);

  if (loading) return <p>Loading…</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profileReady) return <p>Loading…</p>;

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}
