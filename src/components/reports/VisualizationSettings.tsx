import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { GrafanaPanelType, NavixyVisualizationConfig } from '@/types/grafana-dashboard';

interface VisualizationSettingsProps {
  panelType: GrafanaPanelType;
  visualization: NavixyVisualizationConfig | undefined;
  onChange: (visualization: NavixyVisualizationConfig) => void;
}

export function VisualizationSettings({ panelType, visualization, onChange }: VisualizationSettingsProps) {
  const settings = visualization || {};

  const updateSetting = <K extends keyof NavixyVisualizationConfig>(
    key: K,
    value: NavixyVisualizationConfig[K]
  ) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  // Table-specific settings
  if (panelType === 'table') {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Table Display Options</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showHeader" className="text-sm font-medium">
                Show Header
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                Display column headers
              </p>
            </div>
            <Switch
              id="showHeader"
              checked={settings.showHeader !== false}
              onCheckedChange={(checked) => updateSetting('showHeader', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sortable" className="text-sm font-medium">
                Sortable Columns
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                Enable column sorting
              </p>
            </div>
            <Switch
              id="sortable"
              checked={settings.sortable !== false}
              onCheckedChange={(checked) => updateSetting('sortable', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showPagination" className="text-sm font-medium">
                Show Pagination
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                Display pagination controls
              </p>
            </div>
            <Switch
              id="showPagination"
              checked={settings.showPagination !== false}
              onCheckedChange={(checked) => updateSetting('showPagination', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showTotals" className="text-sm font-medium">
                Show Totals Row
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                Display totals row at the bottom or top
              </p>
            </div>
            <Switch
              id="showTotals"
              checked={settings.showTotals === true}
              onCheckedChange={(checked) => updateSetting('showTotals', checked)}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Table Configuration</h3>
          
          <div>
            <Label htmlFor="pageSize" className="text-sm font-medium">
              Rows per Page
            </Label>
            <Input
              id="pageSize"
              type="number"
              min={1}
              max={1000}
              value={settings.pageSize || 25}
              onChange={(e) => updateSetting('pageSize', parseInt(e.target.value) || 25)}
              className="mt-1"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Number of rows displayed per page (default: 25)
            </p>
          </div>

          <div>
            <Label htmlFor="columnWidth" className="text-sm font-medium">
              Column Width Strategy
            </Label>
            <Select
              value={settings.columnWidth || 'auto'}
              onValueChange={(value: 'auto' | 'equal' | 'fit') => updateSetting('columnWidth', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="equal">Equal</SelectItem>
                <SelectItem value="fit">Fit Content</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              How column widths are determined (default: auto)
            </p>
          </div>

          <div>
            <Label htmlFor="rowHighlighting" className="text-sm font-medium">
              Row Highlighting
            </Label>
            <Select
              value={settings.rowHighlighting || 'none'}
              onValueChange={(value: 'none' | 'alternating' | 'hover' | 'both') => updateSetting('rowHighlighting', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="alternating">Alternating Rows</SelectItem>
                <SelectItem value="hover">On Hover</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Row highlighting mode (default: none)
            </p>
          </div>

          {settings.showTotals && (
            <div>
              <Label htmlFor="totalsRow" className="text-sm font-medium">
                Totals Row Position
              </Label>
              <Select
                value={settings.totalsRow || 'bottom'}
                onValueChange={(value: 'top' | 'bottom') => updateSetting('totalsRow', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Position of the totals row (default: bottom)
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Placeholder for other panel types
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Visualization settings for {panelType} panels are not yet implemented.
      </p>
    </div>
  );
}

