import { BarChart3, GraduationCap, Home, LogOut, Shield, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useProfile } from "../../lib/ProfileContext";
import { supabase } from "../../lib/supabaseClient";
import { ThemeToggle } from "../ThemeToggle";
import { Button } from "../ui/button";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const NAV_LINK_CLASS =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";
const NAV_LINK_ACTIVE_CLASS = "bg-surface-2 text-foreground";

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const profile = useProfile();

  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2 px-4 py-4">
        <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
        <span className="text-[14.5px] font-semibold leading-tight text-foreground">AI Study Companion</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        <NavLink
          to="/"
          end
          onClick={onNavigate}
          className={({ isActive }) => cn(NAV_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)}
        >
          <Home className="h-4 w-4" />
          Spaces
        </NavLink>
        <NavLink
          to="/analytics"
          onClick={onNavigate}
          className={({ isActive }) => cn(NAV_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)}
        >
          <BarChart3 className="h-4 w-4" />
          Global Analytics
        </NavLink>
        {profile?.role === "admin" && (
          <NavLink
            to="/admin"
            onClick={onNavigate}
            className={({ isActive }) => cn(NAV_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)}
          >
            <Shield className="h-4 w-4" />
            Admin Dashboard
          </NavLink>
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="truncate text-[12.5px] text-muted-foreground" title={profile?.email}>
            {profile?.email}
          </span>
          <ThemeToggle />
        </div>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()} className="justify-start gap-2">
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-1 md:block">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface-1">
            <div className="flex justify-end px-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close navigation" className="w-7 px-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
