import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { AdminAiEvaluation, AdminAiUsage, AdminBackgroundJobs, AdminSystemHealth } from "../../../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-[18px]">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-[18px]">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="mt-2 h-7 w-12" />
      </CardContent>
    </Card>
  );
}

const STATUS_VARIANT = { ok: "success", stale: "warning", degraded: "warning" } as const;

export function AiSystemTab() {
  const [aiUsage, setAiUsage] = useState<AdminAiUsage | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<AdminAiEvaluation | null>(null);
  const [backgroundJobs, setBackgroundJobs] = useState<AdminBackgroundJobs | null>(null);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);

  useEffect(() => {
    apiClient.get<{ aiUsage: AdminAiUsage }>("/admin/ai-usage").then((res) => setAiUsage(res.aiUsage));
    apiClient.get<{ aiEvaluation: AdminAiEvaluation }>("/admin/ai-evaluation").then((res) => setAiEvaluation(res.aiEvaluation));
    apiClient.get<{ backgroundJobs: AdminBackgroundJobs }>("/admin/background-jobs").then((res) => setBackgroundJobs(res.backgroundJobs));
    apiClient.get<{ systemHealth: AdminSystemHealth }>("/admin/system-health").then((res) => setSystemHealth(res.systemHealth));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">System Health</h2>
        {!systemHealth ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center justify-between pt-[18px]">
                <span className="text-[13.5px] text-foreground">Database</span>
                <Badge variant="success">{systemHealth.database}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between pt-[18px]">
                <span className="text-[13.5px] text-foreground">Background worker</span>
                <Badge variant={STATUS_VARIANT[systemHealth.worker.status]}>{systemHealth.worker.status}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between pt-[18px]">
                <span className="text-[13.5px] text-foreground">AI providers</span>
                <Badge variant={STATUS_VARIANT[systemHealth.aiProviders.status]}>{systemHealth.aiProviders.status}</Badge>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">AI Usage</h2>
        {!aiUsage ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total calls" value={aiUsage.callCount} />
              <StatCard label="Successful" value={aiUsage.successCount} />
              <StatCard label="Avg latency" value={aiUsage.averageLatencyMs === null ? "—" : `${aiUsage.averageLatencyMs.toFixed(0)}ms`} />
              <StatCard label="Est. cost" value={`$${aiUsage.totalCostUsd.toFixed(4)}`} />
            </div>
            {aiUsage.byProvider.length > 0 && (
              <Card className="mt-3">
                <CardContent className="p-0">
                  <table className="w-full text-[13.5px]">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="px-[18px] py-2.5 font-medium">Provider</th>
                        <th className="px-[18px] py-2.5 font-medium">Feature</th>
                        <th className="px-[18px] py-2.5 font-medium">Calls</th>
                        <th className="px-[18px] py-2.5 font-medium">Successful</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.byProvider.map((row) => (
                        <tr key={`${row.provider}-${row.feature}`} className="border-b border-border last:border-0">
                          <td className="px-[18px] py-2.5 text-foreground">{row.provider}</td>
                          <td className="px-[18px] py-2.5 text-muted-foreground">{row.feature}</td>
                          <td className="px-[18px] py-2.5 text-muted-foreground">{row.callCount}</td>
                          <td className="px-[18px] py-2.5 text-muted-foreground">{row.successCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">AI Evaluation</h2>
        {!aiEvaluation ? (
          <Skeleton className="h-20 w-full" />
        ) : aiEvaluation.bySuite.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No evaluation runs yet.</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Last run: {aiEvaluation.lastRunAt ? new Date(aiEvaluation.lastRunAt).toLocaleString() : "—"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {aiEvaluation.bySuite.map((row) => (
                <div key={`${row.suite}-${row.verdict}`} className="flex items-center justify-between text-[13.5px]">
                  <span className="text-foreground">
                    {row.suite} — {row.verdict}
                  </span>
                  <span className="text-muted-foreground">
                    {row.count} case{row.count === 1 ? "" : "s"}
                    {row.averageScore !== null && ` · avg score ${row.averageScore.toFixed(2)}`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Background Processing</h2>
        {!backgroundJobs ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-1.5 pt-[18px]">
                {backgroundJobs.queueCounts.length === 0 ? (
                  <p className="text-[13.5px] text-muted-foreground">No jobs have run yet.</p>
                ) : (
                  backgroundJobs.queueCounts.map((row) => (
                    <div key={`${row.queue}-${row.state}`} className="flex items-center justify-between text-[13.5px]">
                      <span className="text-foreground">
                        {row.queue} — {row.state}
                      </span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            {backgroundJobs.recentFailedJobs.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Recent failed jobs</h3>
                <div className="flex flex-col gap-2">
                  {backgroundJobs.recentFailedJobs.map((job) => (
                    <Card key={job.id}>
                      <CardContent className="pt-[18px] text-[13px]">
                        <p className="text-foreground">{job.queue}</p>
                        <p className="text-muted-foreground">{job.completedOn ? new Date(job.completedOn).toLocaleString() : "—"}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
