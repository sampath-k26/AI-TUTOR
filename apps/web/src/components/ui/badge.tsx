import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** Deliberately not pill-rounded — that shape is reserved for avatars. */
const badgeVariants = cva(
  "inline-flex items-center gap-[5px] whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11.5px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-foreground text-background",
        secondary: "border-transparent bg-surface-2 text-muted-foreground",
        destructive: "bg-destructive/[0.12] text-destructive border-destructive/20",
        success: "bg-success/[0.12] text-success border-success/20",
        warning: "bg-warning/[0.12] text-warning border-warning/20",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
