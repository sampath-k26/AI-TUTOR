import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { ProjectSearchResult, Space } from "../../lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

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

/**
 * All of the user's Projects across every Space — search, Space filter,
 * pagination. Lives as its own page (routed from the sidebar's "Projects"
 * link) rather than embedded in the sidebar itself, which was too cramped
 * for search/filter/pagination controls.
 */
export function ProjectsListPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ProjectSearchResult | null>(null);

  useEffect(() => {
    apiClient.get<{ spaces: Space[] }>("/spaces").then((res) => setSpaces(res.spaces));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, spaceId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (spaceId) params.set("spaceId", spaceId);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));

    let cancelled = false;
    apiClient.get<ProjectSearchResult>(`/projects?${params.toString()}`).then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, spaceId, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Projects</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="pl-9" />
        </div>
        <select
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          className="h-[38px] rounded-md border border-border bg-surface-2 px-3 text-[13.5px] text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 sm:w-56"
        >
          <option value="">All Spaces</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </div>

      {result === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      ) : result.projects.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No projects found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card interactive className="h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {result !== null && result.total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-[13px] text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
