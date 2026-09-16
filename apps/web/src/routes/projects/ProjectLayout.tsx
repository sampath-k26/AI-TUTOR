import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { Project } from "../../lib/types";

export function useProjectContext() {
  return useOutletContext<Project>();
}

const TABS = [
  { to: "materials", label: "Materials" },
  { to: "tutor", label: "Tutor" },
  { to: "quiz", label: "Quiz" },
];

export function ProjectLayout() {
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
    <div className="project-layout">
      <p>
        <Link to={`/spaces/${project.spaceId}`}>&larr; Back to Space</Link>
      </p>
      <h1>{project.name}</h1>
      <p>{project.description}</p>
      <p>
        <strong>Learning goal:</strong> {project.learningGoal}
      </p>

      <nav className="project-tabs">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={project} />
    </div>
  );
}
