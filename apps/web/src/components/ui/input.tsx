import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, ...props }, ref) => (
  <div className="w-full">
    <input
      type={type}
      className={cn(
        "flex h-[38px] w-full rounded-md border bg-surface-2 px-3 text-[13.5px] text-foreground",
        "placeholder:text-subtle-foreground",
        "transition-[border-color,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !error && "border-border hover:border-border-strong",
        error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25",
        className,
      )}
      ref={ref}
      {...props}
    />
    {error && (
      <p role="alert" className="mt-1.5 flex items-start gap-1 text-[11.5px] leading-snug text-destructive">
        <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" />
        <span>{error}</span>
      </p>
    )}
  </div>
));
Input.displayName = "Input";
