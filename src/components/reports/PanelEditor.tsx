import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { SqlEditor } from './SqlEditor';
import { DataTable } from './DataTable';
import { VisualizationSettings } from './VisualizationSettings';
import { DatasetRequirements } from './DatasetRequirements';
import { Save, X, Play, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { formatSql } from '@/lib/sqlFormatter';
import type { Panel, NavixyPanelConfig, NavixyColumnType, PanelType, VisualizationConfig } from '@/types/dashboard-types';
import { useSqlExecution } from '@/hooks/use-sql-execution';
import { extractParameterNames } from '@/utils/sqlParameterExtractor';

/**
 * Maps panel type to default dataset shape
 */
function getDefaultDatasetShape(panelType: PanelType): 'kpi' | 'category_value' | 'time_value' | 'table' | 'pie' {
  switch (panelType) {
    case 'kpi':
    case 'stat':
      return 'kpi';
    case 'table':
      return 'table';
    case 'barchart':
    case 'bargauge':
      return 'category_value';
    case 'piechart':
      return 'pie';
    case 'linechart':
    case 'timeseries':
      return 'time_value';
    case 'text':
    case 'row':
    default:
      return 'table';
  }
}

interface PanelEditorProps {
  open: boolean;
  onClose: () => void;
  panel: Panel;
  onSave: (updatedPanel: Panel) => void;
}

export function PanelEditor({ open, onClose, panel, onSave }: PanelEditorProps) {
  const [title, setTitle] = useState(panel.title);
  const [description, setDescription] = useState(panel.description || '');
  const [panelType, setPanelType] = useState(panel.type);
  const [sql, setSql] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.sql?.statement ? formatSql(navixyConfig.sql.statement) : '';
  });
  
  const [maxRows, setMaxRows] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.verify?.max_rows || 1000;
  });
  
  const [visualization, setVisualization] = useState<VisualizationConfig | undefined>(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.visualization;
  });
  
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<ReturnType<typeof useSqlExecution>['results']>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const { executing, error, executeQuery } = useSqlExecution();

  // Update state when panel prop changes (e.g., after save)
  useEffect(() => {
    if (panel) {
      const navixyConfig = panel['x-navixy'];
      setTitle(panel.title);
      setDescription(panel.description || '');
      setPanelType(panel.type);
      setSql(navixyConfig?.sql?.statement ? formatSql(navixyConfig.sql.statement) : '');
      setMaxRows(navixyConfig?.verify?.max_rows || 1000);
      setVisualization(navixyConfig?.visualization);
    }
  }, [panel, open]); // Update when panel changes or dialog opens

  const handleSave = () => {
    // Validate required fields
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Panel Title is required',
        variant: 'destructive',
      });
      return;
    }

    if (!panelType) {
      toast({
        title: 'Validation Error',
        description: 'Panel Type is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Auto-extract parameters from SQL
      const paramNames = extractParameterNames(sql.trim());
      const parsedParams: Record<string, unknown> = {};
      paramNames.forEach(name => {
        // Use existing params from panel if available, otherwise null
        const existingParams = panel['x-navixy']?.sql?.params || {};
        parsedParams[name] = existingParams[name] ?? null; // Default to null, will be filled by dashboard variables
      });
      
      // Auto-determine dataset shape from panel type
      const autoDatasetShape = getDefaultDatasetShape(panelType);
      
      // Auto-infer columns from test results if available, otherwise empty
      let inferredColumns: Record<string, { type: NavixyColumnType }> = {};
      if (testResults && testResults.columns.length > 0 && testResults.columnTypes) {
        testResults.columns.forEach((colName: string) => {
          const colType = testResults.columnTypes[colName] || 'string';
          // Map database types to NavixyColumnType
          let navixyType: NavixyColumnType = 'string';
          if (colType.includes('int') || colType === 'integer') {
            navixyType = 'integer';
          } else if (colType.includes('numeric') || colType.includes('decimal') || colType.includes('float') || colType.includes('double') || colType === 'number') {
            navixyType = 'number';
          } else if (colType.includes('bool')) {
            navixyType = 'boolean';
          } else if (colType.includes('timestamp')) {
            navixyType = colType.includes('tz') ? 'timestamptz' : 'timestamp';
          } else if (colType.includes('date') && !colType.includes('time')) {
            navixyType = 'date';
          } else if (colType.includes('uuid')) {
            navixyType = 'uuid';
          }
          inferredColumns[colName] = { type: navixyType };
        });
      }
      
      // Build updated Navixy configuration
      const updatedNavixyConfig: NavixyPanelConfig = {
        sql: {
          statement: sql.trim(),
          params: parsedParams
        },
        dataset: {
          shape: autoDatasetShape,
          columns: inferredColumns
        },
        verify: {
          max_rows: maxRows
        },
        ...(visualization && Object.keys(visualization).length > 0 && { visualization })
      };

      // Create updated panel
      const updatedPanel: Panel = {
        ...panel,
        title: title.trim(),
        description: description.trim() || undefined,
        type: panelType as any,
        'x-navixy': updatedNavixyConfig
      };

      onSave(updatedPanel);
      onClose();
    } catch (err) {
      console.error('Error saving panel:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save panel',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestQuery = async () => {
    // Use empty parameters for testing - parameters will be filled from dashboard variables at runtime
    const parsedParams: Record<string, unknown> = {};
    
    try {
      // Use the returned value from executeQuery for consistency with standalone editor
      // This ensures we use the exact same execution path and data transformation
      const executionResult = await executeQuery({
        sql: sql.trim(),
        params: parsedParams,
        timeout_ms: 10000,
        row_limit: 100, // Increased from 5 to allow testing queries that return more rows
        showSuccessToast: false,
        showErrorToast: false,
      });
      
      // Set results from the returned value to ensure consistency
      // This matches the pattern used in the standalone SQL editor
      if (executionResult) {
        setTestResults(executionResult);
        setTestError(null);
        toast({
          title: 'Success',
          description: 'Query executed successfully',
        });
      } else {
        // Error case - use the hook's error state
        setTestResults(null);
        setTestError(error || 'Failed to execute query');
        if (error) {
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
        }
      }
    } catch (err: any) {
      console.error('Unexpected error executing query:', err);
      const errorMsg = err.message || 'Failed to execute query';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      setTestResults(null);
      setTestError(errorMsg);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 bg-[var(--surface-1)] border-[var(--border)] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] rounded-t-lg">
          <DialogTitle className="text-[var(--text-primary)] flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Edit Panel: {panel.title}
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Modify panel properties and SQL query for this visualization
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-3 flex-shrink-0">
            <TabsTrigger value="properties">Panel Properties</TabsTrigger>
            <TabsTrigger value="sql">SQL Query</TabsTrigger>
            <TabsTrigger value="visualization">Visualization Settings</TabsTrigger>
          </TabsList>
          
          {/* Panel Properties Tab */}
          <TabsContent value="properties" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium">
                    Panel Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                    placeholder="Enter panel title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type" className="text-sm font-medium">
                    Panel Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={panelType} onValueChange={setPanelType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kpi">KPI</SelectItem>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="barchart">Bar Chart</SelectItem>
                      <SelectItem value="piechart">Pie Chart</SelectItem>
                      <SelectItem value="linechart">Line Chart</SelectItem>
                      <SelectItem value="timeseries">Time Series</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1"
                  placeholder="Enter panel description (optional)"
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>
          
          {/* SQL Query Tab */}
          <TabsContent value="sql" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="flex-1 flex flex-col min-h-0 gap-3">
              {/* Dataset Requirements Info */}
              <DatasetRequirements panelType={panelType} />

              {/* SQL Editor - 50% */}
              <div className="flex-1 flex flex-col min-h-0 basis-0">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                  <Label className="text-sm font-medium">SQL Query</Label>
                  <Button onClick={handleTestQuery} disabled={executing || !sql.trim()} size="sm" variant="outline">
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    {executing ? 'Testing...' : 'Test Query'}
                  </Button>
                </div>
                <div className="flex-1 border rounded-md overflow-hidden min-h-0">
                  <SqlEditor
                    value={sql}
                    onChange={setSql}
                    height="100%"
                    language="sql"
                  />
                </div>
              </div>

              {/* Test Results - 50% */}
              <div className="flex-1 flex flex-col min-h-0 basis-0">
                {(error || testError) && (
                  <Alert variant="destructive" className="mb-2 flex-shrink-0">
                    <AlertDescription>{testError || error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                  <Label className="text-sm font-medium">Test Results</Label>
                  {testResults && (
                    <span className="text-xs text-muted-foreground">
                      {testResults.rowCount} row{testResults.rowCount !== 1 ? 's' : ''} returned
                    </span>
                  )}
                </div>
                
                <div className="flex-1 border rounded-md overflow-auto min-h-0 bg-background">
                  {testResults ? (
                    <DataTable
                      data={testResults.rows || []}
                      columns={testResults.columns.map((col: string) => ({
                        id: col,
                        accessorKey: col,
                        header: col,
                      }))}
                      columnTypes={testResults.columnTypes}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Click "Test Query" to see results
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Visualization Settings Tab */}
          <TabsContent value="visualization" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-y-auto bg-[var(--surface-1)]">
            <div className="py-2">
              <VisualizationSettings
                panelType={panelType}
                visualization={visualization}
                onChange={setVisualization}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0 bg-[var(--surface-1)] rounded-b-lg">
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
