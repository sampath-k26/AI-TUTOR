import { FileText, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import { useToast } from "../../../lib/ToastContext";
import type { Material } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { IconTile } from "../../../components/ui/icon-tile";
import { Skeleton } from "../../../components/ui/skeleton";

const POLL_INTERVAL_MS = 4000;

function MaterialCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 pt-[18px]">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
      </CardContent>
    </Card>
  );
}

export function MaterialsTab() {
  const project = useProjectContext();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
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
      setSelectedFileName(null);
      toast({ variant: "success", title: "Material uploaded", description: `"${res.material.originalFilename}" is processing.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast({ variant: "error", title: "Upload failed", description: message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor="material-upload-input"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-2/50 px-6 py-8 text-center transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <IconTile icon={UploadCloud} className="h-10 w-10 [&>svg]:h-5 [&>svg]:w-5" />
        <p className="text-[13.5px] font-medium text-foreground">{selectedFileName ?? "Click to choose a PDF"}</p>
        <p className="text-[12.5px] text-muted-foreground">PDF materials only — processed and chunked automatically</p>
        <input
          id="material-upload-input"
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <Button onClick={handleUpload} disabled={uploading || !selectedFileName} size="sm" className="self-start gap-1.5">
        <UploadCloud className="h-4 w-4" />
        {uploading ? "Uploading…" : "Upload PDF"}
      </Button>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {materials === null ? (
        <div className="flex flex-col gap-2">
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
        </div>
      ) : materials.length === 0 ? (
        <EmptyState icon={FileText} title="No materials yet" description="Upload a PDF above to get started." />
      ) : (
        <div className="flex flex-col gap-2">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-3 pt-[18px] text-[13.5px]">
                <IconTile icon={FileText} variant="muted" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground">{m.originalFilename}</span>
                  {m.status === "failed" && m.errorDetail && <span className="text-[12.5px] text-muted-foreground">{m.errorDetail}</span>}
                  {m.status === "ready" && m.pageCount != null && (
                    <span className="text-[12.5px] text-muted-foreground">{m.pageCount} pages</span>
                  )}
                </div>
                <StatusBadge status={m.status} />
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
