import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { AdminProject, AdminSpace } from "../../../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { TableSkeleton } from "../../../components/ui/table-skeleton";

export function SpacesProjectsTab() {
  const [spaces, setSpaces] = useState<AdminSpace[] | null>(null);
  const [projects, setProjects] = useState<AdminProject[] | null>(null);

  useEffect(() => {
    apiClient.get<{ spaces: AdminSpace[] }>("/admin/spaces").then((res) => setSpaces(res.spaces));
    apiClient.get<{ projects: AdminProject[] }>("/admin/projects").then((res) => setProjects(res.projects));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Spaces</h2>
        {!spaces ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : spaces.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No Spaces yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {spaces.map((space) => (
              <Card key={space.id}>
                <CardHeader>
                  <CardTitle>{space.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0 text-[13px] text-muted-foreground">
                  <span>{space.description}</span>
                  <span>
                    {space.ownerEmail} &middot; {new Date(space.createdAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Projects</h2>
        {!projects ? (
          <Card>
            <CardContent className="p-0">
              <TableSkeleton cols={5} />
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No Projects yet.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-[18px] py-2.5 font-medium">Name</th>
                    <th className="px-[18px] py-2.5 font-medium">Space</th>
                    <th className="px-[18px] py-2.5 font-medium">Owner</th>
                    <th className="px-[18px] py-2.5 font-medium">Status</th>
                    <th className="px-[18px] py-2.5 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b border-border last:border-0">
                      <td className="px-[18px] py-2.5 text-foreground">{project.name}</td>
                      <td className="px-[18px] py-2.5 text-muted-foreground">{project.spaceName}</td>
                      <td className="px-[18px] py-2.5 text-muted-foreground">{project.ownerEmail}</td>
                      <td className="px-[18px] py-2.5">
                        <Badge variant={project.status === "active" ? "success" : "secondary"}>{project.status}</Badge>
                      </td>
                      <td className="px-[18px] py-2.5 text-muted-foreground">{new Date(project.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
