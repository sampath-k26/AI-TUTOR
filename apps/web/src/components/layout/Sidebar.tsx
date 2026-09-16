import { BarChart3, FolderKanban, GraduationCap, History, Home, LogOut, Menu, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
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

const COLLAPSE_STORAGE_KEY = "ai-tutor-sidebar-collapsed";

const NAV_ITEMS = [
  { to: "/", label: "Spaces", icon: Home, end: true },
  { to: "/analytics", label: "Global Analytics", icon: BarChart3, end: false },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: false },
  { to: "/activity", label: "Activity Log", icon: History, end: false },
] as const;

const NAV_LINK_CLASS =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";
const NAV_LINK_ACTIVE_CLASS = "bg-surface-2 text-foreground";
const RAIL_LINK_CLASS =
  "flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

/**
 * The sidebar is navigation only — Spaces, Global Analytics, Projects, Activity
 * Log, Admin — every one of those is a real page in the content area. Search/
 * filter/pagination/tabs for Projects and Activity Log live on those pages,
 * not here (a first pass put them directly in the sidebar; too cramped and not
 * where a user expects to interact with them).
 */
function PrimaryNav({ onNavigate, rail }: { onNavigate: () => void; rail?: boolean }) {
  const profile = useProfile();
  const linkClass = rail ? RAIL_LINK_CLASS : NAV_LINK_CLASS;

  return (
    <nav className={cn("flex flex-col gap-1", rail ? "items-center px-2" : "px-3")}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          title={rail ? item.label : undefined}
          className={({ isActive }) => cn(linkClass, isActive && NAV_LINK_ACTIVE_CLASS)}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!rail && item.label}
        </NavLink>
      ))}
      {profile?.role === "admin" && (
        <NavLink
          to="/admin"
          onClick={onNavigate}
          title={rail ? "Admin Dashboard" : undefined}
          className={({ isActive }) => cn(linkClass, isActive && NAV_LINK_ACTIVE_CLASS)}
        >
          <Shield className="h-4 w-4 shrink-0" />
          {!rail && "Admin Dashboard"}
        </NavLink>
      )}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const profile = useProfile();

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-border px-2 py-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          aria-label="Log out"
          className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <span className="truncate text-[12.5px] text-muted-foreground" title={profile?.email}>
          {profile?.email}
        </span>
        <ThemeToggle />
      </div>
      {/* Plain row, not a bordered button — logout is a low-emphasis action here. */}
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </div>
  );
}

function ExpandedSidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2 px-4 py-4">
        <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
        <span className="text-[14.5px] font-semibold leading-tight text-foreground">AI Tutor</span>
      </Link>

      <div className="flex-1">
        <PrimaryNav onNavigate={onNavigate} />
      </div>

      <SidebarFooter collapsed={false} />
    </div>
  );
}

function CollapsedRail() {
  return (
    <div className="flex h-full flex-col items-center">
      <Link to="/" className="flex items-center justify-center py-4" aria-label="AI Tutor">
        <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
      </Link>

      <div className="flex-1">
        <PrimaryNav onNavigate={() => {}} rail />
      </div>

      <SidebarFooter collapsed />
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
    } catch {
      // per-viewer convenience only — safe to no-op if storage is unavailable.
    }
  }, [collapsed]);

  return (
    <>
      <div className={cn("relative hidden shrink-0 md:block", collapsed ? "w-14" : "w-60")}>
        <aside className="h-full border-r border-border bg-surface-1">{collapsed ? <CollapsedRail /> : <ExpandedSidebar onNavigate={() => {}} />}</aside>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-1 text-muted-foreground shadow-sm transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Menu className="h-3.5 w-3.5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface-1">
            <div className="flex justify-end px-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close navigation" className="w-7 px-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ExpandedSidebar onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
