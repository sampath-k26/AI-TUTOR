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

export async function getHomeOverview(ownerId: string) {
  const [ownedProjects, overallProgress, areasRequiringAttention, recommendedNextAction, activeProjectId] = await Promise.all([
    listAllProjects(ownerId),
    repo.getGlobalMasterySummary(ownerId),
    repo.getConceptsRequiringAttention(ownerId),
    repo.getMostRecentActiveRecommendation(ownerId),
    repo.getRecentlyActiveProjectId(ownerId),
  ]);

  const continueLearningProject = ownedProjects.find((p) => p.id === activeProjectId) ?? ownedProjects[0] ?? null;

  return {
    recentProjects: ownedProjects.slice(0, 5),
    continueLearningProject,
    overallProgress,
    areasRequiringAttention,
    recommendedNextAction,
  };
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
