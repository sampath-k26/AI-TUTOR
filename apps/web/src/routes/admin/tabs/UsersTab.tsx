import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { AdminUser } from "../../../lib/types";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { TableSkeleton } from "../../../components/ui/table-skeleton";

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    apiClient.get<{ users: AdminUser[]; total: number }>("/admin/users").then((res) => {
      setUsers(res.users);
      setTotal(res.total);
    });
  }, []);

  if (!users) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Card>
          <CardContent className="p-0">
            <TableSkeleton cols={3} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">{total} total users</p>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-[18px] py-2.5 font-medium">Email</th>
                <th className="px-[18px] py-2.5 font-medium">Role</th>
                <th className="px-[18px] py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-[18px] py-2.5 text-foreground">{user.email}</td>
                  <td className="px-[18px] py-2.5">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  </td>
                  <td className="px-[18px] py-2.5 text-muted-foreground">{new Date(user.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="p-[18px] text-[13.5px] text-muted-foreground">No users yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
