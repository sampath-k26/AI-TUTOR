import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { Material } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";

const POLL_INTERVAL_MS = 4000;

export function MaterialsTab() {
  const project = useProjectContext();
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    apiClient.get<{ materials: Material[] }>(`/projects/${project.id}/materials`).then((res) => setMaterials(res.materials));
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is still queued/processing — materials process in the
  // background (PRD §5), so the user shouldn't need to manually refresh.
  useEffect(() => {
    if (!materials?.some((m) => m.status === "queued" || m.status === "processing")) return;
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [materials, load]);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.postForm<{ material: Material }>(`/projects/${project.id}/materials`, formData);
      setMaterials((prev) => [res.material, ...(prev ?? [])]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="materials-tab">
      <h2>Materials</h2>
      <div>
        <input ref={fileInputRef} type="file" accept="application/pdf" />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}

      {materials === null ? (
        <p>Loading…</p>
      ) : materials.length === 0 ? (
        <p>No materials yet — upload a PDF to get started.</p>
      ) : (
        <ul>
          {materials.map((m) => (
            <li key={m.id}>
              {m.originalFilename} — <StatusBadge status={m.status} />
              {m.status === "failed" && m.errorDetail && <span> ({m.errorDetail})</span>}
              {m.status === "ready" && m.pageCount != null && <span> · {m.pageCount} pages</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Material["status"] }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}
