import { Card } from "./card";

export function KpiTile({ 
  label, 
  value, 
  hint 
}: { 
  label: string; 
  value?: string | number; 
  hint?: string; 
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</div>
      <div className="mt-3 h-[2px] w-8 bg-[var(--accent)]/65 rounded"></div>
      {hint && <div className="mt-2 text-xs text-[var(--text-muted)]">{hint}</div>}
    </Card>
  );
}
