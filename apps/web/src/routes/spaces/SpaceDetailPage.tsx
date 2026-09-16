import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { Project, Space } from "../../lib/types";

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [data, setData] = useState<{ space: Space; projects: Project[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!spaceId) return;
    apiClient
      .get<{ space: Space; projects: Project[] }>(`/spaces/${spaceId}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [spaceId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!spaceId) return;
    setError(null);
    setCreating(true);
    try {
      const res = await apiClient.post<{ project: Project }>(`/spaces/${spaceId}/projects`, {
        name,
        description,
        learningGoal,
      });
      setData((prev) => (prev ? { ...prev, projects: [res.project, ...prev.projects] } : prev));
      setName("");
      setDescription("");
      setLearningGoal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  if (notFound) return <p>Space not found.</p>;
  if (!data) return <p>Loading…</p>;

  return (
    <div className="space-detail-page">
      <p>
        <Link to="/">&larr; Your Spaces</Link>
      </p>
      <h1>{data.space.name}</h1>
      <p>{data.space.description}</p>

      <form onSubmit={handleCreate}>
        <h2>Create a Project</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        <label>
          Learning goal
          <textarea value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create Project"}
        </button>
      </form>

      <h2>Projects</h2>
      {data.projects.length === 0 ? (
        <p>No Projects yet — create your first one above.</p>
      ) : (
        <ul>
          {data.projects.map((project) => (
            <li key={project.id}>
              <Link to={`/projects/${project.id}`}>{project.name}</Link>
              <p>{project.learningGoal}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
