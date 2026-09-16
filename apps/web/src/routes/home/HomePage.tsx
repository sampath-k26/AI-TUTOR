import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { supabase } from "../../lib/supabaseClient";
import type { Space } from "../../lib/types";

/**
 * M0 scope: list/create Spaces. "Continue Learning / overall progress / areas
 * requiring attention / recommended next action" widgets are added in M5
 * once Projects/Quiz/Mastery/Recommendations exist to populate them (see
 * docs/06-IMPLEMENTATION-PLAN.md) — not stubbed here to avoid a dashboard
 * that silently lies about having no data.
 */
export function HomePage() {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient.get<{ spaces: Space[] }>("/spaces").then((res) => setSpaces(res.spaces));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await apiClient.post<{ space: Space }>("/spaces", { name, description });
      setSpaces((prev) => [res.space, ...(prev ?? [])]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create space");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="home-page">
      <header>
        <h1>Your Spaces</h1>
        <button onClick={() => supabase.auth.signOut()}>Log out</button>
      </header>

      <form onSubmit={handleCreate}>
        <h2>Create a Space</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create Space"}
        </button>
      </form>

      {spaces === null ? (
        <p>Loading…</p>
      ) : spaces.length === 0 ? (
        <p>No Spaces yet — create your first one above.</p>
      ) : (
        <ul>
          {spaces.map((space) => (
            <li key={space.id}>
              <Link to={`/spaces/${space.id}`}>{space.name}</Link>
              <p>{space.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
