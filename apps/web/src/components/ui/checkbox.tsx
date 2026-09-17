import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Adapted from shadcn/ui's Checkbox (registry/new-york-v4/ui/checkbox.tsx) onto
 * a plain `<button role="checkbox">` instead of Radix's Checkbox primitive —
 * this project has no Radix dependency (see alert.tsx's precedent for the same
 * substitution), and a single interactive checkbox needs no extra library.
 */
export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-border shadow-xs transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-primary bg-primary text-primary-foreground" : "bg-surface-1",
        className,
      )}
      {...props}
    >
      {checked && (
        <span className="grid place-content-center text-current">
          <Check className="size-3.5" />
        </span>
      )}
    </button>
  ),
);
Checkbox.displayName = "Checkbox";
