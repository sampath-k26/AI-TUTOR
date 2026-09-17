import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import { useToast } from "../../../lib/ToastContext";
import type { GrowthItem, LearningPlan, LearningPlanStep, Material } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Checkbox } from "../../../components/ui/checkbox";
import { Skeleton } from "../../../components/ui/skeleton";

const TYPE_LABEL: Record<LearningPlanStep["type"], string> = {
  material: "Material",
  tutor: "Tutor",
  quiz: "Quiz",
  other: "Other",
};

function StepCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-[18px]">
        <Skeleton className="h-4 w-4 shrink-0 rounded" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

export function LearningPlanTab() {
  const project = useProjectContext();
  const { toast } = useToast();
  const [plan, setPlan] = useState<LearningPlan | null | undefined>(undefined);
  const [steps, setSteps] = useState<LearningPlanStep[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [growth, setGrowth] = useState<GrowthItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ plan: LearningPlan | null; steps: LearningPlanStep[] }>(`/projects/${project.id}/learning-plan`)
      .then((res) => {
        setPlan(res.plan);
        setSteps(res.steps);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load learning plan"));
    apiClient.get<{ materials: Material[] }>(`/projects/${project.id}/materials`).then((res) => setMaterials(res.materials));
    apiClient.get<{ growth: GrowthItem[] }>(`/projects/${project.id}/growth`).then((res) => setGrowth(res.growth));
  }, [project.id]);

  const materialNameById = new Map(materials.map((m) => [m.id, m.originalFilename]));
  const conceptNameById = new Map(growth.map((g) => [g.conceptId, g.conceptName]));

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post<{ plan: LearningPlan; steps: LearningPlanStep[] }>(`/projects/${project.id}/learning-plan/generate`);
      const wasRegenerate = plan != null;
      setPlan(res.plan);
      setSteps(res.steps);
      toast({ variant: "success", title: wasRegenerate ? "Plan regenerated" : "Plan generated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate plan";
      setError(message);
      toast({ variant: "error", title: "Couldn't generate plan", description: message });
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleStep(stepId: string, completed: boolean) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, completed } : s)));
    try {
      await apiClient.post(`/projects/${project.id}/learning-plan/steps/${stepId}`, { completed });
    } catch (err) {
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, completed: !completed } : s)));
      const message = err instanceof Error ? err.message : "Failed to update step";
      toast({ variant: "error", title: "Couldn't update step", description: message });
    }
  }

  const loading = plan === undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Learning Plan</h2>
          <p className="text-[13px] text-muted-foreground">An ordered checklist of concrete next steps toward your learning goal.</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating || loading} size="sm">
          {generating ? "Generating…" : plan ? "Regenerate" : "Generate Plan"}
        </Button>
      </div>

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          <StepCardSkeleton />
          <StepCardSkeleton />
          <StepCardSkeleton />
        </div>
      ) : steps.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No plan yet — generate one to get a concrete list of next steps.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {steps.map((step) => {
            const reference = step.relatedMaterialId
              ? materialNameById.get(step.relatedMaterialId)
              : step.relatedConceptId
                ? conceptNameById.get(step.relatedConceptId)
                : undefined;
            return (
              <Card key={step.id}>
                <CardContent className="flex items-start gap-3 pt-[18px]">
                  <Checkbox
                    checked={step.completed}
                    onCheckedChange={(checked) => handleToggleStep(step.id, checked)}
                    className="mt-0.5"
                    aria-label={step.description}
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{TYPE_LABEL[step.type]}</Badge>
                      {reference && <span className="text-[12px] text-muted-foreground">{reference}</span>}
                    </div>
                    <p className={step.completed ? "text-[13.5px] text-muted-foreground line-through" : "text-[13.5px] text-foreground"}>
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
