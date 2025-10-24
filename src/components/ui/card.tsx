import { clsx } from "clsx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-[var(--surface-2)] border border-[var(--border)] rounded-md",
        "ring-1 ring-inset ring-white/5",        // subtle inner highlight (dark)
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02)]", // hairline crispness
        "p-5",
        className
      )}
      {...props}
    />
  );
}