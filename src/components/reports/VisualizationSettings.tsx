import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PanelType, VisualizationConfig } from '@/types/dashboard-types';
import { useLocale } from '@/i18n/LocaleProvider';

interface VisualizationSettingsProps {
  panelType: PanelType;
  visualization: VisualizationConfig | undefined;
  onChange: (visualization: VisualizationConfig) => void;
}

export function VisualizationSettings({ panelType, visualization, onChange }: VisualizationSettingsProps) {
  const { t } = useLocale();
  const settings = visualization || {};

  const updateSetting = <K extends keyof VisualizationConfig>(
    key: K,
    value: VisualizationConfig[K]
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
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('report_view.visualization_settings.table_display.header.title')}</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showHeader" className="text-sm font-medium">
                {t('report_view.visualization_settings.table_display.show_header_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.table_display.show_header_toggle.sublabel')}
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
                {t('report_view.visualization_settings.table_display.sortable_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.table_display.sortable_toggle.sublabel')}
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
                {t('report_view.visualization_settings.table_display.show_pagination_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.table_display.show_pagination_toggle.sublabel')}
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
                {t('report_view.visualization_settings.table_display.show_totals_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.table_display.show_totals_toggle.sublabel')}
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
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('report_view.visualization_settings.table_config.header.title')}</h3>

          <div>
            <Label htmlFor="pageSize" className="text-sm font-medium">
              {t('report_view.visualization_settings.table_config.page_size_input.label')}
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
              {t('report_view.visualization_settings.table_config.page_size_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="columnWidth" className="text-sm font-medium">
              {t('report_view.visualization_settings.table_config.column_width_input.label')}
            </Label>
            <Select
              value={settings.columnWidth || 'auto'}
              onValueChange={(value: 'auto' | 'equal' | 'fit') => updateSetting('columnWidth', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('report_view.visualization_settings.table_config.column_width_input.auto_option.menu_item')}</SelectItem>
                <SelectItem value="equal">{t('report_view.visualization_settings.table_config.column_width_input.equal_option.menu_item')}</SelectItem>
                <SelectItem value="fit">{t('report_view.visualization_settings.table_config.column_width_input.fit_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.table_config.column_width_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="rowHighlighting" className="text-sm font-medium">
              {t('report_view.visualization_settings.table_config.row_highlighting_input.label')}
            </Label>
            <Select
              value={settings.rowHighlighting || 'none'}
              onValueChange={(value: 'none' | 'alternating' | 'hover' | 'both') => updateSetting('rowHighlighting', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('report_view.visualization_settings.table_config.row_highlighting_input.none_option.menu_item')}</SelectItem>
                <SelectItem value="alternating">{t('report_view.visualization_settings.table_config.row_highlighting_input.alternating_option.menu_item')}</SelectItem>
                <SelectItem value="hover">{t('report_view.visualization_settings.table_config.row_highlighting_input.hover_option.menu_item')}</SelectItem>
                <SelectItem value="both">{t('report_view.visualization_settings.table_config.row_highlighting_input.both_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.table_config.row_highlighting_input.input_hint.instruction')}
            </p>
          </div>

          {settings.showTotals && (
            <div>
              <Label htmlFor="totalsRow" className="text-sm font-medium">
                {t('report_view.visualization_settings.table_config.totals_row_input.label')}
              </Label>
              <Select
                value={settings.totalsRow || 'bottom'}
                onValueChange={(value: 'top' | 'bottom') => updateSetting('totalsRow', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">{t('report_view.visualization_settings.table_config.totals_row_input.top_option.menu_item')}</SelectItem>
                  <SelectItem value="bottom">{t('report_view.visualization_settings.table_config.totals_row_input.bottom_option.menu_item')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('report_view.visualization_settings.table_config.totals_row_input.input_hint.instruction')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Bar chart-specific settings
  if (panelType === 'barchart' || panelType === 'bargauge') {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('report_view.visualization_settings.bar_display.header.title')}</h3>

          <div>
            <Label htmlFor="orientation" className="text-sm font-medium">
              {t('report_view.visualization_settings.bar_display.orientation_input.label')}
            </Label>
            {/*
              NOTE: Orientation is hardcoded to 'vertical' for now.
              Horizontal bar charts have rendering issues with Recharts that need to be resolved.
              The renderer ignores the orientation setting and always renders vertical bars.
              See DashboardRenderer.tsx renderBarChartPanel for details.
            */}
            <div className="mt-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-sm text-[var(--text-secondary)]">
              {t('report_view.visualization_settings.bar_display.orientation_input.vertical_value.label')}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.bar_display.orientation_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="stacking" className="text-sm font-medium">
              {t('report_view.visualization_settings.bar_display.stacking_input.label')}
            </Label>
            <Select
              value={settings.stacking || 'none'}
              onValueChange={(value: 'none' | 'stacked' | 'percent') => updateSetting('stacking', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('report_view.visualization_settings.bar_display.stacking_input.none_option.menu_item')}</SelectItem>
                <SelectItem value="stacked">{t('report_view.visualization_settings.bar_display.stacking_input.stacked_option.menu_item')}</SelectItem>
                <SelectItem value="percent">{t('report_view.visualization_settings.bar_display.stacking_input.percent_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.bar_display.stacking_input.input_hint.instruction')}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showValues" className="text-sm font-medium">
                {t('report_view.visualization_settings.bar_display.show_values_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.bar_display.show_values_toggle.sublabel')}
              </p>
            </div>
            <Switch
              id="showValues"
              checked={settings.showValues === true}
              onCheckedChange={(checked) => updateSetting('showValues', checked)}
            />
          </div>

          <div>
            <Label htmlFor="sortOrder" className="text-sm font-medium">
              {t('report_view.visualization_settings.bar_display.sort_order_input.label')}
            </Label>
            <Select
              value={settings.sortOrder || 'none'}
              onValueChange={(value: 'asc' | 'desc' | 'none') => updateSetting('sortOrder', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('report_view.visualization_settings.bar_display.sort_order_input.none_option.menu_item')}</SelectItem>
                <SelectItem value="asc">{t('report_view.visualization_settings.bar_display.sort_order_input.asc_option.menu_item')}</SelectItem>
                <SelectItem value="desc">{t('report_view.visualization_settings.bar_display.sort_order_input.desc_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.bar_display.sort_order_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="barSpacing" className="text-sm font-medium">
              {t('report_view.visualization_settings.bar_display.bar_spacing_input.label')}
            </Label>
            <Input
              id="barSpacing"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={settings.barSpacing !== undefined ? settings.barSpacing : 0.2}
              onChange={(e) => updateSetting('barSpacing', parseFloat(e.target.value) || 0.2)}
              className="mt-1"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.bar_display.bar_spacing_input.input_hint.instruction')}
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('report_view.visualization_settings.color_legend.header.title')}</h3>

          <div>
            <Label htmlFor="colorPalette" className="text-sm font-medium">
              {t('report_view.visualization_settings.color_legend.color_palette_input.label')}
            </Label>
            <Select
              value={settings.colorPalette || 'classic'}
              onValueChange={(value: 'classic' | 'modern' | 'pastel' | 'vibrant') => updateSetting('colorPalette', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">{t('report_view.visualization_settings.color_legend.color_palette_input.classic_option.menu_item')}</SelectItem>
                <SelectItem value="modern">{t('report_view.visualization_settings.color_legend.color_palette_input.modern_option.menu_item')}</SelectItem>
                <SelectItem value="pastel">{t('report_view.visualization_settings.color_legend.color_palette_input.pastel_option.menu_item')}</SelectItem>
                <SelectItem value="vibrant">{t('report_view.visualization_settings.color_legend.color_palette_input.vibrant_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.color_legend.color_palette_input.input_hint.instruction')}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showLegend" className="text-sm font-medium">
                {t('report_view.visualization_settings.color_legend.show_legend_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.color_legend.show_legend_toggle.sublabel')}
              </p>
            </div>
            <Switch
              id="showLegend"
              checked={settings.showLegend !== false}
              onCheckedChange={(checked) => updateSetting('showLegend', checked)}
            />
          </div>

          {settings.showLegend !== false && (
            <div>
              <Label htmlFor="legendPosition" className="text-sm font-medium">
                {t('report_view.visualization_settings.color_legend.legend_position_input.label')}
              </Label>
              <Select
                value={settings.legendPosition || 'bottom'}
                onValueChange={(value: 'top' | 'bottom' | 'left' | 'right') => updateSetting('legendPosition', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">{t('report_view.visualization_settings.color_legend.legend_position_input.top_option.menu_item')}</SelectItem>
                  <SelectItem value="bottom">{t('report_view.visualization_settings.color_legend.legend_position_input.bottom_option.menu_item')}</SelectItem>
                  <SelectItem value="left">{t('report_view.visualization_settings.color_legend.legend_position_input.left_option.menu_item')}</SelectItem>
                  <SelectItem value="right">{t('report_view.visualization_settings.color_legend.legend_position_input.right_option.menu_item')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('report_view.visualization_settings.color_legend.legend_position_input.input_hint.instruction')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Line chart-specific settings
  if (panelType === 'linechart' || panelType === 'timeseries') {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('report_view.visualization_settings.line_display.header.title')}</h3>

          <div>
            <Label htmlFor="lineStyle" className="text-sm font-medium">
              {t('report_view.visualization_settings.line_display.line_style_input.label')}
            </Label>
            <Select
              value={settings.lineStyle || 'solid'}
              onValueChange={(value: 'solid' | 'dashed' | 'dotted') => updateSetting('lineStyle', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">{t('report_view.visualization_settings.line_display.line_style_input.solid_option.menu_item')}</SelectItem>
                <SelectItem value="dashed">{t('report_view.visualization_settings.line_display.line_style_input.dashed_option.menu_item')}</SelectItem>
                <SelectItem value="dotted">{t('report_view.visualization_settings.line_display.line_style_input.dotted_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.line_display.line_style_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="lineWidth" className="text-sm font-medium">
              {t('report_view.visualization_settings.line_display.line_width_input.label')}
            </Label>
            <Input
              id="lineWidth"
              type="number"
              min={1}
              max={10}
              step={1}
              value={settings.lineWidth !== undefined ? settings.lineWidth : 2}
              onChange={(e) => updateSetting('lineWidth', parseInt(e.target.value) || 2)}
              className="mt-1"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.line_display.line_width_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="showPoints" className="text-sm font-medium">
              {t('report_view.visualization_settings.line_display.show_points_input.label')}
            </Label>
            <Select
              value={settings.showPoints || 'auto'}
              onValueChange={(value: 'always' | 'auto' | 'never') => updateSetting('showPoints', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">{t('report_view.visualization_settings.line_display.show_points_input.always_option.menu_item')}</SelectItem>
                <SelectItem value="auto">{t('report_view.visualization_settings.line_display.show_points_input.auto_option.menu_item')}</SelectItem>
                <SelectItem value="never">{t('report_view.visualization_settings.line_display.show_points_input.never_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.line_display.show_points_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="pointSize" className="text-sm font-medium">
              {t('report_view.visualization_settings.line_display.point_size_input.label')}
            </Label>
            <Input
              id="pointSize"
              type="number"
              min={1}
              max={20}
              step={1}
              value={settings.pointSize !== undefined ? settings.pointSize : 5}
              onChange={(e) => updateSetting('pointSize', parseInt(e.target.value) || 5)}
              className="mt-1"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.line_display.point_size_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="interpolation" className="text-sm font-medium">
              {t('report_view.visualization_settings.line_display.interpolation_input.label')}
            </Label>
            <Select
              value={settings.interpolation || 'linear'}
              onValueChange={(value: 'linear' | 'step' | 'smooth') => updateSetting('interpolation', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">{t('report_view.visualization_settings.line_display.interpolation_input.linear_option.menu_item')}</SelectItem>
                <SelectItem value="step">{t('report_view.visualization_settings.line_display.interpolation_input.step_option.menu_item')}</SelectItem>
                <SelectItem value="smooth">{t('report_view.visualization_settings.line_display.interpolation_input.smooth_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.line_display.interpolation_input.input_hint.instruction')}
            </p>
          </div>

          <div>
            <Label htmlFor="fillArea" className="text-sm font-medium">
              {t('report_view.visualization_settings.line_display.fill_area_input.label')}
            </Label>
            <Select
              value={settings.fillArea || 'none'}
              onValueChange={(value: 'none' | 'below' | 'above') => updateSetting('fillArea', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('report_view.visualization_settings.line_display.fill_area_input.none_option.menu_item')}</SelectItem>
                <SelectItem value="below">{t('report_view.visualization_settings.line_display.fill_area_input.below_option.menu_item')}</SelectItem>
                <SelectItem value="above">{t('report_view.visualization_settings.line_display.fill_area_input.above_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.line_display.fill_area_input.input_hint.instruction')}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showGrid" className="text-sm font-medium">
                {t('report_view.visualization_settings.line_display.show_grid_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.line_display.show_grid_toggle.sublabel')}
              </p>
            </div>
            <Switch
              id="showGrid"
              checked={settings.showGrid !== false}
              onCheckedChange={(checked) => updateSetting('showGrid', checked)}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('report_view.visualization_settings.color_legend.header.title')}</h3>

          <div>
            <Label htmlFor="colorPalette" className="text-sm font-medium">
              {t('report_view.visualization_settings.color_legend.color_palette_input.label')}
            </Label>
            <Select
              value={settings.colorPalette || 'classic'}
              onValueChange={(value: 'classic' | 'modern' | 'pastel' | 'vibrant') => updateSetting('colorPalette', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">{t('report_view.visualization_settings.color_legend.color_palette_input.classic_option.menu_item')}</SelectItem>
                <SelectItem value="modern">{t('report_view.visualization_settings.color_legend.color_palette_input.modern_option.menu_item')}</SelectItem>
                <SelectItem value="pastel">{t('report_view.visualization_settings.color_legend.color_palette_input.pastel_option.menu_item')}</SelectItem>
                <SelectItem value="vibrant">{t('report_view.visualization_settings.color_legend.color_palette_input.vibrant_option.menu_item')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('report_view.visualization_settings.color_legend.color_palette_input.input_hint.instruction')}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showLegend" className="text-sm font-medium">
                {t('report_view.visualization_settings.color_legend.show_legend_toggle.label')}
              </Label>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('report_view.visualization_settings.color_legend.show_legend_toggle.sublabel')}
              </p>
            </div>
            <Switch
              id="showLegend"
              checked={settings.showLegend !== false}
              onCheckedChange={(checked) => updateSetting('showLegend', checked)}
            />
          </div>

          {settings.showLegend !== false && (
            <div>
              <Label htmlFor="legendPosition" className="text-sm font-medium">
                {t('report_view.visualization_settings.color_legend.legend_position_input.label')}
              </Label>
              <Select
                value={settings.legendPosition || 'bottom'}
                onValueChange={(value: 'top' | 'bottom' | 'left' | 'right') => updateSetting('legendPosition', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">{t('report_view.visualization_settings.color_legend.legend_position_input.top_option.menu_item')}</SelectItem>
                  <SelectItem value="bottom">{t('report_view.visualization_settings.color_legend.legend_position_input.bottom_option.menu_item')}</SelectItem>
                  <SelectItem value="left">{t('report_view.visualization_settings.color_legend.legend_position_input.left_option.menu_item')}</SelectItem>
                  <SelectItem value="right">{t('report_view.visualization_settings.color_legend.legend_position_input.right_option.menu_item')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('report_view.visualization_settings.color_legend.legend_position_input.input_hint.instruction')}
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
        {t('report_view.visualization_settings.unsupported.paragraph', { type: panelType })}
      </p>
    </div>
  );
}
