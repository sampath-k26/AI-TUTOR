import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { useToast } from "../../lib/ToastContext";
import { useSidebarRefresh } from "../../lib/SidebarRefreshContext";
import type { Space } from "../../lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Sheet } from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";
import { HomeOverview } from "./HomeOverview";

function SpaceCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3.5 w-full" />
      </CardHeader>
    </Card>
  );
}

export function HomePage() {
  const { toast } = useToast();
  const { refreshSidebar } = useSidebarRefresh();
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
      setSheetOpen(false);
      toast({ variant: "success", title: "Space created", description: `"${res.space.name}" is ready.` });
      refreshSidebar();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create space";
      setError(message);
      toast({ variant: "error", title: "Couldn't create Space", description: message });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Your Spaces</h1>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create Space
        </Button>
      </div>

      <HomeOverview />

      {spaces === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SpaceCardSkeleton />
          <SpaceCardSkeleton />
          <SpaceCardSkeleton />
        </div>
      ) : spaces.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No Spaces yet — create your first one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <Link key={space.id} to={`/spaces/${space.id}`}>
              <Card interactive className="h-full">
                <CardHeader>
                  <CardTitle>{space.name}</CardTitle>
                  <CardDescription>{space.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Create a Space" description="A broad learning area to group related Projects.">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="space-name">Name</Label>
            <Input id="space-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
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
      </Sheet>
    </div>
  );
}
