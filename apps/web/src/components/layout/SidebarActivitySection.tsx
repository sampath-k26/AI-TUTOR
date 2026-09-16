import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { useSidebarRefresh } from "../../lib/SidebarRefreshContext";
import type { ActivityCategory, ActivityItem, ActivityResult } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/skeleton";

const PAGE_SIZE = 10;

const TABS: Array<{ key: ActivityCategory; label: string }> = [
  { key: "projects", label: "Projects" },
  { key: "spaces", label: "Spaces" },
];

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

function describeActivity(item: ActivityItem): string {
  const label = item.type.replace(/_/g, " ");
  const name = (item.payload?.name as string | undefined) ?? item.projectName;
  return name ? `${label} — ${name}` : label;
}

export function SidebarActivitySection({ onNavigate }: { onNavigate: () => void }) {
  const [category, setCategory] = useState<ActivityCategory>("projects");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const { version } = useSidebarRefresh();

  useEffect(() => {
    setPage(0);
  }, [category]);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    apiClient
      .get<ActivityResult>(`/activity?category=${category}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then((res) => {
        if (!cancelled) setResult(res);
      });
    return () => {
      cancelled = true;
    };
  }, [category, page, version]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">Activity Log</p>

      <div className="flex gap-1 rounded-md bg-surface-2 p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategory(tab.key)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors",
              category === tab.key && "bg-surface-1 text-foreground shadow-sm",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        {result === null ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : result.activity.length === 0 ? (
          <p className="px-1 py-1.5 text-[12.5px] text-muted-foreground">No activity yet.</p>
        ) : (
          result.activity.map((item) => {
            const content = (
              <>
                <p className="truncate text-[12.5px] capitalize text-foreground">{describeActivity(item)}</p>
                <p className="text-[11px] text-subtle-foreground">{formatRelativeTime(item.createdAt)}</p>
              </>
            );
            return item.projectId ? (
              <Link
                key={item.id}
                to={`/projects/${item.projectId}`}
                onClick={onNavigate}
                className="rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
              >
                {content}
              </Link>
            ) : (
              <div key={item.id} className="rounded-md px-2 py-1.5">
                {content}
              </div>
            );
          })
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
