import { ExportService } from '../export.js';
// Type-only: the ESM runner links named imports for real, and an interface has
// no runtime export.
import type { ExportColumn } from '../export.js';

/**
 * Chart generation is effectively pure (rows -> Chart.js script text), so it is
 * asserted directly. Both generators are private; reach them through an index
 * signature rather than exporting them purely for the tests.
 */
type ChartGenerators = {
  generateChartHTML(
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
    chartConfig: { type?: string; xColumn?: string; yColumns?: string[] },
  ): string;
  generateGroupedChartHTML(
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
    chartConfig: { xColumn: string; yColumn: string; groupColumn: string },
  ): string;
};

const service = ExportService.getInstance() as unknown as ChartGenerators;

const COLUMNS: ExportColumn[] = [
  { name: 'driver_name', type: 'text' },
  { name: 'total_score', type: 'numeric' },
  { name: 'vehicle_model', type: 'text' },
];

/** Rows shaped like the DO-332 report: one row per vehicle, descending score. */
function scoreRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    driver_name: `driver ${i}`,
    total_score: count - i,
    vehicle_model: i % 2 === 0 ? 'Camry' : 'Corolla',
  }));
}

/** Pull `labels: [...]` back out of the generated Chart.js config. */
function parseLabels(script: string): string[] {
  const match = script.match(/labels:\s*(\[[\s\S]*?\]),\n/);
  if (!match) throw new Error('no labels array in generated script');
  return JSON.parse(match[1]!);
}

/** Pull every dataset's `data: [...]` back out of the generated config. */
function parseDataArrays(script: string): unknown[][] {
  const match = script.match(/datasets:\s*(\[[\s\S]*?\])\n/);
  if (!match) throw new Error('no datasets array in generated script');
  const datasets = JSON.parse(match[1]!) as Array<{ data: unknown[] }>;
  return datasets.map(d => d.data);
}

describe('ExportService chart generation', () => {
  describe('generateChartHTML (ungrouped)', () => {
    // DO-332: the chart capped at the first 200 rows while the table showed
    // every row. Reports commonly end in ORDER BY <metric> DESC, so the cap
    // dropped the worst performers rather than an arbitrary tail.
    it('plots every row past the old 200-row cap', () => {
      const rows = scoreRows(243);

      const script = service.generateChartHTML(COLUMNS, rows, {
        xColumn: 'driver_name',
        yColumns: ['total_score'],
      });

      expect(parseLabels(script)).toHaveLength(243);
      expect(parseDataArrays(script)).toEqual([rows.map(r => r.total_score)]);
    });

    it('keeps the lowest-scoring rows, which sort last', () => {
      const script = service.generateChartHTML(COLUMNS, scoreRows(243), {
        xColumn: 'driver_name',
        yColumns: ['total_score'],
      });

      const data = parseDataArrays(script)[0]!;
      expect(data[data.length - 1]).toBe(1);
      expect(parseLabels(script)).toContain('driver 242');
    });

    it('emits one dataset per y-column, each covering every row', () => {
      const script = service.generateChartHTML(COLUMNS, scoreRows(250), {
        xColumn: 'driver_name',
        yColumns: ['total_score', 'mileage_km'],
      });

      const data = parseDataArrays(script);
      expect(data).toHaveLength(2);
      expect(data.every(d => d.length === 250)).toBe(true);
    });

    it('neutralises a </script> payload in row data', () => {
      const script = service.generateChartHTML(
        COLUMNS,
        [{ driver_name: '</script><img src=x onerror=alert(1)>', total_score: 1 }],
        { xColumn: 'driver_name', yColumns: ['total_score'] },
      );

      expect(script).not.toContain('</script>');
      // Still round-trips to the original value for the chart itself.
      expect(parseLabels(script)).toEqual(['</script><img src=x onerror=alert(1)>']);
    });
  });

  describe('generateGroupedChartHTML', () => {
    it('plots every row past the old 500-row cap', () => {
      const script = service.generateGroupedChartHTML(COLUMNS, scoreRows(600), {
        xColumn: 'driver_name',
        yColumn: 'total_score',
        groupColumn: 'vehicle_model',
      });

      expect(parseLabels(script)).toHaveLength(600);
    });

    it('fills datasets for groups whose rows all sort past the old cut', () => {
      // `groups` was derived from every row while `sortedRows` was capped at
      // 500, so a group living entirely past the cut produced an all-null
      // dataset. Sorting is by x, so "zz" rows land last.
      const rows = [
        ...scoreRows(500),
        ...Array.from({ length: 10 }, (_, i) => ({
          driver_name: `zz driver ${i}`,
          total_score: 42,
          vehicle_model: 'Late Model',
        })),
      ];

      const script = service.generateGroupedChartHTML(COLUMNS, rows, {
        xColumn: 'driver_name',
        yColumn: 'total_score',
        groupColumn: 'vehicle_model',
      });

      const lateModel = JSON.parse(
        script.match(/datasets:\s*(\[[\s\S]*?\])\n/)![1]!,
      ).find((d: { label: string }) => d.label === 'Late Model');

      expect(lateModel).toBeDefined();
      expect(lateModel.data.filter((v: unknown) => v !== null)).toHaveLength(10);
    });
  });
});
