import { useEffect, useState, type FormEvent } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { AdminActivityEvent } from "../../../lib/types";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";

export function ActivityTab() {
  const [activity, setActivity] = useState<AdminActivityEvent[] | null>(null);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load(filters: { type?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.from) params.set("from", new Date(filters.from).toISOString());
    if (filters.to) params.set("to", new Date(filters.to).toISOString());
    const query = params.toString();
    const res = await apiClient.get<{ activity: AdminActivityEvent[] }>(`/admin/activity${query ? `?${query}` : ""}`);
    setActivity(res.activity);
  }

  useEffect(() => {
    load({});
  }, []);

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    load({ type: type || undefined, from: from || undefined, to: to || undefined });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-type">Event type</Label>
          <Input id="activity-type" placeholder="e.g. quiz_attempt" value={type} onChange={(e) => setType(e.target.value)} className="w-48" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-from">From</Label>
          <Input id="activity-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-to">To</Label>
          <Input id="activity-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {!activity ? (
        <p className="text-[13.5px] text-muted-foreground">Loading…</p>
      ) : activity.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No activity matches these filters.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-[18px] py-2.5 font-medium">Type</th>
                  <th className="px-[18px] py-2.5 font-medium">User</th>
                  <th className="px-[18px] py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((event) => (
                  <tr key={event.id} className="border-b border-border last:border-0">
                    <td className="px-[18px] py-2.5 text-foreground">{event.type.replace(/_/g, " ")}</td>
                    <td className="px-[18px] py-2.5 text-muted-foreground">{event.userEmail}</td>
                    <td className="px-[18px] py-2.5 text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
