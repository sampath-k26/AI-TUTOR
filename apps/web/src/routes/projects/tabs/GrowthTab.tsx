import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import { useToast } from "../../../lib/ToastContext";
import type { GrowthItem, Recommendation } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";

const TREND_VARIANT = {
  improving: "success",
  stable: "secondary",
  requires_attention: "warning",
} as const;

const TREND_LABEL = {
  improving: "Improving",
  stable: "Stable",
  requires_attention: "Requires attention",
} as const;

function RecommendationSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-[18px]">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-7 w-16 shrink-0" />
      </CardContent>
    </Card>
  );
}

function ConceptCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}

export function GrowthTab() {
  const project = useProjectContext();
  const { toast } = useToast();
  const [growth, setGrowth] = useState<GrowthItem[] | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ growth: GrowthItem[] }>(`/projects/${project.id}/growth`)
      .then((res) => setGrowth(res.growth))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load growth"));
    apiClient
      .get<{ recommendations: Recommendation[] }>(`/projects/${project.id}/recommendations`)
      .then((res) => setRecommendations(res.recommendations))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load recommendations"));
  }, [project.id]);

  async function handleDismiss(id: string) {
    setRecommendations((prev) => prev?.filter((r) => r.id !== id) ?? null);
    try {
      await apiClient.post(`/projects/${project.id}/recommendations/${id}/dismiss`);
      toast({ variant: "success", title: "Recommendation dismissed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to dismiss recommendation";
      setError(message);
      toast({ variant: "error", title: "Couldn't dismiss recommendation", description: message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Recommendations</h2>
        {recommendations === null ? (
          <div className="flex flex-col gap-2">
            <RecommendationSkeleton />
            <RecommendationSkeleton />
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">
            No active recommendations yet — complete a quiz to generate one.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {recommendations.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="flex items-start justify-between gap-4 pt-[18px]">
                  <p className="text-[13.5px] text-foreground">{rec.text}</p>
                  <Button variant="outline" size="sm" onClick={() => handleDismiss(rec.id)}>
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Mastery by Concept</h2>
        {growth === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ConceptCardSkeleton />
            <ConceptCardSkeleton />
          </div>
        ) : growth.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">
            No mastery data yet — take a quiz to start tracking growth.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {growth.map((item) => (
              <Card key={item.conceptId}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>{item.conceptName}</CardTitle>
                  <Badge variant={TREND_VARIANT[item.trend]}>{TREND_LABEL[item.trend]}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, item.level))}%` }} />
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{item.level.toFixed(0)}% mastery</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
