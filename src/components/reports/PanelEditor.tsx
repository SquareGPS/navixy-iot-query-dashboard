import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { SqlEditor } from './SqlEditor';
import { DataTable } from './DataTable';
import { Save, X, Play, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { formatSql } from '@/lib/sqlFormatter';
import type { GrafanaPanel, NavixyPanelConfig, NavixyColumnType, GrafanaPanelType } from '@/types/grafana-dashboard';
import { useSqlExecution } from '@/hooks/use-sql-execution';

/**
 * Maps panel type to default dataset shape
 */
function getDefaultDatasetShape(panelType: GrafanaPanelType): 'kpi' | 'category_value' | 'time_value' | 'table' | 'pie' {
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
  panel: GrafanaPanel;
  onSave: (updatedPanel: GrafanaPanel) => void;
}

export function PanelEditor({ open, onClose, panel, onSave }: PanelEditorProps) {
  const [title, setTitle] = useState(panel.title);
  const [description, setDescription] = useState(panel.description || '');
  const [panelType, setPanelType] = useState(panel.type);
  const [sql, setSql] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.sql?.statement ? formatSql(navixyConfig.sql.statement) : '';
  });
  const [params, setParams] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return JSON.stringify(navixyConfig?.sql?.params || {}, null, 2);
  });
  
  const [columns, setColumns] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.dataset?.columns || {};
  });
  const [maxRows, setMaxRows] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.verify?.max_rows || 1000;
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
      setParams(JSON.stringify(navixyConfig?.sql?.params || {}, null, 2));
      setColumns(navixyConfig?.dataset?.columns || {});
      setMaxRows(navixyConfig?.verify?.max_rows || 1000);
    }
  }, [panel, open]); // Update when panel changes or dialog opens

  const handleSave = () => {
    setSaving(true);
    try {
      const parsedParams = params.trim() ? JSON.parse(params) : {};
      
      // Auto-determine dataset shape from panel type
      const autoDatasetShape = getDefaultDatasetShape(panelType);
      
      // Build updated Navixy configuration
      const updatedNavixyConfig: NavixyPanelConfig = {
        sql: {
          statement: sql.trim(), // Ensure no leading/trailing whitespace but preserve content
          params: parsedParams
        },
        dataset: {
          shape: autoDatasetShape,
          columns: columns
        },
        verify: {
          max_rows: maxRows
        }
      };

      // Create updated panel
      const updatedPanel: GrafanaPanel = {
        ...panel,
        title,
        description,
        type: panelType as any,
        'x-navixy': updatedNavixyConfig
      };

      onSave(updatedPanel);
      onClose();
    } catch (err) {
      console.error('Invalid JSON in parameters:', err);
      toast({
        title: 'Error',
        description: 'Invalid JSON in parameters',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestQuery = async () => {
    // Parse parameters with better error handling
    let parsedParams: Record<string, unknown> = {};
    const paramsTrimmed = params.trim();
    
    if (paramsTrimmed) {
      try {
        parsedParams = JSON.parse(paramsTrimmed);
        if (typeof parsedParams !== 'object' || parsedParams === null || Array.isArray(parsedParams)) {
          throw new Error('Parameters must be a JSON object');
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Invalid JSON in parameters';
        console.error('Failed to parse parameters:', err);
        toast({
          title: 'Invalid Parameters',
          description: errorMsg + '. Proceeding with empty parameters.',
          variant: 'destructive',
        });
        // Continue with empty params instead of failing completely
        parsedParams = {};
      }
    }
    
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

  const addColumn = () => {
    const columnName = `column_${Object.keys(columns).length + 1}`;
    setColumns({
      ...columns,
      [columnName]: { type: 'string' as NavixyColumnType }
    });
  };

  const updateColumn = (columnName: string, field: 'name' | 'type', value: string) => {
    if (field === 'name') {
      // Rename column
      const newColumns = { ...columns };
      delete newColumns[columnName];
      newColumns[value] = columns[columnName];
      setColumns(newColumns);
    } else {
      // Update column type
      setColumns({
        ...columns,
        [columnName]: { ...columns[columnName], type: value as NavixyColumnType }
      });
    }
  };

  const removeColumn = (columnName: string) => {
    const newColumns = { ...columns };
    delete newColumns[columnName];
    setColumns(newColumns);
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
            <TabsTrigger value="dataset">Dataset Schema</TabsTrigger>
          </TabsList>
          
          {/* Panel Properties Tab */}
          <TabsContent value="properties" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium">Panel Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                    placeholder="Enter panel title"
                  />
                </div>
                <div>
                  <Label htmlFor="type" className="text-sm font-medium">Panel Type</Label>
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
                  placeholder="Enter panel description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="maxRows" className="text-sm font-medium">Max Rows</Label>
                <Input
                  id="maxRows"
                  type="number"
                  value={maxRows}
                  onChange={(e) => setMaxRows(parseInt(e.target.value) || 1000)}
                  className="mt-1"
                  min="1"
                  max="10000"
                />
              </div>
            </div>
          </TabsContent>
          
          {/* SQL Query Tab */}
          <TabsContent value="sql" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="flex-1 flex flex-col min-h-0 gap-3">
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

          {/* Dataset Schema Tab */}
          <TabsContent value="dataset" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Dataset Columns</Label>
                <Button onClick={addColumn} size="sm" variant="outline">
                  Add Column
                </Button>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(columns).map(([columnName, columnConfig]) => (
                  <div key={columnName} className="flex items-center gap-2 p-3 border rounded-md">
                    <Input
                      value={columnName}
                      onChange={(e) => updateColumn(columnName, 'name', e.target.value)}
                      className="flex-1"
                      placeholder="Column name"
                    />
                    <Select 
                      value={columnConfig.type} 
                      onValueChange={(value) => updateColumn(columnName, 'type', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="integer">Integer</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="timestamp">Timestamp</SelectItem>
                        <SelectItem value="timestamptz">TimestampTZ</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="uuid">UUID</SelectItem>
                        <SelectItem value="numeric">Numeric</SelectItem>
                        <SelectItem value="decimal">Decimal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => removeColumn(columnName)} 
                      size="sm" 
                      variant="destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div>
                <Label className="mb-2 flex-shrink-0 text-sm font-medium text-[var(--text-primary)]">Query Parameters (JSON)</Label>
                <Textarea
                  value={params}
                  onChange={(e) => setParams(e.target.value)}
                  className="flex-1 font-mono text-sm resize-none min-h-32 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                  placeholder='{"param1": "value1"}'
                />
              </div>
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
