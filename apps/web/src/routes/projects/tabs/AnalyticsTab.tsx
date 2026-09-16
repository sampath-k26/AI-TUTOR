import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { ProjectAnalytics } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

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

export function AnalyticsTab() {
  const project = useProjectContext();
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ analytics: ProjectAnalytics }>(`/projects/${project.id}/analytics`)
      .then((res) => setAnalytics(res.analytics))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"));
  }, [project.id]);

  if (error) return <p role="alert" className="text-[13px] text-destructive">{error}</p>;
  if (!analytics) return <p className="text-[13.5px] text-muted-foreground">Loading…</p>;

  const { assessmentStats, masterySummary, aiUsage, eventCounts } = analytics;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Assessment Performance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Quizzes taken" value={assessmentStats.totalQuizzes} />
          <StatCard label="Quizzes completed" value={assessmentStats.completedQuizzes} />
          <StatCard label="Questions answered" value={assessmentStats.totalQuestionsAnswered} />
          <StatCard
            label="Average score"
            value={assessmentStats.averageScore === null ? "—" : `${(assessmentStats.averageScore * 100).toFixed(0)}%`}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Mastery</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Concepts tracked" value={masterySummary.conceptCount} />
          <StatCard
            label="Average mastery"
            value={masterySummary.averageMastery === null ? "—" : `${masterySummary.averageMastery.toFixed(0)}%`}
          />
          <StatCard label="Improving" value={masterySummary.trendCounts.improving} />
          <StatCard label="Requires attention" value={masterySummary.trendCounts.requires_attention} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">AI Activity</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="AI calls" value={aiUsage.callCount} />
          <StatCard label="Successful" value={aiUsage.successCount} />
          <StatCard
            label="Avg latency"
            value={aiUsage.averageLatencyMs === null ? "—" : `${aiUsage.averageLatencyMs.toFixed(0)}ms`}
          />
          <StatCard label="Est. cost" value={`$${aiUsage.totalCostUsd.toFixed(4)}`} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Activity</h2>
        {eventCounts.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Event counts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {eventCounts.map((e) => (
                <div key={e.type} className="flex items-center justify-between text-[13.5px]">
                  <span className="text-muted-foreground">{e.type.replace(/_/g, " ")}</span>
                  <span className="font-medium text-foreground">{e.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
