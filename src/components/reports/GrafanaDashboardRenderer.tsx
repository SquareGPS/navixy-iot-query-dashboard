import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, BarChart3, PieChart, Table, Activity, TrendingUp, Pencil } from 'lucide-react';
import { GrafanaDashboard, GrafanaPanel, GrafanaQueryResult } from '@/types/grafana-dashboard';
import { apiService } from '@/services/api';
import { filterUsedParameters } from '@/utils/sqlParameterExtractor';
import { Canvas } from '@/layout/ui/Canvas';
import { PanelGrid } from '@/layout/ui/PanelGrid';
import { useEditorStore } from '@/layout/state/editorStore';
import { canonicalizeRows } from '@/layout/geometry/rows';
import { ParameterBar, ParameterValues } from './ParameterBar';
import { parseGrafanaTime, formatDateToISO } from '@/utils/grafanaTimeParser';
import { prepareParametersForBinding } from '@/utils/parameterBinder';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { chartColors } from '@/lib/chartColors';
import { TablePanel } from './TablePanel';

interface GrafanaDashboardRendererProps {
  dashboard: GrafanaDashboard;
  timeRange?: {
    from: string;
    to: string;
  };
  editMode?: boolean;
  onEditPanel?: (panel: GrafanaPanel) => void;
  onSave?: (dashboard: GrafanaDashboard) => Promise<void>;
}

export interface GrafanaDashboardRendererRef {
  refreshPanel: (panelId: number, dashboard?: GrafanaDashboard) => Promise<void>;
}

interface PanelData {
  [panelId: string]: {
    data: GrafanaQueryResult | null;
    loading: boolean;
    error: string | null;
  };
}

