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
