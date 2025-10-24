import React from "react";
import { clsx } from "clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: "primary" | "secondary" | "ghost" 
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className, ...props }, ref) => {
    const base = "h-9 inline-flex items-center gap-2 rounded-sm px-4 text-sm font-semibold";
    const styles = {
      primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
      secondary: "border border-[var(--border)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--surface-3)]",
      ghost: "text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
    }[variant];
    
    return <button ref={ref} className={clsx(base, styles, className)} {...props} />;
  }
);

Button.displayName = "Button";