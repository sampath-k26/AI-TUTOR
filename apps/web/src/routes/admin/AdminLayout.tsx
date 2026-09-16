import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useProfile } from "../../lib/ProfileContext";
import { cn } from "../../lib/utils";

const TABS = [
  { to: "users", label: "Users" },
  { to: "spaces-projects", label: "Spaces & Projects" },
  { to: "activity", label: "Activity" },
  { to: "engagement", label: "Engagement & Learning" },
  { to: "ai-system", label: "AI & System" },
];

/**
 * Real enforcement is server-side (requireAdmin on every /admin/* route, checked
 * against profiles.role — see core/auth.ts). This is a UX guard only: hide the
 * page from a non-admin rather than showing a wall of 403s.
 */
export function AdminLayout() {
  const profile = useProfile();

  if (profile && profile.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>

      <nav className="flex flex-wrap gap-5 border-b border-border">
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

      <Outlet />
    </div>
  );
}
