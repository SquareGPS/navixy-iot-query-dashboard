import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, BarChart3, PieChart, Table, Activity, TrendingUp, Pencil, Move } from 'lucide-react';
import { GrafanaDashboard, GrafanaPanel, GrafanaQueryResult } from '@/types/grafana-dashboard';
import { apiService } from '@/services/api';
import { filterUsedParameters } from '@/utils/sqlParameterExtractor';
import { Canvas } from '@/layout/ui/Canvas';
import { PanelGrid } from '@/layout/ui/PanelGrid';
import { useEditorStore } from '@/layout/state/editorStore';
import { toggleLayoutEditing } from '@/layout/state/commands';
import { Button } from '@/components/ui/Button';

interface GrafanaDashboardRendererProps {
  dashboard: GrafanaDashboard;
  timeRange?: {
    from: string;
    to: string;
  };
  editMode?: boolean;
  onEditPanel?: (panel: GrafanaPanel) => void;
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
  onEditPanel
}) => {
  const [panelData, setPanelData] = useState<PanelData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize editor store with dashboard
  const setDashboard = useEditorStore((state) => state.setDashboard);
  const isEditingLayout = useEditorStore((state) => state.isEditingLayout);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const setSelectedPanel = useEditorStore((state) => state.setSelectedPanel);
  
  useEffect(() => {
    setDashboard(dashboard);
  }, [dashboard, setDashboard]);
  
  // Track the previous dashboard to prevent unnecessary query re-executions
  const prevDashboardRef = useRef<string | null>(null);

  // Execute SQL queries for all panels
  useEffect(() => {
    // Check if dashboard has actually changed by comparing JSON strings
    const dashboardJson = JSON.stringify(dashboard);
    const timeRangeJson = JSON.stringify(timeRange);
    const cacheKey = `${dashboardJson}:${timeRangeJson}`;
    
    if (prevDashboardRef.current === cacheKey) {
      // Dashboard and timeRange haven't changed, skip query execution
      return;
    }
    
    prevDashboardRef.current = cacheKey;
    
    const executeQueries = async () => {
      setLoading(true);
      setError(null);
      
      const newPanelData: PanelData = {};
      
      // Initialize panel data
      dashboard.panels.forEach(panel => {
        newPanelData[panel.title] = {
          data: null,
          loading: true,
          error: null
        };
      });
      setPanelData(newPanelData);

      // Execute queries for each panel
      for (const panel of dashboard.panels) {
        try {
          const navixyConfig = panel['x-navixy'];
          if (!navixyConfig?.sql) {
            newPanelData[panel.title] = {
              data: null,
              loading: false,
              error: 'No SQL configuration found'
            };
            continue;
          }

          // Prepare parameters
          const params: Record<string, any> = {};
          if (navixyConfig.sql.params) {
            for (const [key, paramConfig] of Object.entries(navixyConfig.sql.params)) {
              if (paramConfig.default !== undefined) {
                params[key] = paramConfig.default;
              }
            }
          }

          // Add time range parameters
          params.from = timeRange.from;
          params.to = timeRange.to;

          // Add template variables
          if (dashboard.templating?.list) {
            dashboard.templating.list.forEach(variable => {
              if (variable.current?.value) {
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
  }, [dashboard, timeRange]);

  const getPanelIcon = (panelType: string) => {
    switch (panelType) {
      case 'kpi':
        return <Activity className="h-4 w-4" />;
      case 'barchart':
        return <BarChart3 className="h-4 w-4" />;
      case 'piechart':
        return <PieChart className="h-4 w-4" />;
      case 'table':
        return <Table className="h-4 w-4" />;
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

  const renderPanel = (panel: GrafanaPanel) => {
    const panelState = panelData[panel.title];
    
    // Handle case where panel data hasn't been loaded yet
    if (!panelState) {
      return (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    
    if (panelState.loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
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

    switch (panel.type) {
      case 'kpi':
        return renderKpiPanel(panel, panelState.data);
      case 'barchart':
        return renderBarChartPanel(panel, panelState.data);
      case 'piechart':
        return renderPieChartPanel(panel, panelState.data);
      case 'table':
        return renderTablePanel(panel, panelState.data);
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Layout Editor</h2>
          <Button
            variant="secondary"
            onClick={toggleLayoutEditing}
          >
            <Move className="h-4 w-4 mr-2" />
            Exit Layout Mode
          </Button>
        </div>
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
          onDashboardChange={(updatedDashboard) => {
            // Dashboard updated through layout editor
            // The store is already updated
            if (updatedDashboard) {
              // Can trigger parent update if needed
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {editMode && (
        <div className="flex items-center justify-end">
          <Button
            variant="secondary"
            onClick={toggleLayoutEditing}
          >
            <Move className="h-4 w-4 mr-2" />
            Edit Layout
          </Button>
        </div>
      )}
      {/* Panels Grid - uses same 24-column system as edit mode */}
      <PanelGrid
        panels={dashboard.panels}
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
