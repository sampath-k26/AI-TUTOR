import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { HomeOverview as HomeOverviewData } from "../../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";

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

  const { continueLearningProject, recentProjects, overallProgress, areasRequiringAttention, recommendedNextAction } = overview;

  if (!continueLearningProject && recentProjects.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {continueLearningProject && (
          <Link to={`/projects/${continueLearningProject.id}`}>
            <Card interactive className="h-full">
              <CardHeader>
                <CardTitle>Continue Learning</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[13.5px] font-medium text-foreground">{continueLearningProject.name}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{continueLearningProject.description}</p>
              </CardContent>
            </Card>
          </Link>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-foreground">
              {overallProgress.averageMastery === null ? "—" : `${overallProgress.averageMastery.toFixed(0)}%`}
            </p>
            <p className="text-[13px] text-muted-foreground">across {overallProgress.conceptCount} tracked concepts</p>
          </CardContent>
        </Card>

        {recommendedNextAction && (
          <Link to={`/projects/${recommendedNextAction.projectId}/growth`}>
            <Card interactive className="h-full">
              <CardHeader>
                <CardTitle>Recommended Next Action</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[13px] text-muted-foreground">{recommendedNextAction.projectName}</p>
                <p className="mt-1 text-[13.5px] text-foreground">{recommendedNextAction.text}</p>
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
                  <CardContent className="flex items-center justify-between pt-[18px]">
                    <div>
                      <p className="text-[13.5px] font-medium text-foreground">{concept.conceptName}</p>
                      <p className="text-[13px] text-muted-foreground">{concept.projectName}</p>
                    </div>
                    <Badge variant="warning">{concept.level.toFixed(0)}% mastery</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentProjects.length > 0 && (
        <div>
          <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">Recent Projects</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentProjects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card interactive>
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
