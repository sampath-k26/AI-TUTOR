import { cn } from "../../lib/utils";

export interface ProgressProps {
  /** 0-100. Clamped defensively — a mastery/progress value should never be out
   * of range, but this renders a bar, not an assertion. */
  value: number;
  variant?: "primary" | "success" | "warning" | "destructive";
  className?: string;
}

const FILL_CLASS: Record<NonNullable<ProgressProps["variant"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

/** Thin linear progress track — matches the design system's hairline-border,
 * no-shadow language (see Card's own comment) rather than a heavier Material-style bar. */
export function Progress({ value, variant = "primary", className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300 ease-ease", FILL_CLASS[variant])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
