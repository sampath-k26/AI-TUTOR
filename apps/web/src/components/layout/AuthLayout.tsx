import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared branded shell for Login/Signup — the only two routes rendered before
 * AppShell exists, so they get their own moment (logo mark, tagline, subtle
 * backdrop) instead of a bare centered card.
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />

      <div className="relative flex flex-col items-center gap-1.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 shadow-sm">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <h1 className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-foreground">AI Tutor</h1>
        <p className="text-[13px] text-muted-foreground">Your materials, evidence-grounded answers, and mastery tracking.</p>
      </div>

      <div className="relative mt-8 w-full max-w-sm">
        <div className="rounded-lg border border-border bg-surface-1 p-6 shadow-sm">
          <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
