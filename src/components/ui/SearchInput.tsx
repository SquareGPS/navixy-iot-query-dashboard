export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-10 w-full max-w-[560px] rounded-md
                 bg-[var(--surface-3)]/80 border border-[var(--border)]
                 px-4 text-sm placeholder:text-[var(--text-muted)]
                 focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
      placeholder="Search data, dashboards, SQL…"
    />
  );
}
