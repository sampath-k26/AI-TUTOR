import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface IconTileProps {
  icon: LucideIcon;
  variant?: "primary" | "success" | "warning" | "destructive" | "muted";
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<IconTileProps["variant"]>, string> = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-destructive-muted text-destructive",
  muted: "bg-surface-3 text-muted-foreground",
};

/** Small colored square icon badge used as a card/list-item accent — the one
 * repeated visual motif tying dashboard cards together (see HomeOverview,
 * Space/Project cards) instead of every card being plain text on a surface. */
export function IconTile({ icon: Icon, variant = "primary", className }: IconTileProps) {
  return (
    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", VARIANT_CLASS[variant], className)}>
      <Icon className="h-4 w-4" />
    </div>
  );
}
