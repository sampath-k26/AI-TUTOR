import { useEffect, useState } from "react";
import { apiClient } from "../../lib/apiClient";
import type { GlobalAnalytics } from "../../lib/types";
import { Card, CardContent } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-[18px]">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-[18px]">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="mt-2 h-7 w-12" />
      </CardContent>
    </Card>
  );
}

export function GlobalAnalyticsPage() {
  const [analytics, setAnalytics] = useState<GlobalAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ analytics: GlobalAnalytics }>("/analytics")
      .then((res) => setAnalytics(res.analytics))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Global Analytics</h1>

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {!error && !analytics && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </>
      )}

      {analytics && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Projects" value={analytics.projectCount} />
            <StatCard label="Materials" value={analytics.materialCount} />
            <StatCard label="Quizzes taken" value={analytics.quizStats.totalQuizzes} />
            <StatCard label="Quizzes completed" value={analytics.quizStats.completedQuizzes} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Concepts tracked" value={analytics.masterySummary.conceptCount} />
            <StatCard
              label="Average mastery"
              value={analytics.masterySummary.averageMastery === null ? "—" : `${analytics.masterySummary.averageMastery.toFixed(0)}%`}
            />
          </div>
        </>
      )}
    </div>
  );
}
