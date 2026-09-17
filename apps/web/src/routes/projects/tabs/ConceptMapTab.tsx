import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { ConceptMap, GrowthItem } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Skeleton } from "../../../components/ui/skeleton";
import { ConceptMapGraph } from "../../../components/charts/ConceptMapGraph";

export function ConceptMapTab() {
  const project = useProjectContext();
  const [conceptMap, setConceptMap] = useState<ConceptMap | null>(null);
  const [growth, setGrowth] = useState<GrowthItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ conceptMap: ConceptMap }>(`/projects/${project.id}/concept-map`)
      .then((res) => setConceptMap(res.conceptMap))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load concept map"));
    apiClient
      .get<{ growth: GrowthItem[] }>(`/projects/${project.id}/growth`)
      .then((res) => setGrowth(res.growth))
      .catch(() => setGrowth([]));
  }, [project.id]);

  if (error) return <p role="alert" className="text-[13px] text-destructive">{error}</p>;

  if (!conceptMap) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-[420px] w-full rounded-md" />
      </div>
    );
  }

  const trendByConceptId = new Map((growth ?? []).map((g) => [g.conceptId, g.trend]));
  const nodes = conceptMap.nodes.map((n) => ({ ...n, trend: trendByConceptId.get(n.id) }));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">Concept Map</h2>
        <p className="text-[13px] text-muted-foreground">
          Concepts that appear together in the same passage of a material are connected — a thicker line means they co-occur more often.
        </p>
      </div>
      <ConceptMapGraph
        nodes={nodes}
        edges={conceptMap.edges}
        emptyMessage="No concepts yet — upload and process a material to build the concept map."
      />
    </div>
  );
}
