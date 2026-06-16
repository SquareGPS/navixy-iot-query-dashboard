import React from "react";
import { clsx } from "clsx";

/**
 * Historically this Button styled only three variants and ignored `size`,
 * with all sizing/spacing supplied via `className`. That runtime behavior is
 * preserved verbatim so every existing button renders exactly as before — the
 * only change here is widening the prop *types* so call sites that pass other
 * variant/size values (and the shadcn calendar/pagination primitives) type-check.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "default"
  | "outline"
  | "destructive";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const BASE = "h-9 inline-flex items-center gap-2 rounded-sm px-4 text-sm font-semibold";

const VARIANT_STYLES: Partial<Record<ButtonVariant, string>> = {
  primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
  secondary: "border border-[var(--border)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--surface-3)]",
  ghost: "text-[var(--text-primary)] hover:bg-[var(--surface-3)]",
};

/** Class string for button-styled non-<button> elements (shadcn calendar/pagination). */
export function buttonVariants(options?: { variant?: ButtonVariant; size?: ButtonSize }): string {
  const { variant = "primary" } = options ?? {};
  return clsx(BASE, VARIANT_STYLES[variant]);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  // `size` is accepted for API compatibility but intentionally not applied to
  // layout — matching the original behavior where sizing came from className.
  ({ variant = "primary", size: _size, className, ...props }, ref) => {
    return <button ref={ref} className={clsx(BASE, VARIANT_STYLES[variant], className)} {...props} />;
  }
);

Button.displayName = "Button";
