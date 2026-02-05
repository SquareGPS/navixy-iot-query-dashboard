import { useState } from 'react';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PanelType } from '@/types/dashboard-types';

interface DatasetRequirementsProps {
  panelType: PanelType;
}

/**
 * Returns dataset requirements description for each panel type
 */
function getDatasetRequirements(panelType: PanelType): string {
  switch (panelType) {
    case 'kpi':
    case 'stat':
      return 'Expected dataset: 1 column (numeric value). The query should return a single row with a single numeric value (e.g., `SELECT COUNT(*) FROM table`).';

    case 'table':
      return 'Expected dataset: Any number of columns. The query can return any structure - all columns will be displayed as table columns.';

    case 'barchart':
    case 'bargauge':
      return 'Expected dataset: 2 columns minimum.\n' +
        '• Column 1: Category (x-axis labels)\n' +
        '• Column 2: Value (bar heights)\n\n' +
        'Optional: 3+ columns for multiple series/grouped bars\n' +
        '• Column 1: Category\n' +
        '• Column 2: Value\n' +
        '• Column 3: Series name (for grouping/stacking)\n\n' +
        'Example: `SELECT category, COUNT(*) AS value FROM table GROUP BY category`';

    case 'piechart':
      return 'Expected dataset: 2 columns.\n' +
        '• Column 1: Category/Label (slice names)\n' +
        '• Column 2: Value (slice sizes)\n\n' +
        'Example: `SELECT category, SUM(amount) AS value FROM table GROUP BY category`';

    case 'geomap':
      return 'Expected dataset: 2 columns minimum.\n' +
        '• Column 1: Latitude (named lat, latitude, or similar)\n' +
        '• Column 2: Longitude (named lon, lng, longitude, or similar)\n\n' +
        'Optional: Additional columns for marker popups\n\n' +
        'Example: `SELECT lat, lon, name, timestamp FROM locations`';

    case 'linechart':
    case 'timeseries':
      return 'Expected dataset: 2 columns minimum.\n' +
        '• Column 1: Timestamp (x-axis, time series)\n' +
        '• Column 2: Value (y-axis, numeric)\n\n' +
        'Optional: 3+ columns for multiple series\n' +
        '• Column 1: Timestamp\n' +
        '• Column 2: Value\n' +
        '• Column 3: Series name\n\n' +
        'Example: `SELECT timestamp, AVG(value) AS avg_value FROM table GROUP BY timestamp ORDER BY timestamp`';

    case 'text':
    case 'row':
    default:
      return 'Expected dataset: Any structure. This panel type does not require specific column structure.';
  }
}

export function DatasetRequirements({ panelType }: DatasetRequirementsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const requirements = getDatasetRequirements(panelType);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Alert className="mb-3 flex-shrink-0 border-[var(--border)] bg-[var(--surface-2)] items-start">
        <Info className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
        <AlertDescription className="text-sm text-[var(--text-secondary)] flex-1 min-w-0">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity">
            <div className="font-medium text-[var(--text-primary)]">Dataset Requirements</div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-[var(--text-secondary)] ml-2 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--text-secondary)] ml-2 flex-shrink-0" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
              {requirements}
            </pre>
          </CollapsibleContent>
        </AlertDescription>
      </Alert>
    </Collapsible>
  );
}

