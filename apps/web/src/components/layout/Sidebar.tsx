import { BarChart3, FolderKanban, GraduationCap, History, Home, LogOut, Menu, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useProfile } from "../../lib/ProfileContext";
import { supabase } from "../../lib/supabaseClient";
import { ThemeToggle } from "../ThemeToggle";
import { Button } from "../ui/button";
import { SidebarProjectsSection } from "./SidebarProjectsSection";
import { SidebarActivitySection } from "./SidebarActivitySection";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const COLLAPSE_STORAGE_KEY = "ai-tutor-sidebar-collapsed";

const NAV_LINK_CLASS =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";
const NAV_LINK_ACTIVE_CLASS = "bg-surface-2 text-foreground";
const RAIL_LINK_CLASS =
  "flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

function PrimaryNav({ onNavigate }: { onNavigate: () => void }) {
  const profile = useProfile();

  return (
    <nav className="flex flex-col gap-1 px-3">
      <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => cn(NAV_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)}>
        <Home className="h-4 w-4" />
        Spaces
      </NavLink>
      <NavLink to="/analytics" onClick={onNavigate} className={({ isActive }) => cn(NAV_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)}>
        <BarChart3 className="h-4 w-4" />
        Global Analytics
      </NavLink>
      {profile?.role === "admin" && (
        <NavLink to="/admin" onClick={onNavigate} className={({ isActive }) => cn(NAV_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)}>
          <Shield className="h-4 w-4" />
          Admin Dashboard
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

      <PrimaryNav onNavigate={onNavigate} />

      <div className="mt-4 flex-1 overflow-y-auto border-t border-border px-3 pt-4">
        <div className="flex flex-col gap-6 pb-2">
          <SidebarProjectsSection onNavigate={onNavigate} />
          <SidebarActivitySection onNavigate={onNavigate} />
        </div>
      </div>

      <SidebarFooter collapsed={false} />
    </div>
  );
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  const profile = useProfile();

  return (
    <div className="flex h-full flex-col items-center">
      <Link to="/" className="flex items-center justify-center py-4" aria-label="AI Tutor">
        <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
      </Link>

      <nav className="flex flex-col items-center gap-1 px-2">
        <NavLink to="/" end className={({ isActive }) => cn(RAIL_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)} title="Spaces">
          <Home className="h-4 w-4" />
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => cn(RAIL_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)} title="Global Analytics">
          <BarChart3 className="h-4 w-4" />
        </NavLink>
        {profile?.role === "admin" && (
          <NavLink to="/admin" className={({ isActive }) => cn(RAIL_LINK_CLASS, isActive && NAV_LINK_ACTIVE_CLASS)} title="Admin Dashboard">
            <Shield className="h-4 w-4" />
          </NavLink>
        )}
        <button type="button" onClick={onExpand} title="Projects" className={RAIL_LINK_CLASS}>
          <FolderKanban className="h-4 w-4" />
        </button>
        <button type="button" onClick={onExpand} title="Activity Log" className={RAIL_LINK_CLASS}>
          <History className="h-4 w-4" />
        </button>
      </nav>

      <div className="flex-1" />
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
      <div className={cn("relative hidden shrink-0 md:block", collapsed ? "w-14" : "w-72")}>
        <aside className="h-full border-r border-border bg-surface-1">
          {collapsed ? <CollapsedRail onExpand={() => setCollapsed(false)} /> : <ExpandedSidebar onNavigate={() => {}} />}
        </aside>
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
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface-1">
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
