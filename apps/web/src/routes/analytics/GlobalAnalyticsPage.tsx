import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { GlobalAnalytics } from "../../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

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
      <div>
        <Link to="/" className="text-[13px] text-primary hover:underline">
          &larr; Back to Spaces
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Global Analytics</h1>
      </div>

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      {!error && !analytics && <p className="text-[13.5px] text-muted-foreground">Loading…</p>}

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

          <div>
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">Activity across all Projects</h2>
            {analytics.eventCounts.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Event counts</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  {analytics.eventCounts.map((e) => (
                    <div key={e.type} className="flex items-center justify-between text-[13.5px]">
                      <span className="text-muted-foreground">{e.type.replace(/_/g, " ")}</span>
                      <span className="font-medium text-foreground">{e.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
