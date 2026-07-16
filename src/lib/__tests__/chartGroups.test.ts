import { describe, it, expect } from 'vitest';
import {
  boundPickerRows,
  DEFAULT_GROUP_LIMIT,
  RENDERED_MATCH_LIMIT,
  resolvePlottedGroups,
  toggleGroup,
} from '../chartGroups';

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

describe('toggleGroup', () => {
  it('adds a group that is not plotted', () => {
    expect(toggleGroup(groups(6), ['group 1'], 'group 3')).toEqual(['group 1', 'group 3']);
  });

  it('removes a group that is plotted', () => {
    expect(toggleGroup(groups(6), ['group 1', 'group 3'], 'group 1')).toEqual(['group 3']);
  });

  it('returns picks in data order regardless of click order', () => {
    // Position selects the colour, so a late pick must not jump the queue.
    expect(toggleGroup(groups(6), ['group 5'], 'group 2')).toEqual(['group 2', 'group 5']);
  });

  // Unchecking the last series used to emit [], which resolvePlottedGroups
  // reads as "no explicit pick" — so the chart answered an uncheck by ticking
  // ten boxes, and the next pick then built on those ten.
  it('holds the last plotted series rather than emptying the chart', () => {
    expect(toggleGroup(groups(47), ['group 11'], 'group 11')).toEqual(['group 11']);
  });

  it('never emits an empty pick list, which would restore the default set', () => {
    const sole = ['group 11'];
    const after = toggleGroup(groups(47), sole, 'group 11');

    expect(after).not.toEqual([]);
    expect(resolvePlottedGroups(groups(47), after)).toEqual(['group 11']);
  });

  it('still allows unchecking down to one', () => {
    expect(toggleGroup(groups(6), ['group 1', 'group 3'], 'group 3')).toEqual(['group 1']);
  });
});

// The picker mounts one row per group. The group universe is uncapped and
// reports allow up to 100k rows, so a high-cardinality "Group by" could mount
// 100k rows the moment the popover opened and lock up the page.
describe('boundPickerRows', () => {
  it('mounts every group when there are fewer than the limit', () => {
    const { rows, hiddenCount } = boundPickerRows(groups(12), [], '');

    expect(rows).toEqual(groups(12));
    expect(hiddenCount).toBe(0);
  });

  it('bounds what it mounts for a high-cardinality column', () => {
    const { rows, hiddenCount } = boundPickerRows(groups(100_000), [], '');

    expect(rows).toHaveLength(RENDERED_MATCH_LIMIT);
    expect(hiddenCount).toBe(100_000 - RENDERED_MATCH_LIMIT);
  });

  // The point of bounding the render rather than the data: everything stays
  // reachable by typing, including values far past the window.
  it('finds a value far beyond the window by search', () => {
    const { rows } = boundPickerRows(groups(100_000), [], 'group 94123');

    expect(rows).toContain('group 94123');
  });

  it('searches case-insensitively and ignores surrounding space', () => {
    const { rows } = boundPickerRows(['Berlin', 'Paris'], [], '  bERlin ');

    expect(rows).toEqual(['Berlin']);
  });

  it('reports how many matches it left out', () => {
    const { rows, hiddenCount } = boundPickerRows(groups(250), [], '', 10);

    expect(rows).toHaveLength(10);
    expect(hiddenCount).toBe(240);
  });

  // A series picked from beyond the window must stay unpickable-from — the
  // picker is the only place it can be switched off.
  it('always mounts plotted series, even past the window', () => {
    const { rows, hiddenCount } = boundPickerRows(groups(100_000), ['group 90000'], '', 10);

    expect(rows).toContain('group 90000');
    expect(rows).toHaveLength(11); // the 10-row window + the plotted straggler
    expect(hiddenCount).toBe(100_000 - 11);
  });

  it('keeps mounted rows in data order, so colours line up with the legend', () => {
    const { rows } = boundPickerRows(groups(50), ['group 40'], '', 3);

    expect(rows).toEqual(['group 0', 'group 1', 'group 2', 'group 40']);
  });

  it('does not resurrect plotted series that the search excludes', () => {
    const { rows } = boundPickerRows(['Berlin', 'Paris'], ['Berlin'], 'Paris');

    expect(rows).toEqual(['Paris']);
  });

  it('mounts nothing when the search matches nothing', () => {
    const { rows, hiddenCount } = boundPickerRows(groups(50), [], 'nonexistent');

    expect(rows).toEqual([]);
    expect(hiddenCount).toBe(0);
  });
});
