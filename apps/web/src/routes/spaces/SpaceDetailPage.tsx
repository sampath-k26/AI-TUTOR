import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { useToast } from "../../lib/ToastContext";
import type { Project, Space } from "../../lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Sheet } from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3.5 w-full" />
      </CardHeader>
    </Card>
  );
}

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<{ space: Space; projects: Project[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!spaceId) return;
    // Reset both at the start of each fetch — otherwise navigating from an
    // invalid id straight to a valid one left `notFound` stuck true forever
    // (found via code audit), and stale previous space/projects would flash
    // while the new one loads.
    setNotFound(false);
    setData(null);
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
      setSheetOpen(false);
      toast({ variant: "success", title: "Project created", description: `"${res.project.name}" is ready.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
      toast({ variant: "error", title: "Couldn't create Project", description: message });
    } finally {
      setCreating(false);
    }
  }

  if (notFound) return <p className="text-[13.5px] text-muted-foreground">Space not found.</p>;

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-1/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/" className="text-[13px] text-primary hover:underline">
          &larr; Your Spaces
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{data.space.name}</h1>
        <p className="text-[13.5px] text-muted-foreground">{data.space.description}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Projects</h2>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      </div>

      {data.projects.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No Projects yet — create your first one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card interactive className="h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.learningGoal}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Create a Project"
        description="A focused learning journey inside this Space."
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
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
      </Sheet>
    </div>
  );
}
