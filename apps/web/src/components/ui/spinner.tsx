import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

// shadcn/ui has no separate "spinner" registry component — its own examples use
// lucide's Loader2 with animate-spin directly inline in buttons; wrapped here
// once for reuse rather than repeating the icon+className at every call site.
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-3.5 animate-spin", className)} aria-hidden="true" />;
}
