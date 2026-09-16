import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { Project } from "../../lib/types";

/**
 * M0 scope: confirm a Project is reachable and shows its own data (loop exit
 * check in docs/06-IMPLEMENTATION-PLAN.md M0). Materials/Tutor/Quiz/Growth/
 * Analytics tabs are added in M1-M4 as each becomes real, rather than
 * stubbing empty tab shells now.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    apiClient
      .get<{ project: Project }>(`/projects/${projectId}`)
      .then((res) => setProject(res.project))
      .catch(() => setNotFound(true));
  }, [projectId]);

  if (notFound) return <p>Project not found.</p>;
  if (!project) return <p>Loading…</p>;

  return (
    <div className="project-detail-page">
      <p>
        <Link to={`/spaces/${project.spaceId}`}>&larr; Back to Space</Link>
      </p>
      <h1>{project.name}</h1>
      <p>{project.description}</p>
      <p>
        <strong>Learning goal:</strong> {project.learningGoal}
      </p>
    </div>
  );
}
