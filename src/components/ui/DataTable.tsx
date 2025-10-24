import { clsx } from "clsx";

export function DataTable({ 
  head, 
  rows 
}: { 
  head: React.ReactNode[]; 
  rows: React.ReactNode[][]; 
}) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-md overflow-hidden">
      <table className="w-full border-spacing-0">
        <thead className="bg-[var(--surface-3)]">
          <tr>
            {head.map((h, i) => (
              <th 
                key={i} 
                className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase text-left px-4 py-3 border-b border-[var(--border)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-[var(--surface-3)]">
              {r.map((c, ci) => (
                <td 
                  key={ci} 
                  className={clsx(
                    "h-10 px-4 py-3 border-b border-[var(--border)]",
                    ci === r.length - 1 && "text-right",
                    typeof c === 'number' && "tabular-nums text-right"
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Empty state pattern */}
      {!rows.length && (
        <div className="p-8 text-center text-sm text-[var(--text-muted)]">No data available</div>
      )}
    </div>
  );
}
