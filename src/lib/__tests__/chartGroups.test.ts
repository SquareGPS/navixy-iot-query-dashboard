import { describe, it, expect } from 'vitest';
import { DEFAULT_GROUP_LIMIT, resolvePlottedGroups } from '../chartGroups';

/** `count` distinct group values, in the order the rows first mention them. */
function groups(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `group ${i}`);
}

describe('resolvePlottedGroups', () => {
  it('plots the first DEFAULT_GROUP_LIMIT groups when nothing is picked', () => {
    expect(resolvePlottedGroups(groups(47), [])).toEqual(groups(10));
  });

  it('leaves reports under the limit whole', () => {
    expect(resolvePlottedGroups(groups(4), [])).toEqual(groups(4));
  });

  // DO-335: groups past the 10th were unreachable — the legend only ever
  // rendered the first 10, so nothing could select the 11th.
  it('reaches groups past the default limit once picked', () => {
    expect(resolvePlottedGroups(groups(47), ['group 11', 'group 46'])).toEqual([
      'group 11',
      'group 46',
    ]);
  });

  it('orders picks by the data, not by pick order, so colours stay put', () => {
    // Position selects the colour on screen and in the export, so picking
    // "group 2" after "group 5" must not recolour either of them.
    expect(resolvePlottedGroups(groups(6), ['group 5', 'group 2'])).toEqual([
      'group 2',
      'group 5',
    ]);
  });

  it('ignores picks the data no longer contains', () => {
    expect(resolvePlottedGroups(groups(6), ['group 2', 'retired group'])).toEqual(['group 2']);
  });

  it('falls back to the default set when every pick is stale', () => {
    // Switching the "Group by" column strands the old picks; a blank chart
    // would be a worse answer than the default view.
    expect(resolvePlottedGroups(groups(47), ['vehicle a', 'vehicle b'])).toEqual(groups(10));
  });

  it('honours a caller-supplied limit', () => {
    expect(resolvePlottedGroups(groups(47), [], 3)).toEqual(groups(3));
  });

  it('has no groups to plot when the data has none', () => {
    expect(resolvePlottedGroups([], [])).toEqual([]);
    expect(resolvePlottedGroups([], ['group 0'])).toEqual([]);
  });

  it('keeps the default limit at the value the export twin falls back to', () => {
    // ExportService.generateGroupedChartHTML applies the same 10 when an older
    // client sends no group list; they have to agree.
    expect(DEFAULT_GROUP_LIMIT).toBe(10);
  });
});
