import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast, type ToastItem, type ToastVariant } from "../../lib/ToastContext";
import { cn } from "../../lib/utils";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-success/20 bg-success-muted",
  error: "border-destructive/20 bg-destructive-muted",
  warning: "border-warning/20 bg-warning-muted",
  info: "border-border bg-surface-1",
};

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
  info: "text-primary",
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const Icon = VARIANT_ICON[toast.variant];

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border p-3 shadow-lg animate-toast-in",
        VARIANT_STYLES[toast.variant],
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", VARIANT_ICON_COLOR[toast.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-snug text-foreground">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-[360px]">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
