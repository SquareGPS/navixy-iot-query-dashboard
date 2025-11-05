import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface PanelData {
  [panelId: string]: {
    data: GrafanaQueryResult | null;
    loading: boolean;
    error: string | null;
  };
}

export const GrafanaDashboardRenderer: React.FC<GrafanaDashboardRendererProps> = ({
  dashboard,
  timeRange = { from: 'now-24h', to: 'now' },
  editMode = false,
  onEditPanel,
  onSave
}) => {
  const [panelData, setPanelData] = useState<PanelData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
        
        // Handle special Grafana variables
        if (varName === '__from') {
          return timeRange.from;
        }
        if (varName === '__to') {
          return timeRange.to;
        }
        
        // Handle dashboard variables
        if (dashboard.templating?.list) {
          const variable = dashboard.templating.list.find(v => v.name === varName);
          if (variable?.current?.value !== undefined) {
            return variable.current.value;
          }
        }
        
        // Try dashboard-level bindings from x-navixy
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
      
      return `${JSON.stringify(cacheData)}:${JSON.stringify(timeRange)}`;
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
          const navixyConfig = panel['x-navixy'];
          
          // Skip text panels - they don't need SQL queries
          if (panel.type === 'text') {
            continue;
          }
          
          if (!navixyConfig?.sql?.statement || !navixyConfig.sql.statement.trim()) {
            // Panel doesn't have SQL configured - don't show error, just mark as not loading
            newPanelData[panel.title] = {
              data: null,
              loading: false,
              error: null
            };
            continue;
          }

          // Prepare parameters
          const params: Record<string, any> = {};
          
          // Start with default values from param definitions
          if (navixyConfig.sql.params) {
            for (const [key, paramConfig] of Object.entries(navixyConfig.sql.params)) {
              if (paramConfig.default !== undefined) {
                params[key] = paramConfig.default;
              }
            }
          }

          // Resolve bindings from panel-level x-navixy.sql.bindings
          const panelBindings = resolveParameterBindings(
            navixyConfig.sql.bindings,
            displayDashboard,
            timeRange
          );
          Object.assign(params, panelBindings);

          // Resolve bindings from dashboard-level x-navixy.parameters.bindings
          const dashboardBindings = resolveParameterBindings(
            displayDashboard['x-navixy']?.parameters?.bindings,
            displayDashboard,
            timeRange
          );
          Object.assign(params, dashboardBindings);

          // Add time range parameters (fallback if not in bindings)
          if (!params.from) params.from = timeRange.from;
          if (!params.to) params.to = timeRange.to;

          // Add template variables directly (fallback if not in bindings)
          if (displayDashboard.templating?.list) {
            displayDashboard.templating.list.forEach(variable => {
              if (variable.current?.value !== undefined && !(variable.name in params)) {
                params[variable.name] = variable.current.value;
              }
            });
          }

          // Filter parameters to only include those actually used in the SQL
          const filteredParams = filterUsedParameters(navixyConfig.sql.statement, params);

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
          const transformedData = {
            columns: result.data?.columns || [],
            rows: result.data?.rows || [],
            stats: result.data?.stats
          };

          newPanelData[panel.title] = {
            data: transformedData,
            loading: false,
            error: null
          };
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
  }, [displayDashboard, timeRange, resolveParameterBindings, isEditingLayout]);

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
    if (!data.rows || data.rows.length === 0) {
      return <div className="text-gray-500">No data</div>;
    }

    const total = data.rows.reduce((sum, row) => sum + (row[1] as number), 0);
    
    return (
      <div className="space-y-2">
        {data.rows.map((row, index) => {
          const category = row[0];
          const value = row[1] as number;
          const percentage = ((value / total) * 100).toFixed(1);
          
          return (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)` 
                  }}
                />
                <span>{category}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{value}</div>
                <div className="text-xs text-gray-500">{percentage}%</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTablePanel = (panel: GrafanaPanel, data: GrafanaQueryResult) => {
    if (!data.rows || data.rows.length === 0) {
      return <div className="text-gray-500">No data</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {data.columns.map((column, index) => (
                <th key={index} className="text-left py-2 px-3 font-medium text-gray-700">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b hover:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="py-2 px-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
};
