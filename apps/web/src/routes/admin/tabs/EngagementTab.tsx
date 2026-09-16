import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { AdminEngagement, AdminLearningAnalytics } from "../../../lib/types";
import { Card, CardContent } from "../../../components/ui/card";

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

export function EngagementTab() {
  const [engagement, setEngagement] = useState<AdminEngagement | null>(null);
  const [learning, setLearning] = useState<AdminLearningAnalytics | null>(null);

  useEffect(() => {
    apiClient.get<{ engagement: AdminEngagement }>("/admin/engagement").then((res) => setEngagement(res.engagement));
    apiClient.get<{ learningAnalytics: AdminLearningAnalytics }>("/admin/learning-analytics").then((res) => setLearning(res.learningAnalytics));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Engagement</h2>
        {!engagement ? (
          <p className="text-[13.5px] text-muted-foreground">Loading…</p>
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
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Platform Learning Analytics</h2>
        {!learning ? (
          <p className="text-[13.5px] text-muted-foreground">Loading…</p>
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
