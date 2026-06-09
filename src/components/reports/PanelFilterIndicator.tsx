/**
 * PanelFilterIndicator
 *
 * Compact badge shown on a panel header when one or more local dashboard filters
 * are actively applied to that panel. Hovering reveals which filters and columns.
 */
import { Filter } from 'lucide-react';
import type { ActivePanelFilter } from '@/utils/filterVariables';

interface PanelFilterIndicatorProps {
  filters: ActivePanelFilter[];
}

export function PanelFilterIndicator({ filters }: PanelFilterIndicatorProps) {
  if (!filters.length) return null;

  const detail =
    'Filtered by ' + filters.map((f) => `${f.label} → ${f.column}`).join(', ');

  return (
    <span
      title={detail}
      className="inline-flex items-center gap-1 rounded-full bg-[#379EF9]/10 px-2 py-0.5 text-xs font-medium text-[#379EF9] whitespace-nowrap dark:bg-blue-500/15 dark:text-blue-300"
    >
      <Filter className="h-3 w-3" />
      Filtered
    </span>
  );
}
