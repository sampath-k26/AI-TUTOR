import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "./icon-tile";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Consistent empty state (icon + title + optional description/action) used
 * wherever a list can legitimately be empty — replaces a bare line of
 * muted-foreground text with something that reads as designed, not missing. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <IconTile icon={icon} variant="muted" className="h-10 w-10 [&>svg]:h-5 [&>svg]:w-5" />
      <div className="flex flex-col gap-1">
        <p className="text-[13.5px] font-medium text-foreground">{title}</p>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
