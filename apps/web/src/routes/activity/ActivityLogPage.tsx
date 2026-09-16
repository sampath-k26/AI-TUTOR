import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { ActivityCategory, ActivityItem, ActivityResult } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";

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

/**
 * The user's own activity (not the Admin Dashboard's platform-wide view) —
 * Project-scoped events (materials, Tutor, quizzes, mastery, recommendations)
 * and Space-lifecycle events, in separate tabs. Routed from the sidebar's
 * "Activity Log" link rather than embedded in the sidebar itself.
 */
export function ActivityLogPage() {
  const [category, setCategory] = useState<ActivityCategory>("projects");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ActivityResult | null>(null);

  useEffect(() => {
    setPage(0);
  }, [category]);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    apiClient.get<ActivityResult>(`/activity?category=${category}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`).then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [category, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Activity Log</h1>

      <div className="flex gap-1 self-start rounded-md bg-surface-2 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategory(tab.key)}
            className={cn(
              "rounded-sm px-4 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors",
              category === tab.key && "bg-surface-1 text-foreground shadow-sm",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {result === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : result.activity.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {result.activity.map((item) => {
            const inner = (
              <CardContent className="flex items-center justify-between gap-4 pt-[18px]">
                <p className="capitalize text-[13.5px] text-foreground">{describeActivity(item)}</p>
                <p className="shrink-0 text-[12.5px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
              </CardContent>
            );
            return item.projectId ? (
              <Link key={item.id} to={`/projects/${item.projectId}`}>
                <Card interactive>{inner}</Card>
              </Link>
            ) : (
              <Card key={item.id}>{inner}</Card>
            );
          })}
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
