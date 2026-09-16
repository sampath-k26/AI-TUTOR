import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { Project } from "../../lib/types";
import { cn } from "../../lib/utils";

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

  if (notFound) return <p className="text-[13.5px] text-muted-foreground">Project not found.</p>;
  if (!project) return <p className="text-[13.5px] text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`/spaces/${project.spaceId}`} className="text-[13px] text-primary hover:underline">
          &larr; Back to Space
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{project.name}</h1>
        <p className="text-[13.5px] text-muted-foreground">{project.description}</p>
        <p className="mt-1 text-[13.5px] text-foreground">
          <span className="font-medium">Learning goal:</span> {project.learningGoal}
        </p>
      </div>

      <nav className="flex gap-5 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 border-transparent pb-2 text-[13.5px] font-medium text-muted-foreground transition-colors",
                isActive && "border-primary text-foreground",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={project} />
    </div>
  );
}
