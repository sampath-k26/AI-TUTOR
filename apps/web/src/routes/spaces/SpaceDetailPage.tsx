import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { Project, Space } from "../../lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [data, setData] = useState<{ space: Space; projects: Project[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!spaceId) return;
    apiClient
      .get<{ space: Space; projects: Project[] }>(`/spaces/${spaceId}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [spaceId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!spaceId) return;
    setError(null);
    setCreating(true);
    try {
      const res = await apiClient.post<{ project: Project }>(`/spaces/${spaceId}/projects`, {
        name,
        description,
        learningGoal,
      });
      setData((prev) => (prev ? { ...prev, projects: [res.project, ...prev.projects] } : prev));
      setName("");
      setDescription("");
      setLearningGoal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  if (notFound) return <p className="text-[13.5px] text-muted-foreground">Space not found.</p>;
  if (!data) return <p className="text-[13.5px] text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/" className="text-[13px] text-primary hover:underline">
          &larr; Your Spaces
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{data.space.name}</h1>
        <p className="text-[13.5px] text-muted-foreground">{data.space.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-goal">Learning goal</Label>
              <Textarea id="project-goal" value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} required />
            </div>
            {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
            <Button type="submit" disabled={creating} className="self-start">
              {creating ? "Creating…" : "Create Project"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Projects</h2>
        {data.projects.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No Projects yet — create your first one above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card interactive>
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.learningGoal}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
