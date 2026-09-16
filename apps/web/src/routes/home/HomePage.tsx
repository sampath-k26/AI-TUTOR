import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { supabase } from "../../lib/supabaseClient";
import type { Space } from "../../lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";

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
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Your Spaces</h1>
        <div className="flex items-center gap-2">
          <Link to="/analytics">
            <Button variant="outline" size="sm">
              Global Analytics
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
            Log out
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Create a Space</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="space-name">Name</Label>
              <Input id="space-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="space-description">Description</Label>
              <Textarea id="space-description" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
            <Button type="submit" disabled={creating} className="self-start">
              {creating ? "Creating…" : "Create Space"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {spaces === null ? (
        <p className="text-[13.5px] text-muted-foreground">Loading…</p>
      ) : spaces.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No Spaces yet — create your first one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {spaces.map((space) => (
            <Link key={space.id} to={`/spaces/${space.id}`}>
              <Card interactive>
                <CardHeader>
                  <CardTitle>{space.name}</CardTitle>
                  <CardDescription>{space.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

