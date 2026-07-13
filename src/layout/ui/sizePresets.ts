/**
 * Size presets offered in the "Add Panel" gallery.
 *
 * The gallery shows each preset's exact grid dimensions (e.g. "Large (24×8)"),
 * so the picked preset is the definitive size for a new panel — creation must
 * honour it rather than fall back to a per-type default (DO-306).
 */

import { clampSizeToMin } from '../geometry/add';

export const SIZE_PRESETS = [
  { label: 'Small', w: 6, h: 4 },
  { label: 'Medium', w: 12, h: 8 },
  { label: 'Large', w: 24, h: 8 },
] as const;

export type SizePresetLabel = (typeof SIZE_PRESETS)[number]['label'];

/** The default preset when none is chosen. */
export const DEFAULT_SIZE_PRESET: SizePresetLabel = 'Medium';

/**
 * Resolve a size preset label to its grid dimensions. Falls back to the default
 * preset for an unknown label.
 */
export function resolvePresetSize(label: SizePresetLabel): { w: number; h: number } {
  const preset = SIZE_PRESETS.find((s) => s.label === label)
    ?? SIZE_PRESETS.find((s) => s.label === DEFAULT_SIZE_PRESET)!;
  return { w: preset.w, h: preset.h };
}

/**
 * Whether a size sits below a panel type's minimum footprint — i.e. creation
 * would clamp it up to the floor. Derived from the very same clampSizeToMin the
 * commit path uses (the single source of truth), so the check can never disagree
 * with what actually gets created.
 *
 * The Add Panel gallery uses this to grey out below-min presets: without it a
 * "Small (6×4)" option would advertise a size the panel is never created at for
 * below-min types like table (12×8) or bar/pie charts (6×6) — the label would
 * lie (DO-317 follow-up).
 */
export function isPresetBelowMin(
  panelType: string,
  size: { w: number; h: number }
): boolean {
  const clamped = clampSizeToMin(panelType, size);
  return clamped.w !== size.w || clamped.h !== size.h;
}
