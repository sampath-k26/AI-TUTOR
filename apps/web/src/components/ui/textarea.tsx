import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, error, ...props }, ref) => (
  <div className="w-full">
    <textarea
      className={cn(
        "flex min-h-[84px] w-full resize-y rounded-md border bg-surface-2 px-3 py-2.5",
        "text-[13.5px] leading-[1.55] text-foreground placeholder:text-subtle-foreground",
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
Textarea.displayName = "Textarea";
