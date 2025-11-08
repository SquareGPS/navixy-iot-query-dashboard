/**
 * React Adapter for Navixy Renderer
 * Provides React hooks and components for the renderer
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { DashboardRuntime, PanelContext, StoreEvent } from './runtime-types';
import { DashboardLoader } from './runtime/DashboardLoader';
import { VariableResolver } from './runtime/VariableResolver';
import { Planner } from './runtime/Planner';
import { QueryClient } from './runtime/QueryClient';
import { PanelRegistry } from './runtime/PanelRegistry';
import { 
  KpiHandler, 
  TableHandler, 
  BarChartHandler, 
  PieChartHandler, 
  LineChartHandler, 
  AnnotationHandler 
} from './runtime/PanelHandlers';

// Register default panel handlers
PanelRegistry.register('kpi', KpiHandler);
PanelRegistry.register('stat', KpiHandler); // Alias for KPI
PanelRegistry.register('table', TableHandler);
PanelRegistry.register('barchart', BarChartHandler);
PanelRegistry.register('piechart', PieChartHandler);
PanelRegistry.register('linechart', LineChartHandler);
PanelRegistry.register('text', AnnotationHandler);

// Context for dashboard runtime
const DashboardContext = createContext<DashboardRuntime | null>(null);

// Hook to use dashboard context
export function useDashboard(): DashboardRuntime {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

// Hook to use individual panel
export function usePanel(panelId: string) {
  const dashboard = useDashboard();
  const [panel, setPanel] = useState<PanelContext | undefined>(
    dashboard.panels.get(panelId)
  );

  useEffect(() => {
    const subscription = dashboard.store.subscribe((event: StoreEvent) => {
      if (event.panelId === panelId) {
        setPanel(dashboard.panels.get(panelId));
      }
    });

    return () => subscription.unsubscribe();
  }, [dashboard, panelId]);

  return panel;
}

// Hook to use variables
export function useVariables() {
  const dashboard = useDashboard();
  const [variables, setVariables] = useState(dashboard.context.vars);

  const updateVariable = useCallback((name: string, value: unknown) => {
    const newVars = { ...variables, [name]: value };
    setVariables(newVars);
    dashboard.actions.updateVariables(newVars);
  }, [dashboard, variables]);

  return {
    variables,
    updateVariable,
    updateVariables: dashboard.actions.updateVariables
  };
}

// Main Dashboard Provider Component
interface DashboardProviderProps {
  children: React.ReactNode;
  dashboardJson: string;
  timeRange?: { from: Date; to: Date };
  variables?: Record<string, unknown>;
  userContext?: Record<string, unknown>;
}

export function DashboardProvider({ 
  children, 
  dashboardJson, 
  timeRange = { from: new Date(Date.now() - 24 * 60 * 60 * 1000), to: new Date() },
  variables = {},
  userContext = {}
}: DashboardProviderProps) {
  const [runtime, setRuntime] = useState<DashboardRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        // Parse dashboard JSON
        const dashboard = DashboardLoader.parse(dashboardJson);
        
        // Build runtime model
        const { panels, context } = DashboardLoader.buildRuntimeModel(dashboard);
        
        // Resolve variables
        const resolvedVars = VariableResolver.resolve(
          dashboard.dashboard.templating.list,
          timeRange,
          {},
          { ...variables, ...userContext }
        );

        // Create runtime
        const runtime: DashboardRuntime = {
          dashboard,
          context: {
            ...context,
            time: timeRange,
            vars: resolvedVars,
            bindings: resolvedVars
          } as any,
          panels,
          store: {
            getState: (panelId: string) => panels.get(panelId),
            setState: (panelId: string, state: any) => {
              const panel = panels.get(panelId);
              if (panel) {
                panel.state = state;
                panels.set(panelId, panel);
              }
            },
            setData: (panelId: string, data: any) => {
              const panel = panels.get(panelId);
              if (panel) {
                panel.data = data;
                panel.state = 'ready';
                panels.set(panelId, panel);
              }
            },
            setError: (panelId: string, error: any) => {
              const panel = panels.get(panelId);
              if (panel) {
                panel.error = error;
                panel.state = 'error';
                panels.set(panelId, panel);
              }
            },
            subscribe: (callback: (event: StoreEvent) => void) => {
              // Simple subscription implementation
              return { unsubscribe: () => {} };
            }
          },
          actions: {
            loadDashboard: async (json: string) => {
              // Implementation for reloading dashboard
            },
            updateTimeRange: async (from: Date, to: Date) => {
              // Implementation for updating time range
            },
            updateVariables: async (vars: Record<string, unknown>) => {
              // Implementation for updating variables
            },
            refreshPanel: async (panelId: string) => {
              // Implementation for refreshing single panel
            },
            refreshAll: async () => {
              // Implementation for refreshing all panels
            }
          }
        };

        setRuntime(runtime);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [dashboardJson, timeRange, variables, userContext]);

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="dashboard-error">Error: {error}</div>;
  }

  if (!runtime) {
    return <div className="dashboard-error">Failed to initialize dashboard</div>;
  }

  return (
    <DashboardContext.Provider value={runtime}>
      {children}
    </DashboardContext.Provider>
  );
}

// Panel Renderer Component
interface PanelRendererProps {
  panelId: string;
  className?: string;
}

export function PanelRenderer({ panelId, className }: PanelRendererProps) {
  const panel = usePanel(panelId);
  const mountRef = useRef<HTMLDivElement>(null);
  const [dispose, setDispose] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!panel || !mountRef.current) return;

    // Clean up previous render
    if (dispose) {
      dispose();
      setDispose(null);
    }

    // Render panel based on state
    switch (panel.state) {
      case 'loading':
        mountRef.current.innerHTML = '<div class="panel-loading">Loading...</div>';
        break;
      case 'error':
        mountRef.current.innerHTML = `<div class="panel-error">Error: ${panel.error?.message || 'Unknown error'}</div>`;
        break;
      case 'empty':
        mountRef.current.innerHTML = '<div class="panel-empty">No data available</div>';
        break;
      case 'ready':
        if (panel.data) {
          const cleanup = PanelRegistry.render(panel.type, mountRef.current, panel.data, panel.props);
          if (cleanup) {
            setDispose(() => cleanup);
          }
        }
        break;
      default:
        mountRef.current.innerHTML = '<div class="panel-idle">Waiting...</div>';
    }
  }, [panel, dispose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dispose) {
        dispose();
      }
    };
  }, [dispose]);

  return (
    <div 
      ref={mountRef} 
      className={`panel-renderer ${className || ''}`}
      data-panel-id={panelId}
      data-panel-state={panel?.state}
    />
  );
}

// Dashboard Renderer Component
interface DashboardRendererProps {
  className?: string;
}

export function DashboardRenderer({ className }: DashboardRendererProps) {
  const dashboard = useDashboard();

  return (
    <div className={`dashboard-renderer ${className || ''}`}>
      <div className="dashboard-title">
        <h1>{dashboard.dashboard.dashboard.title}</h1>
        {dashboard.dashboard.dashboard.description && (
          <p className="dashboard-description">{dashboard.dashboard.dashboard.description}</p>
        )}
      </div>
      
      <div className="dashboard-panels">
        {Array.from(dashboard.panels.values()).map(panel => (
          <PanelRenderer 
            key={panel.id} 
            panelId={panel.id}
            className="dashboard-panel"
          />
        ))}
      </div>
    </div>
  );
}

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
