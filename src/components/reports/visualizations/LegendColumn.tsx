import React from 'react';

/**
 * Right-side legend column shared by the pie/donut renderers (the inline one in
 * DashboardRenderer and the standalone PieChartComponent) — one source of truth for the
 * layout so the two can't drift.
 *
 * It fills the chart height and vertically centers its items so the list lines up with
 * the donut. When there are more items than fit it scrolls; `justify-content: safe center`
 * keeps the top items reachable (a plain `center` would clip them), and the block padding
 * gives the first/last rows a little breathing room from the scroll edges.
 */
export function LegendColumn({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 min-w-0 self-center relative"
      style={{
        minWidth: '200px',
        maxWidth: 'calc(50% - 1rem)',
        width: 'fit-content',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="h-full overflow-y-auto overflow-x-hidden flex flex-col"
        style={{ justifyContent: 'safe center', paddingBlock: '1.5rem' }}
      >
        {children}
      </div>
    </div>
  );
}