// Pie Chart Panel Component
const PieChartPanel = ({ data }: { data: GrafanaQueryResult }) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  if (!data.rows || data.rows.length === 0) {
    return <div className="text-gray-500">No data</div>;
  }

  const total = data.rows.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);
  
  // Process data for pie chart
  let chartData = data.rows
    .map((row, index) => ({
      name: String(row[0]),
      value: Number(row[1]) || 0,
    }))
    .sort((a, b) => b.value - a.value); // Sort by descending value

  // Limit to top 10 items, group the rest into "Other"
  const MAX_ITEMS = 10;
  if (chartData.length > MAX_ITEMS) {
    const topItems = chartData.slice(0, MAX_ITEMS);
    const remainingItems = chartData.slice(MAX_ITEMS);
    const otherValue = remainingItems.reduce((sum, item) => sum + item.value, 0);
    chartData = [...topItems, { name: 'Other', value: otherValue }];
  }

  // Calculate angles for positioning largest slice
  // Anchor angle: 240° positions largest slice in top-left quadrant
  // Increase to rotate clockwise further, decrease to rotate counter-clockwise
  const anchorDeg = 240; // Top-left quadrant
  const firstSliceAngle = chartData.length > 0 && total > 0 
    ? (chartData[0].value / total) * 360 
    : 0;
  
  // Center the largest slice at anchorDeg
  // Center = startAngle + firstSliceAngle/2, so: startAngle = anchorDeg - firstSliceAngle/2
  // To rotate clockwise: endAngle = startAngle - 360
  const startAngle = anchorDeg - (firstSliceAngle / 2);
  const endAngle = startAngle - 360;

  // Assign colors: use neutral for "Other", otherwise use palette colors
  const colors = chartData.map((entry, index) => 
    entry.name === 'Other' ? chartColors.neutral : chartColors.getColor(index)
  );

  // Active shape for hover effect
  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props;
    const enlargedOuterRadius = outerRadius * 1.05;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={enlargedOuterRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    );
  };

  // Custom tooltip content with position adjustment to avoid center
  const renderTooltipContent = (props: any) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }
    
    const data = props.payload[0];
    const value = data.value;
    const name = data.name;
    const percent = ((value / total) * 100).toFixed(1);
    
    // Get tooltip coordinates from Recharts
    // The coordinate object contains x, y (tooltip position) and cx, cy (chart center)
    const coordinate = props.coordinate || {};
    const chartCenterX = coordinate.cx ?? 0;
    const chartCenterY = coordinate.cy ?? 0;
    const tooltipX = coordinate.x ?? 0;
    const tooltipY = coordinate.y ?? 0;
    
    // Calculate distance from center
    const dx = tooltipX - chartCenterX;
    const dy = tooltipY - chartCenterY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    
    // If tooltip is too close to center (within ~80px radius), offset it outward
    const centerRadius = 80; // Increased radius to better avoid center area
    let offsetX = 0;
    let offsetY = 0;
    
    if (distanceFromCenter < centerRadius && distanceFromCenter > 0) {
      // Calculate direction vector and normalize
      const directionX = dx / distanceFromCenter;
      const directionY = dy / distanceFromCenter;
      // Push tooltip outward by the difference plus padding (increased padding)
      offsetX = directionX * (centerRadius - distanceFromCenter + 50);
      offsetY = directionY * (centerRadius - distanceFromCenter + 50);
    }
    
    return (
      <div
        className="bg-surface-1 border border-border rounded-md shadow-lg px-3 py-2"
        style={{
          backgroundColor: 'var(--surface-1)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          zIndex: 1000, // Ensure tooltip appears above center label
          position: 'relative',
        }}
      >
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {value.toFixed(1)} ({percent}%)
        </div>
      </div>
    );
  };

  // Custom legend renderer
  const renderLegend = () => {
    return (
      <div className="flex flex-col gap-3 ml-6 pr-2">
        {chartData.map((entry, index) => {
          const percent = ((entry.value / total) * 100).toFixed(1);
          return (
            <div key={`legend-${index}`} className="flex items-start gap-2">
              <div
                className="w-4 h-4 rounded-sm mt-0.5 flex-shrink-0"
                style={{ backgroundColor: colors[index] }}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-text-primary">
                  {entry.name}
                </span>
                <span className="text-xs text-text-muted">
                  {entry.value.toFixed(1)} ({percent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-4 md:gap-6 h-full w-full overflow-hidden">
      <div className="relative flex-shrink-0" style={{ 
        width: 'clamp(200px, 50%, 400px)', 
        aspectRatio: '1',
        height: '100%',
        maxHeight: '100%'
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={false}
              outerRadius="80%"
              innerRadius="44%"
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
              startAngle={startAngle}
              endAngle={endAngle}
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={250}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index]}
                  style={{
                    filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                    transition: 'filter 0.2s ease-out',
                  }}
                />
              ))}
            </Pie>
            <Tooltip 
              content={renderTooltipContent}
              wrapperStyle={{ zIndex: 1000 }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
        {/* Center label showing Total */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ 
            left: '50%', 
            top: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1 // Lower z-index than tooltip
          }}
        >
          <div className="text-sm font-semibold text-text-primary">Total</div>
          <div className="text-lg font-bold text-text-muted mt-1">
            {total.toLocaleString()}
          </div>
        </div>
      </div>
      {/* Legend on the right */}
      <div 
        className="flex-1 min-w-0 self-center relative" 
        style={{ 
          minWidth: '200px', 
          maxWidth: 'calc(50% - 1rem)',
          width: 'fit-content',
          height: 'clamp(200px, 55%, 400px)',
          maxHeight: 'clamp(200px, 55%, 400px)',
          paddingTop: '2rem',
          paddingBottom: '2rem',
          boxSizing: 'border-box'
        }}
      >
        <div 
          className="h-full overflow-y-auto overflow-x-hidden"
          style={{
            scrollPaddingTop: '2rem',
            scrollPaddingBottom: '2rem'
          }}
        >
          {renderLegend()}
        </div>
      </div>
    </div>
  );
};

export const GrafanaDashboardRenderer = forwardRef<GrafanaDashboardRendererRef, GrafanaDashboardRendererProps>(({
  dashboard,
  timeRange = { from: 'now-24h', to: 'now' },
  editMode = false,
  onEditPanel,
  onSave
}, ref) => {
  const [panelData, setPanelData] = useState<PanelData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parameterValues, setParameterValues] = useState<ParameterValues>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Initialize editor store with dashboard
  const setDashboard = useEditorStore((state) => state.setDashboard);
  const isEditingLayout = useEditorStore((state) => state.isEditingLayout);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const setSelectedPanel = useEditorStore((state) => state.setSelectedPanel);
  const storeDashboard = useEditorStore((state) => state.dashboard);
  
  // Use store dashboard if available (for layout editing), otherwise use prop dashboard
  const activeDashboard = storeDashboard || dashboard;
  
  // Track if dashboard was initialized to prevent re-initialization during layout editing
  const dashboardInitializedRef = useRef(false);
  const prevIsEditingLayoutRef = useRef(isEditingLayout);
  
  useEffect(() => {
    // Reset initialization flag when exiting layout editing mode
    // This ensures we re-initialize with the updated dashboard prop
    if (prevIsEditingLayoutRef.current && !isEditingLayout) {
      dashboardInitializedRef.current = false;
      // Clear query cache so queries re-execute with updated layout
      prevDashboardRef.current = null;
    }
    prevIsEditingLayoutRef.current = isEditingLayout;
    
    // Only initialize dashboard when not in layout editing mode
    // or when dashboard hasn't been initialized yet
    if (!isEditingLayout || !dashboardInitializedRef.current) {
      // Canonicalize rows to ensure expanded rows have children in main panels array
      const canonicalizedDashboard = canonicalizeRows(dashboard);
      setDashboard(canonicalizedDashboard);
      dashboardInitializedRef.current = true;
    }
  }, [dashboard, setDashboard, isEditingLayout]);
  
  // Use canonicalized dashboard for rendering
  const displayDashboard = React.useMemo(() => {
    // Use store dashboard if available (it gets updated when collapsing/expanding rows)
    // Otherwise use the prop dashboard
    const dashboardToUse = storeDashboard || dashboard;
    
    if (isEditingLayout) {
      return dashboardToUse;
    }
    // Canonicalize the dashboard for view mode
    return canonicalizeRows(dashboardToUse);
  }, [dashboard, storeDashboard, isEditingLayout]);
  
  // Track the previous dashboard to prevent unnecessary query re-executions
  const prevDashboardRef = useRef<string | null>(null);

  /**
   * Resolve parameter bindings from dashboard variables and time range
   * Supports ${var_name} and ${__from}/${__to} syntax
   */
  const resolveParameterBindings = useCallback((
    bindings: Record<string, string> | undefined,
    dashboard: GrafanaDashboard,
    timeRange: { from: string; to: string }
  ): Record<string, any> => {
    const resolved: Record<string, any> = {};
    
    if (!bindings) return resolved;
    
    // Helper to resolve a binding expression
    const resolveBinding = (binding: string): any => {
      // Handle ${var_name} syntax
      const varMatch = binding.match(/^\$\{([^}]+)\}$/);
      if (varMatch) {
        const varName = varMatch[1];
        
        // Handle special Grafana variables (convert to Date then ISO string)
        if (varName === '__from') {
          const date = parseGrafanaTime(timeRange.from);
          return formatDateToISO(date);
        }
        if (varName === '__to') {
          const date = parseGrafanaTime(timeRange.to);
          return formatDateToISO(date);
        }
        
        // Handle dashboard variables
        if (dashboard.templating?.list) {
          const variable = dashboard.templating.list.find(v => v.name === varName);
          if (variable?.current?.value !== undefined) {
            return variable.current.value;
          }
        }
        
        // Try dashboard-level bindings from x-navixy (recursive resolution)
        if (dashboard['x-navixy']?.parameters?.bindings?.[varName]) {
          return resolveBinding(dashboard['x-navixy'].parameters.bindings[varName]);
        }
        
        return binding; // Return as-is if not resolved
      }
      
      // Direct value (no ${})
      return binding;
    };
    
    // Resolve all bindings
    Object.entries(bindings).forEach(([key, value]) => {
      resolved[key] = resolveBinding(value);
    });
    
    return resolved;
  }, []);

  /**
   * Execute query for a single panel
   */
  const executePanelQuery = useCallback(async (
    panel: GrafanaPanel,
    dashboard: GrafanaDashboard
  ): Promise<GrafanaQueryResult | null> => {
    const navixyConfig = panel['x-navixy'];
    
    // Skip text panels - they don't need SQL queries
    if (panel.type === 'text') {
      return null;
    }
    
    if (!navixyConfig?.sql?.statement || !navixyConfig.sql.statement.trim()) {
      return null;
    }

    // Prepare parameters - start with ParameterBar values (highest priority)
    const params: Record<string, any> = {};
    
    // Use parameter values from ParameterBar (user-selected values)
    Object.entries(parameterValues).forEach(([key, value]) => {
      // Convert Date objects to ISO strings for binding
      if (value instanceof Date) {
        params[key] = formatDateToISO(value);
      } else {
        params[key] = value;
      }
    });

    // Fallback to default values from param definitions if not in ParameterBar
    if (navixyConfig.sql.params) {
      for (const [key, paramConfig] of Object.entries(navixyConfig.sql.params)) {
        if (!(key in params) && paramConfig.default !== undefined) {
          params[key] = paramConfig.default;
        }
      }
    }

    // Resolve bindings from panel-level x-navixy.sql.bindings (lower priority)
    const panelBindings = resolveParameterBindings(
      navixyConfig.sql.bindings,
      dashboard,
      timeRange
    );
    // Only add if not already set from ParameterBar
    Object.entries(panelBindings).forEach(([key, value]) => {
      if (!(key in params)) {
        params[key] = value;
      }
    });

    // Resolve bindings from dashboard-level x-navixy.parameters.bindings (lower priority)
    const dashboardBindings = resolveParameterBindings(
      dashboard['x-navixy']?.parameters?.bindings,
      dashboard,
      timeRange
    );
    // Only add if not already set from ParameterBar
    Object.entries(dashboardBindings).forEach(([key, value]) => {
      if (!(key in params)) {
        params[key] = value;
      }
    });

    // Add time range parameters (fallback if not in bindings or ParameterBar)
    // Use __from and __to (consistent with SQL parameter naming)
    if (!params.__from) {
      if (parameterValues.__from instanceof Date) {
        params.__from = formatDateToISO(parameterValues.__from);
      } else if (parameterValues.from instanceof Date) {
        params.__from = formatDateToISO(parameterValues.from);
      } else {
        const fromDate = parseGrafanaTime(timeRange.from);
        params.__from = formatDateToISO(fromDate);
      }
    }
    if (!params.__to) {
      if (parameterValues.__to instanceof Date) {
        params.__to = formatDateToISO(parameterValues.__to);
      } else if (parameterValues.to instanceof Date) {
        params.__to = formatDateToISO(parameterValues.to);
      } else {
        const toDate = parseGrafanaTime(timeRange.to);
        params.__to = formatDateToISO(toDate);
      }
    }

    // Add template variables directly (fallback if not in bindings)
    if (dashboard.templating?.list) {
      dashboard.templating.list.forEach(variable => {
        if (variable.current?.value !== undefined && !(variable.name in params)) {
          params[variable.name] = variable.current.value;
        }
      });
    }

    // Prepare parameters for binding (convert Dates, etc.)
    const preparedParams = prepareParametersForBinding(params);

    // Filter parameters to only include those actually used in the SQL
    const filteredParams = filterUsedParameters(navixyConfig.sql.statement, preparedParams);

    // Execute SQL query using the validated endpoint
    const result = await apiService.executeSQL({
      sql: navixyConfig.sql.statement,
      params: filteredParams,
      timeout_ms: navixyConfig.sql.params?.timeout_ms || 10000,
      row_limit: navixyConfig.verify?.max_rows || 1000
    });

    if (result.error) {
      throw new Error(result.error.message || 'SQL execution failed');
    }

    // Transform the response to match the expected format
    return {
      columns: result.data?.columns || [],
      rows: result.data?.rows || [],
      stats: result.data?.stats
    };
  }, [parameterValues, resolveParameterBindings, timeRange]);

  /**
   * Refresh a single panel by executing its query
   */
  const refreshPanel = useCallback(async (panelId: number, dashboardOverride?: GrafanaDashboard) => {
    const dashboardToUse = dashboardOverride || displayDashboard;
    const panel = dashboardToUse.panels.find(p => p.id === panelId);
    if (!panel) {
      return;
    }

    const navixyConfig = panel['x-navixy'];
    const hasSql = navixyConfig?.sql?.statement && navixyConfig.sql.statement.trim().length > 0;

    // Set loading state for this panel
    setPanelData(prev => ({
      ...prev,
      [panel.title]: {
        ...prev[panel.title],
        loading: hasSql && panel.type !== 'text',
        error: null
      }
    }));

    try {
      if (panel.type === 'text' || !hasSql) {
        setPanelData(prev => ({
          ...prev,
          [panel.title]: {
            data: null,
            loading: false,
            error: null
          }
        }));
        return;
      }

      const data = await executePanelQuery(panel, dashboardToUse);
      
      setPanelData(prev => ({
        ...prev,
        [panel.title]: {
          data,
          loading: false,
          error: null
        }
      }));
    } catch (err: any) {
      setPanelData(prev => ({
        ...prev,
        [panel.title]: {
          data: null,
          loading: false,
          error: err.message || 'Query execution failed'
        }
      }));
    }
  }, [displayDashboard, executePanelQuery]);

  // Expose refreshPanel via ref
  useImperativeHandle(ref, () => ({
    refreshPanel
  }), [refreshPanel]);

  // Execute SQL queries for all panels
  useEffect(() => {
    // Don't execute queries when in layout editing mode
    if (isEditingLayout) {
      return;
    }
    
    // Create a stable cache key that includes ALL panels regardless of collapse state
    // This prevents query re-execution when only collapse/expand state changes
    const createStableCacheKey = (dash: GrafanaDashboard): string => {
      // Collect all panels: top-level panels + panels from collapsed rows
      const allPanels: GrafanaPanel[] = [];
      
      dash.panels.forEach(panel => {
        if (panel.type === 'row' && panel.collapsed === true && panel.panels) {
          // For collapsed rows, include panels from row.panels[]
          allPanels.push(...panel.panels);
        } else if (panel.type !== 'row') {
          // Include all non-row panels
          allPanels.push(panel);
        }
      });
      
      // Create a stable representation: sort by ID and include only relevant properties for cache
      const stablePanels = allPanels
        .map(panel => ({
          id: panel.id,
          title: panel.title,
          type: panel.type,
          // Include SQL config for cache comparison (changes to SQL should trigger reload)
          'x-navixy': panel['x-navixy'] ? {
            sql: panel['x-navixy'].sql ? {
              statement: panel['x-navixy'].sql.statement,
              params: panel['x-navixy'].sql.params,
              bindings: panel['x-navixy'].sql.bindings,
            } : undefined,
          } : undefined,
        }))
        .sort((a, b) => (a.id || 0) - (b.id || 0));
      
      const cacheData = {
        panels: stablePanels,
        templating: dash.templating,
        'x-navixy': dash['x-navixy'] ? {
          parameters: dash['x-navixy'].parameters,
        } : undefined,
      };
      
      // Include parameterValues in cache key so queries re-execute when parameters change
      // Convert Date objects to ISO strings for consistent serialization
      const serializedParams: Record<string, unknown> = {};
      Object.entries(parameterValues).forEach(([key, value]) => {
        if (value instanceof Date) {
          serializedParams[key] = formatDateToISO(value);
        } else {
          serializedParams[key] = value;
        }
      });
      
      // Include refreshTrigger to force re-execution when Refresh is clicked
      return `${JSON.stringify(cacheData)}:${JSON.stringify(timeRange)}:${JSON.stringify(serializedParams)}:${refreshTrigger}`;
    };
    
    const cacheKey = createStableCacheKey(displayDashboard);
    
    if (prevDashboardRef.current === cacheKey) {
      // Dashboard content (excluding collapse state and layout) hasn't changed, skip query execution
      return;
    }
    
    prevDashboardRef.current = cacheKey;
    
    const executeQueries = async () => {
      setLoading(true);
      setError(null);
      
      const newPanelData: PanelData = {};
      
      // Initialize panel data
      displayDashboard.panels.forEach(panel => {
        const navixyConfig = panel['x-navixy'];
        const hasSql = navixyConfig?.sql?.statement && navixyConfig.sql.statement.trim().length > 0;
        
        // For text panels or panels without SQL, don't set loading state
        if (panel.type === 'text' || !hasSql) {
          newPanelData[panel.title] = {
            data: null,
            loading: false,
            error: null
          };
        } else {
          newPanelData[panel.title] = {
            data: null,
            loading: true,
            error: null
          };
        }
      });
      setPanelData(newPanelData);

      // Execute queries for each panel
      for (const panel of displayDashboard.panels) {
        try {
          const data = await executePanelQuery(panel, displayDashboard);
          
          if (data === null) {
            // Text panel or no SQL - mark as not loading
            const navixyConfig = panel['x-navixy'];
            const hasSql = navixyConfig?.sql?.statement && navixyConfig.sql.statement.trim().length > 0;
            newPanelData[panel.title] = {
              data: null,
              loading: false,
              error: null
            };
          } else {
            newPanelData[panel.title] = {
              data,
              loading: false,
              error: null
            };
          }
        } catch (err: any) {
          console.error(`Error executing query for panel ${panel.title}:`, err);
          newPanelData[panel.title] = {
            data: null,
            loading: false,
            error: err.message || 'Query execution failed'
          };
        }
      }

      setPanelData(newPanelData);
      setLoading(false);
    };

    executeQueries();
  }, [displayDashboard, timeRange, parameterValues, refreshTrigger, resolveParameterBindings, isEditingLayout]);

  const getPanelIcon = (panelType: string) => {
    // Map Grafana panel types to icons
    switch (panelType) {
      case 'stat':
      case 'kpi':
        return <Activity className="h-4 w-4" />;
      case 'bargauge':
      case 'barchart':
        return <BarChart3 className="h-4 w-4" />;
      case 'piechart':
        return <PieChart className="h-4 w-4" />;
      case 'table':
        return <Table className="h-4 w-4" />;
      case 'timeseries':
      case 'linechart':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const renderKpiPanel = (panel: GrafanaPanel, data: GrafanaQueryResult) => {
    if (!data.rows || data.rows.length === 0) {
      return <div className="text-gray-500">No data</div>;
    }

    const value = data.rows[0][0]; // First column, first row
    return (
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600">{value}</div>
        <div className="text-sm text-gray-500 mt-1">{panel.title}</div>
      </div>
    );
  };

  const renderBarChartPanel = (panel: GrafanaPanel, data: GrafanaQueryResult) => {
    if (!data.rows || data.rows.length === 0) {
      return <div className="text-gray-500">No data</div>;
    }

    const maxValue = Math.max(...data.rows.map(row => row[1] as number));
    
    return (
      <div className="space-y-2">
        {data.rows.map((row, index) => {
          const category = row[0];
          const value = row[1] as number;
          const percentage = (value / maxValue) * 100;
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{category}</span>
                <span className="font-medium">{value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPieChartPanel = (panel: GrafanaPanel, data: GrafanaQueryResult) => {
    return <PieChartPanel data={data} />;
  };

  const renderTablePanel = (panel: GrafanaPanel, data: GrafanaQueryResult) => {
    const visualization = panel['x-navixy']?.visualization;
    return <TablePanel data={data} visualization={visualization} />;
  };

  const renderLineChartPanel = (panel: GrafanaPanel, data: GrafanaQueryResult) => {
    if (!data.rows || data.rows.length === 0) {
      return <div className="text-gray-500">No data</div>;
    }

    // Simple line chart visualization
    // For timeseries, expect data in format: [timestamp, value] or [timestamp, series1, series2, ...]
    const maxValue = Math.max(...data.rows.flatMap(row => 
      row.slice(1).map(val => typeof val === 'number' ? val : 0)
    ));
    
    return (
      <div className="space-y-2">
        <div className="text-xs text-gray-500 mb-2">Time Series Chart</div>
        <div className="relative h-48">
          {/* Simple line chart visualization */}
          <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            {data.rows.length > 1 && data.rows.map((row, index) => {
              if (index === 0) return null;
              const prevRow = data.rows[index - 1];
              const x1 = ((index - 1) / (data.rows.length - 1)) * 400;
              const x2 = (index / (data.rows.length - 1)) * 400;
              const y1 = 200 - ((typeof prevRow[1] === 'number' ? prevRow[1] : 0) / maxValue) * 200;
              const y2 = 200 - ((typeof row[1] === 'number' ? row[1] : 0) / maxValue) * 200;
              
              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#3AA3FF"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const renderTextPanel = (panel: GrafanaPanel) => {
    // Text panels typically have content in options or a separate content field
    const content = panel.options?.content || panel.options?.text || panel.description || '';
    return (
      <div className="prose max-w-none">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  };

  const renderPanel = (panel: GrafanaPanel) => {
    const panelState = panelData[panel.title];
    const navixyConfig = panel['x-navixy'];
    const hasSql = navixyConfig?.sql?.statement && navixyConfig.sql.statement.trim().length > 0;
    
    // For text panels, they don't need SQL - render them directly
    if (panel.type === 'text') {
      return renderTextPanel(panel);
    }
    
    // Handle case where panel data hasn't been loaded yet
    if (!panelState) {
      // If panel doesn't have SQL configured, show placeholder instead of loading
      if (!hasSql) {
        return (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <div className="text-sm font-medium mb-1">No SQL configured</div>
            <div className="text-xs">Add SQL query to display data</div>
          </div>
        );
      }
      // Panel has SQL but state not initialized yet - show loading
      return (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    
    // If panel has SQL configured but is loading, show spinner
    if (panelState.loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    
    // If no SQL configured and not loading, show placeholder
    if (!hasSql && !panelState.loading) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <div className="text-sm font-medium mb-1">No SQL configured</div>
          <div className="text-xs">Add SQL query to display data</div>
        </div>
      );
    }

    if (panelState.error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{panelState.error}</AlertDescription>
        </Alert>
      );
    }

    if (!panelState.data) {
      return <div className="text-gray-500">No data available</div>;
    }

    // Map Grafana panel types to renderers
    switch (panel.type) {
      case 'stat':
      case 'kpi':
        return renderKpiPanel(panel, panelState.data);
      case 'bargauge':
      case 'barchart':
        return renderBarChartPanel(panel, panelState.data);
      case 'piechart':
        return renderPieChartPanel(panel, panelState.data);
      case 'table':
        return renderTablePanel(panel, panelState.data);
      case 'timeseries':
      case 'linechart':
        return renderLineChartPanel(panel, panelState.data);
      case 'text':
        return renderTextPanel(panel);
      default:
        return <div className="text-gray-500">Unsupported panel type: {panel.type}</div>;
    }
  };

  if (loading && Object.keys(panelData).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // If layout editing is enabled, use Canvas component
  if (isEditingLayout && editMode) {
    return (
      <div className="space-y-4">
        <Canvas
          renderPanelContent={(panel) => (
            <div>
              <div className="pb-3">
                <h3 className="flex items-center space-x-2 text-lg font-semibold">
                  {getPanelIcon(panel.type)}
                  <span>{panel.title}</span>
                </h3>
              </div>
              <div>
                {renderPanel(panel)}
              </div>
            </div>
          )}
          onDashboardChange={async (updatedDashboard) => {
            // Dashboard updated through layout editor
            // The store is already updated
            if (updatedDashboard && onSave) {
              try {
                await onSave(updatedDashboard);
              } catch (error) {
                console.error('Error saving dashboard changes:', error);
              }
            }
          }}
          onEditPanel={onEditPanel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Parameter Bar - Show if dashboard has params or time range */}
      {(dashboard['x-navixy']?.params && dashboard['x-navixy'].params.length > 0) || 
       (dashboard.time && dashboard.time.from && dashboard.time.to) ? (
        <ParameterBar
          dashboard={dashboard}
          values={parameterValues}
          onChange={(newValues) => {
            setParameterValues(newValues);
            // Increment refresh trigger to force query re-execution
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      ) : null}

      {/* Panels Grid - uses same 24-column system as edit mode */}
      <PanelGrid
        panels={displayDashboard.panels}
        renderPanel={(panel) => {
          // Add panel title and icon
          return (
            <>
              <div className="pb-3 flex-shrink-0">
                <h3 className="flex items-center space-x-2 text-lg font-semibold">
                  {getPanelIcon(panel.type)}
                  <span>{panel.title}</span>
                </h3>
              </div>
              <div className="flex-1 overflow-auto relative">
                {renderPanel(panel)}
                {/* Edit Button */}
                {editMode && onEditPanel && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPanel(panel);
                    }}
                    className="absolute top-2 right-2 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-50 opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          );
        }}
        enableDrag={false}
        selectedPanelId={selectedPanelId}
        onSelectPanel={setSelectedPanel}
        editMode={editMode}
        onEditPanel={onEditPanel}
      />
    </div>
  );
});

GrafanaDashboardRenderer.displayName = 'GrafanaDashboardRenderer';
