import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { Material } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="text-[13px] text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-1 file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground"
        />
        <Button onClick={handleUpload} disabled={uploading} size="sm">
          {uploading ? "Uploading…" : "Upload PDF"}
        </Button>
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {materials === null ? (
        <p className="text-[13.5px] text-muted-foreground">Loading…</p>
      ) : materials.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No materials yet — upload a PDF to get started.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-2 pt-[18px] text-[13.5px]">
                <span className="text-foreground">{m.originalFilename}</span>
                <StatusBadge status={m.status} />
                {m.status === "failed" && m.errorDetail && <span className="text-muted-foreground">({m.errorDetail})</span>}
                {m.status === "ready" && m.pageCount != null && <span className="text-muted-foreground">· {m.pageCount} pages</span>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Material["status"] }) {
  const variant = status === "ready" ? "success" : status === "failed" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
