/**
 * Which grouped series a composite report chart plots (DO-335).
 *
 * The groups present in the data and the groups worth plotting are not the same
 * set: "Group by" a high-cardinality column and 50 overlapping lines are
 * unreadable, but silently keeping the first 10 dropped the rest with nothing on
 * screen to say so. So the universe stays uncapped — the series picker offers
 * all of it — and this module decides what is actually drawn.
 *
 * The backend export twin (ExportService.generateGroupedChartHTML) plots the
 * list resolved here and sent with the export request, so the exported chart
 * agrees with the on-screen one.
 */

/**
 * Series plotted when the user has not picked a set. A readability budget, not a
 * data limit — the picker is what reaches past it.
 */
export const DEFAULT_GROUP_LIMIT = 10;

/**
 * Resolve the series to plot from the groups present in the data and the user's
 * picks.
 *
 * Order follows `allGroups` rather than pick order because position in the
 * returned list also selects the colour (on screen and in the export), so
 * ordering by the data keeps colours put as the selection changes.
 *
 * An empty or fully stale pick list — the group column changed, or a re-query no
 * longer returns those values — falls back to the default set rather than
 * blanking the chart.
 */
export function resolvePlottedGroups(
  allGroups: readonly string[],
  pickedGroups: readonly string[],
  limit: number = DEFAULT_GROUP_LIMIT,
): string[] {
  const picked = allGroups.filter(group => pickedGroups.includes(group));
  return picked.length > 0 ? picked : allGroups.slice(0, limit);
}

/**
 * How many non-plotted matches the series picker mounts at once. The group
 * universe is uncapped by design and a report may load up to 100k rows, so
 * "Group by" on a high-cardinality column would otherwise mount one row per
 * distinct value the moment the popover opens.
 */
export const RENDERED_MATCH_LIMIT = 100;

/**
 * The rows the series picker should mount, and how many matches it left out.
 *
 * Bounds the *rendering* only: `search` runs over every group, so a value at
 * index 9000 stays reachable by typing it. Plotted series always come back —
 * otherwise a pick made beyond the window could never be undone from here — and
 * the rest fill the window in data order.
 */
export function boundPickerRows(
  allGroups: readonly string[],
  plottedGroups: readonly string[],
  search: string,
  limit: number = RENDERED_MATCH_LIMIT,
): { rows: string[]; hiddenCount: number } {
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? allGroups.filter(group => group.toLowerCase().includes(needle))
    : allGroups;

  const plotted = new Set(plottedGroups);
  const rows: string[] = [];
  let windowed = 0;
  for (const group of matches) {
    if (plotted.has(group)) {
      rows.push(group);
    } else if (windowed < limit) {
      rows.push(group);
      windowed++;
    }
  }

  return { rows, hiddenCount: matches.length - rows.length };
}

/**
 * Add or remove one group from the picked set, returning the next pick list in
 * data order — pick order must not leak in, or every click would recolour the
 * chart.
 *
 * Removing the last plotted series returns the set unchanged. An empty list
 * means "no explicit pick" to resolvePlottedGroups, so emitting one would tick
 * ten boxes in answer to an uncheck; and a chart with no series is never the
 * goal. So the last series holds.
 */
export function toggleGroup(
  allGroups: readonly string[],
  plottedGroups: readonly string[],
  group: string,
): string[] {
  const next = plottedGroups.includes(group)
    ? plottedGroups.filter(g => g !== group)
    : [...plottedGroups, group];

  if (next.length === 0) return [...plottedGroups];
  return allGroups.filter(g => next.includes(g));
}
