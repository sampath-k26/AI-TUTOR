import { ChevronLeft, ChevronRight, FolderKanban, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { useSidebarRefresh } from "../../lib/SidebarRefreshContext";
import type { ProjectSearchResult, Space } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export function SidebarProjectsSection({ onNavigate }: { onNavigate: () => void }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ProjectSearchResult | null>(null);
  const { version } = useSidebarRefresh();

  useEffect(() => {
    apiClient.get<{ spaces: Space[] }>("/spaces").then((res) => setSpaces(res.spaces));
  }, [version]);

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
  }, [debouncedQuery, spaceId, page, version]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">Projects</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          className="h-7 pl-7 text-[12.5px]"
        />
      </div>

      <select
        value={spaceId}
        onChange={(e) => setSpaceId(e.target.value)}
        className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[12.5px] text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
      >
        <option value="">All Spaces</option>
        {spaces.map((space) => (
          <option key={space.id} value={space.id}>
            {space.name}
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-0.5">
        {result === null ? (
          <>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </>
        ) : result.projects.length === 0 ? (
          <p className="px-1 py-1.5 text-[12.5px] text-muted-foreground">No projects found.</p>
        ) : (
          result.projects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
                  isActive && "bg-surface-2 text-foreground",
                )
              }
              title={project.name}
            >
              <FolderKanban className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{project.name}</span>
            </NavLink>
          ))
        )}
      </div>

      {result !== null && result.total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1 pt-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-subtle-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
