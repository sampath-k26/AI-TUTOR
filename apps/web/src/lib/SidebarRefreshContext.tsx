import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * The sidebar's Projects/Activity Log sections fetch independently of whatever
 * page is mounted in the content area (AppShell persists the sidebar across
 * route changes) — without this, creating a Space/Project elsewhere leaves the
 * sidebar showing stale data until a full reload. Pages call refreshSidebar()
 * after a mutation that affects either section; both sections just include
 * `version` in their fetch effect's dependencies.
 */
interface SidebarRefreshContextValue {
  version: number;
  refreshSidebar: () => void;
}

const SidebarRefreshContext = createContext<SidebarRefreshContextValue | null>(null);

export function SidebarRefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refreshSidebar = useCallback(() => setVersion((v) => v + 1), []);

  return <SidebarRefreshContext.Provider value={{ version, refreshSidebar }}>{children}</SidebarRefreshContext.Provider>;
}

export function useSidebarRefresh(): SidebarRefreshContextValue {
  const ctx = useContext(SidebarRefreshContext);
  if (!ctx) throw new Error("useSidebarRefresh must be used within a SidebarRefreshProvider");
  return ctx;
}
