/**
 * PresetCard — a draggable Chart Library preset (FR-11365).
 *
 * Source of a `preset-<id>` drag. The drag `data` carries the panel object + label,
 * which the Canvas `preset-` branch reads on drop (see Canvas handleDragStart/End).
 * Must be rendered inside Canvas's DndContext for the drag to register.
 */
import * as Icons from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { ChartPreset } from '@/types/chart-catalog';

/** Resolve a kebab-case lucide icon name ("trending-up") to its component (TrendingUp). */
function resolveLucideIcon(name?: string): React.ComponentType<{ className?: string }> | null {
  if (!name) return null;
  const pascal = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  const icons = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  return icons[pascal] ?? null;
}

interface PresetCardProps {
  preset: ChartPreset;
}

export function PresetCard({ preset }: PresetCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `preset-${preset.id}`,
    data: { type: 'preset', panel: preset.panel, label: preset.label },
  });

  const Icon = resolveLucideIcon(preset.icon) ?? Icons.BarChart3;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      title={preset.label}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-md border p-2 text-center',
        'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700',
        'cursor-grab select-none transition-colors active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      <span className="line-clamp-2 text-xs text-gray-700 dark:text-gray-300">{preset.label}</span>
    </button>
  );
}
