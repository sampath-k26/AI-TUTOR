import { getProjectForOwner, listAllProjects } from "../learning/service";
import * as repo from "./repository";

export async function getProjectAnalytics(projectId: string, ownerId: string) {
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return undefined;

  const [eventCounts, assessmentStats, masterySummary, aiUsage] = await Promise.all([
    repo.getProjectEventCounts(projectId),
    repo.getProjectAssessmentStats(projectId),
    repo.getProjectMasterySummary(projectId),
    repo.getProjectAiUsageSummary(projectId),
  ]);

  return { eventCounts, assessmentStats, masterySummary, aiUsage };
}

export async function getGlobalAnalytics(ownerId: string) {
  const ownedProjects = await listAllProjects(ownerId);
  const projectIds = ownedProjects.map((p) => p.id);

  const [eventCounts, masterySummary, materialCount, quizStats] = await Promise.all([
    repo.getGlobalEventCounts(ownerId),
    repo.getGlobalMasterySummary(ownerId),
    repo.getGlobalMaterialCount(ownerId),
    repo.getGlobalQuizStats(projectIds),
  ]);

  return {
    projectCount: ownedProjects.length,
    materialCount,
    eventCounts,
    masterySummary,
    quizStats,
  };
}
