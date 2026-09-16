import { Menu } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Button } from "../ui/button";
import { Sidebar } from "./Sidebar";

/**
 * The one place authenticated pages get their chrome (sidebar nav + content
 * width/padding) — a layout route wrapped once by ProtectedRoute in App.tsx,
 * rather than every page managing its own header/back-links/width.
 */
export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="w-8 px-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="text-[14px] font-semibold text-foreground">AI Study Companion</span>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
