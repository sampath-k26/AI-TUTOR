import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { HomeOverview as HomeOverviewData } from "../../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { IconTile } from "../../components/ui/icon-tile";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";

function masteryVariant(level: number): "success" | "warning" | "destructive" {
  if (level >= 70) return "success";
  if (level >= 40) return "warning";
  return "destructive";
}

/**
 * "Continue Learning / Recent Projects / overall progress / areas requiring
 * attention / recommended next action" (docs/01-REQUIREMENTS-MAP.md §3) — the
 * M5 User Home widgets, backed by GET /home (analytics/service.ts).
 */
export function HomeOverview() {
  const [overview, setOverview] = useState<HomeOverviewData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ home: HomeOverviewData }>("/home")
      .then((res) => setOverview(res.home))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!overview) return null;

  const { continueLearningProject, overallProgress, areasRequiringAttention, recommendedNextAction } = overview;

  // continueLearningProject is only unset when the user owns no Projects at all
  // (see analytics/service.ts's getHomeOverview) — nothing else here is worth
  // showing on its own in that case.
  if (!continueLearningProject) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {continueLearningProject && (
          <Link to={`/projects/${continueLearningProject.id}`}>
            <Card interactive className="h-full">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-[13px] font-medium text-muted-foreground">Continue Learning</CardTitle>
                </div>
                <IconTile icon={ArrowRight} variant="primary" />
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[14.5px] font-semibold text-foreground">{continueLearningProject.name}</p>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{continueLearningProject.description}</p>
              </CardContent>
            </Card>
          </Link>
        )}

        <Card className="h-full">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <CardTitle className="text-[13px] font-medium text-muted-foreground">Overall Progress</CardTitle>
            <IconTile icon={TrendingUp} variant="success" />
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {overallProgress.averageMastery === null ? "—" : `${overallProgress.averageMastery.toFixed(0)}%`}
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">across {overallProgress.conceptCount} tracked concepts</p>
            {overallProgress.averageMastery !== null && (
              <Progress value={overallProgress.averageMastery} variant="success" className="mt-3" />
            )}
          </CardContent>
        </Card>

        {recommendedNextAction && (
          <Link to={`/projects/${recommendedNextAction.projectId}/growth`}>
            <Card interactive className="h-full">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">Recommended Next Action</CardTitle>
                <IconTile icon={Sparkles} variant="warning" />
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[13px] font-medium text-foreground">{recommendedNextAction.projectName}</p>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{recommendedNextAction.text}</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {areasRequiringAttention.length > 0 && (
        <div>
          <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">Areas Requiring Attention</h2>
          <div className="flex flex-col gap-2">
            {areasRequiringAttention.map((concept) => (
              <Link key={concept.conceptId} to={`/projects/${concept.projectId}/growth`}>
                <Card interactive>
                  <CardContent className="flex items-center gap-4 pt-[18px]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-foreground">{concept.conceptName}</p>
                      <p className="text-[13px] text-muted-foreground">{concept.projectName}</p>
                    </div>
                    <div className="flex w-28 shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[12.5px] font-medium tabular-nums text-muted-foreground">{concept.level.toFixed(0)}%</span>
                      <Progress value={concept.level} variant={masteryVariant(concept.level)} className="w-full" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
