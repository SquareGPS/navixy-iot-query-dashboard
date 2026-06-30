/**
 * PresetCard — a draggable Chart Library preset (FR-11365).
 *
 * Source of a `preset-<id>` drag. The drag `data` carries the panel object + label,
 * which the Canvas `preset-` branch reads on drop (see Canvas handleDragStart/End).
 * Must be rendered inside Canvas's DndContext for the drag to register.
 */
import { useDraggable } from '@dnd-kit/core';
import {
  Activity, AlertTriangle, BarChart, BarChart3, Car, Clock, Hash, Hourglass,
  MapPin, Moon, ParkingSquare, PauseCircle, PieChart, Route, ShieldAlert,
  Timer, TrendingUp, Wifi, WifiOff, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChartPreset } from '@/types/chart-catalog';

// Curated map of the icons the catalog uses (kebab name -> component) so only these are
// bundled — `import * as` would pull all ~1.5k lucide icons and defeat tree-shaking.
// Add an entry when the analyst introduces a new icon; unknown names fall back to BarChart3.
const ICON_MAP: Record<string, LucideIcon> = {
  'activity': Activity,
  'alert-triangle': AlertTriangle,
  'bar-chart': BarChart,
  'car': Car,
  'clock': Clock,
  'hash': Hash,
  'hourglass': Hourglass,
  'map-pin': MapPin,
  'moon': Moon,
  'parking-square': ParkingSquare,
  'pause-circle': PauseCircle,
  'pie-chart': PieChart,
  'route': Route,
  'shield-alert': ShieldAlert,
  'timer': Timer,
  'trending-up': TrendingUp,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'zap': Zap,
};

interface PresetCardProps {
  preset: ChartPreset;
}

export function PresetCard({ preset }: PresetCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `preset-${preset.id}`,
    data: { type: 'preset', panel: preset.panel, label: preset.label },
  });

  const Icon = (preset.icon && ICON_MAP[preset.icon]) || BarChart3;

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
