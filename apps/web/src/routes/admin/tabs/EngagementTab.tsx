import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { AdminEngagement, AdminLearningAnalytics, EngagementHistoryPoint } from "../../../lib/types";
import { Card, CardContent } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { LineChart } from "../../../components/charts/LineChart";

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

export function EngagementTab() {
  const [engagement, setEngagement] = useState<AdminEngagement | null>(null);
  const [learning, setLearning] = useState<AdminLearningAnalytics | null>(null);
  const [engagementHistory, setEngagementHistory] = useState<EngagementHistoryPoint[] | null>(null);

  useEffect(() => {
    apiClient.get<{ engagement: AdminEngagement }>("/admin/engagement").then((res) => setEngagement(res.engagement));
    apiClient.get<{ learningAnalytics: AdminLearningAnalytics }>("/admin/learning-analytics").then((res) => setLearning(res.learningAnalytics));
    apiClient.get<{ history: EngagementHistoryPoint[] }>("/admin/engagement-history").then((res) => setEngagementHistory(res.history));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Engagement</h2>
        {!engagement ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total users" value={engagement.totalUsers} />
            <StatCard label="Active (24h)" value={engagement.activeUsersLast24h} />
            <StatCard label="Active (7d)" value={engagement.activeUsersLast7d} />
            <StatCard label="Active (30d)" value={engagement.activeUsersLast30d} />
            <StatCard label="Total Spaces" value={engagement.totalSpaces} />
            <StatCard label="Total Projects" value={engagement.totalProjects} />
          </div>
        )}
        <div className="mt-3">
          {engagementHistory === null ? (
            <Skeleton className="h-[200px] w-full rounded-md" />
          ) : (
            <LineChart
              series={[{ id: "active-users", label: "Active users per day", points: engagementHistory.map((p) => ({ x: p.date, y: p.activeUsers })) }]}
              emptyMessage="No engagement history yet."
            />
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Platform Learning Analytics</h2>
        {!learning ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Concepts tracked" value={learning.conceptCount} />
            <StatCard label="Average mastery" value={learning.averageMastery === null ? "—" : `${learning.averageMastery.toFixed(0)}%`} />
            <StatCard label="Materials processed" value={learning.totalMaterials} />
            <StatCard label="Quizzes taken" value={learning.totalQuizzes} />
            <StatCard label="Quizzes completed" value={learning.completedQuizzes} />
          </div>
        )}
      </div>
    </div>
  );
}
