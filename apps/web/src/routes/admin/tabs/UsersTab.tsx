import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiClient } from "../../../lib/apiClient";
import { useToast } from "../../../lib/ToastContext";
import type { AdminUser } from "../../../lib/types";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Sheet } from "../../../components/ui/sheet";
import { Skeleton } from "../../../components/ui/skeleton";
import { TableSkeleton } from "../../../components/ui/table-skeleton";

export function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient.get<{ users: AdminUser[]; total: number }>("/admin/users").then((res) => {
      setUsers(res.users);
      setTotal(res.total);
    });
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await apiClient.post<{ user: AdminUser }>("/admin/users", { email, password, role });
      setUsers((prev) => (prev ? [res.user, ...prev] : prev));
      setTotal((prev) => prev + 1);
      setEmail("");
      setPassword("");
      setRole("user");
      setSheetOpen(false);
      toast({ variant: "success", title: "User created", description: `"${res.user.email}" can now log in.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      setError(message);
      toast({ variant: "error", title: "Couldn't create user", description: message });
    } finally {
      setCreating(false);
    }
  }

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
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">{total} total users</p>
        <Button onClick={() => setSheetOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New User
        </Button>
      </div>
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

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Create a User"
        description="Sets up a fully-confirmed account with the role you choose — no email confirmation needed."
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-password">Initial password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-role">Role</Label>
            <select
              id="new-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
              className="flex h-[38px] w-full rounded-md border border-border bg-surface-2 px-3 text-[13.5px] text-foreground transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
          <Button type="submit" disabled={creating} className="self-start">
            {creating ? "Creating…" : "Create User"}
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
