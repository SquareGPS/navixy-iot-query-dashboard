import React from "react";
import { clsx } from "clsx";

type ButtonVariant =
  | "primary"
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

type ButtonSize = "default" | "sm" | "lg" | "icon";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  // `default` is the primary action (shadcn semantics); kept identical to `primary`
  primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
  default: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
  secondary: "border border-[var(--border)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--surface-3)]",
  outline: "border border-[var(--border)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--surface-3)]",
  ghost: "text-[var(--text-primary)] hover:bg-[var(--surface-3)]",
  destructive: "bg-[var(--danger)] text-white hover:opacity-90",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  default: "h-9 px-4",
  sm: "h-8 px-3 text-xs",
  lg: "h-10 px-6",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "default", className, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

    return (
      <button
        ref={ref}
        className={clsx(base, VARIANT_STYLES[variant], SIZE_STYLES[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
