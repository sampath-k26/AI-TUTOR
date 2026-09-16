import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * Design language adapted from a reference "Linear-grade" system: lavender
 * accent reserved for primary actions only; every other variant carries
 * itself on the surface ladder and hairline borders, never a drop shadow.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-md",
    "text-[13px] font-medium gap-[7px] border border-transparent",
    "transition-[background-color,border-color,transform,color] duration-150",
    "active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:border-primary",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-surface-1 text-foreground border-border hover:bg-surface-2 hover:border-border-strong",
        outline: "bg-transparent text-foreground border-border hover:bg-surface-2 hover:border-border-strong",
        ghost: "bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      },
      size: {
        default: "h-8 px-[13px]",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
));
Button.displayName = "Button";
