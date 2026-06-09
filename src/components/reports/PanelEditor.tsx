import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { formatSql } from '@/lib/sqlFormatter';
import type { Panel, NavixyPanelConfig, NavixyColumnType, PanelType, VisualizationConfig, Variable, PanelFilterBinding } from '@/types/dashboard-types';
import { useSqlExecution } from '@/hooks/use-sql-execution';
import { extractParameterNames } from '@/utils/sqlParameterExtractor';
import { dateRangeParamNames } from '@/utils/filterVariables';

/**
 * Maps panel type to default dataset shape
 */
function getDefaultDatasetShape(panelType: PanelType): 'kpi' | 'category_value' | 'time_value' | 'table' | 'pie' {
  switch (panelType) {
    case 'kpi':
    case 'stat':
      return 'kpi';
    case 'table':
    case 'geomap':
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
  /** Dashboard date-range filter variables available to bind to this panel. */
  dateFilters?: Variable[];
}

/** Read a panel's existing filter bindings into a {variable: column} map. */
function initFilterBindings(panel: Panel): Record<string, string> {
  const map: Record<string, string> = {};
  (panel['x-navixy']?.filters || []).forEach((f) => {
    map[f.variable] = f.column;
  });
  return map;
}

export function PanelEditor({ open, onClose, panel, onSave, dateFilters = [] }: PanelEditorProps) {
  const [title, setTitle] = useState(panel.title);
  const [description, setDescription] = useState(panel.description || '');
  const [panelType, setPanelType] = useState(panel.type);
  const [sql, setSql] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    // CRITICAL: Preserve original SQL exactly as saved - don't format it
    // formatSql can modify/truncate SQL, so we preserve the original
    return navixyConfig?.sql?.statement || '';
  });
  
  const [maxRows, setMaxRows] = useState(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.verify?.max_rows || 1000;
  });
  
  const [visualization, setVisualization] = useState<VisualizationConfig | undefined>(() => {
    const navixyConfig = panel['x-navixy'];
    return navixyConfig?.visualization;
  });
  
  // Text panel specific state
  // Support both formats: options.* and x-navixy.text.*
  const navixyText = panel['x-navixy']?.text;
  const [textMode, setTextMode] = useState<'markdown' | 'html' | 'text'>(() => {
    return (panel.options?.mode as 'markdown' | 'html' | 'text') || 
           (navixyText?.format as 'markdown' | 'html' | 'text') || 
           'markdown';
  });
  const [textContent, setTextContent] = useState(() => {
    return panel.options?.content || navixyText?.content || '';
  });
  
  // Local filter bindings for this panel: { [variableName]: columnName }
  const [filterBindings, setFilterBindings] = useState<Record<string, string>>(() => initFilterBindings(panel));

  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<ReturnType<typeof useSqlExecution>['results']>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number } | null>(null);
  const { executing, error, executeQuery } = useSqlExecution();
  
  const isTextPanel = panelType === 'text';

  // Update state when panel prop changes (e.g., after save)
  useEffect(() => {
    if (panel) {
      const navixyConfig = panel['x-navixy'];
      setTitle(panel.title);
      setDescription(panel.description || '');
      setPanelType(panel.type);
      // CRITICAL: Preserve original SQL exactly as saved - don't format it
      // formatSql can modify/truncate SQL, so we preserve the original
      setSql(navixyConfig?.sql?.statement || '');
      setMaxRows(navixyConfig?.verify?.max_rows || 1000);
      setVisualization(navixyConfig?.visualization);
      // Update text panel state - support both formats
      const navixyText = panel['x-navixy']?.text;
      setTextMode(
        (panel.options?.mode as 'markdown' | 'html' | 'text') || 
        (navixyText?.format as 'markdown' | 'html' | 'text') || 
        'markdown'
      );
      setTextContent(panel.options?.content || navixyText?.content || '');
      setFilterBindings(initFilterBindings(panel));
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

    // Special handling for text panels
    if (isTextPanel) {
      setSaving(true);
      try {
        const updatedPanel: Panel = {
          ...panel,
          title: title.trim(),
          description: description.trim() || undefined,
          type: panelType as any,
          options: {
            ...panel.options,
            mode: textMode,
            content: textContent,
          },
          // Text panels don't need x-navixy config, but keep it if it exists
          'x-navixy': panel['x-navixy'],
        };

        onSave(updatedPanel);
        onClose();
      } catch (err) {
        console.error('Error saving text panel:', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to save panel',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
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
      
      // Build local filter bindings (only keep enabled bindings with a column
      // for variables that still exist on the dashboard). Always set the field
      // (even when empty) so unchecking clears it through the panel-save merge.
      const filters: PanelFilterBinding[] = Object.entries(filterBindings)
        .filter(([variable, column]) =>
          column && column.trim() && dateFilters.some((v) => v.name === variable)
        )
        .map(([variable, column]) => ({ variable, column: column.trim() }));

      // Build updated Navixy configuration
      const updatedNavixyConfig: NavixyPanelConfig = {
        sql: {
          statement: sql.trim(),
          params: parsedParams
        },
        filters,
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
      const currentPage = pagination?.page || 1;
      const currentPageSize = pagination?.pageSize || 25;
      
      // Use the returned value from executeQuery for consistency with standalone editor
      // This ensures we use the exact same execution path and data transformation
      const executionResult = await executeQuery({
        sql: sql.trim(),
        params: parsedParams,
        timeout_ms: 10000,
        row_limit: 10000,
        pagination: {
          page: currentPage,
          pageSize: currentPageSize,
        },
        showSuccessToast: false,
        showErrorToast: false,
      });
      
      // Set results from the returned value to ensure consistency
      // This matches the pattern used in the standalone SQL editor
      if (executionResult) {
        setTestResults(executionResult);
        setTestError(null);
        if (executionResult.pagination) {
          setPagination(executionResult.pagination);
        }
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

  const handlePageChange = async (page: number) => {
    if (!pagination) return;
    
    setPagination({ ...pagination, page });
    
    const parsedParams: Record<string, unknown> = {};
    
    const result = await executeQuery({
      sql: sql.trim(),
      params: parsedParams,
      timeout_ms: 10000,
      row_limit: 10000,
      pagination: {
        page,
        pageSize: pagination.pageSize,
      },
      showSuccessToast: false,
      showErrorToast: false,
    });
    
    if (result) {
      setTestResults(result);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    }
  };

  const handlePageSizeChange = async (pageSize: number) => {
    const newPagination = pagination ? { ...pagination, pageSize, page: 1 } : { page: 1, pageSize, total: testResults?.rowCount || 0 };
    setPagination(newPagination);
    
    const parsedParams: Record<string, unknown> = {};
    
    const result = await executeQuery({
      sql: sql.trim(),
      params: parsedParams,
      timeout_ms: 10000,
      row_limit: 10000,
      pagination: {
        page: 1,
        pageSize,
      },
      showSuccessToast: false,
      showErrorToast: false,
    });
    
    if (result) {
      setTestResults(result);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    }
  };


  // Columns detected from the last "Test Query" run, used to populate the
  // filter column picker. Date/time columns are surfaced first.
  const detectedColumns = testResults?.columns ?? [];
  const columnTypeOf = (c: string) => testResults?.columnTypes?.[c] || '';
  const isDateishType = (t: string) => /date|time/i.test(t);
  const sortedColumns = [...detectedColumns].sort(
    (a, b) => Number(isDateishType(columnTypeOf(b))) - Number(isDateishType(columnTypeOf(a)))
  );

  const showFiltersTab = !isTextPanel && dateFilters.length > 0;
  const nonTextTabCols = showFiltersTab ? 'grid-cols-4' : 'grid-cols-3';

  const setFilterEnabled = (variable: string, enabled: boolean) => {
    setFilterBindings((prev) => {
      const next = { ...prev };
      if (enabled) {
        // Pre-select the first date-ish column if one was detected
        const suggested = sortedColumns.find((c) => isDateishType(columnTypeOf(c))) || '';
        next[variable] = prev[variable] ?? suggested;
      } else {
        delete next[variable];
      }
      return next;
    });
  };

  const setFilterColumn = (variable: string, column: string) => {
    setFilterBindings((prev) => ({ ...prev, [variable]: column }));
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
          <TabsList className={`mx-6 grid w-[calc(100%-3rem)] flex-shrink-0 ${isTextPanel ? 'grid-cols-2' : nonTextTabCols}`}>
            <TabsTrigger value="properties">Panel Properties</TabsTrigger>
            {!isTextPanel && <TabsTrigger value="sql">SQL Query</TabsTrigger>}
            {isTextPanel && <TabsTrigger value="content">Content</TabsTrigger>}
            {showFiltersTab && <TabsTrigger value="filters">Filters</TabsTrigger>}
            {!isTextPanel && <TabsTrigger value="visualization">Visualization Settings</TabsTrigger>}
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
                      <SelectItem value="geomap">Map</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
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
          
          {/* Content Tab (for text panels) */}
          <TabsContent value="content" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Content Mode</Label>
                <RadioGroup value={textMode} onValueChange={(value) => setTextMode(value as 'markdown' | 'html' | 'text')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="markdown" id="mode-markdown" />
                    <Label htmlFor="mode-markdown" className="cursor-pointer">Markdown</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="html" id="mode-html" />
                    <Label htmlFor="mode-html" className="cursor-pointer">HTML</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="text" id="mode-text" />
                    <Label htmlFor="mode-text" className="cursor-pointer">Plain Text</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground mt-2">
                  {textMode === 'markdown' && 'Use Markdown syntax for formatting (e.g., **bold**, *italic*, `code`)'}
                  {textMode === 'html' && 'Use HTML tags for formatting'}
                  {textMode === 'text' && 'Plain text with no formatting'}
                </p>
              </div>
              
              <div className="flex-1 flex flex-col min-h-0">
                <Label className="text-sm font-medium mb-2">Content</Label>
                <div className="flex-1 border rounded-md overflow-hidden min-h-0">
                  <SqlEditor
                    value={textContent}
                    onChange={setTextContent}
                    height="100%"
                    language={textMode === 'markdown' ? 'markdown' : textMode === 'html' ? 'html' : 'plaintext'}
                  />
                </div>
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
                      {pagination
                        ? `Showing ${((pagination.page - 1) * pagination.pageSize) + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total} row${pagination.total !== 1 ? 's' : ''}`
                        : `${testResults.rowCount} row${testResults.rowCount !== 1 ? 's' : ''} returned`}
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
                      pagination={
                        pagination
                          ? {
                              page: pagination.page,
                              pageSize: pagination.pageSize,
                              total: pagination.total,
                              onPageChange: handlePageChange,
                              onPageSizeChange: handlePageSizeChange,
                            }
                          : undefined
                      }
                      loading={executing}
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

          {/* Filters Tab */}
          {showFiltersTab && (
            <TabsContent value="filters" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-y-auto bg-[var(--surface-1)]">
              <div className="space-y-4 py-2">
                <Alert>
                  <AlertDescription className="text-xs">
                    Bind a dashboard date filter to a column in this panel's result. When a viewer changes the
                    filter, this panel re-queries and shows only rows whose column falls in the selected range.
                    Your SQL is not modified — the filter is applied by wrapping the query at run time.
                  </AlertDescription>
                </Alert>

                {detectedColumns.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tip: run <span className="font-medium">Test Query</span> on the SQL tab to pick from detected
                    columns. You can also type a column name manually.
                  </p>
                )}

                {dateFilters.map((variable) => {
                  const enabled = variable.name in filterBindings;
                  const column = filterBindings[variable.name] ?? '';
                  const names = dateRangeParamNames(variable.name);
                  return (
                    <div key={variable.name} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`filter-${variable.name}`}
                          checked={enabled}
                          onCheckedChange={(c) => setFilterEnabled(variable.name, c === true)}
                        />
                        <Label htmlFor={`filter-${variable.name}`} className="cursor-pointer font-medium">
                          Apply “{variable.label || variable.name}”
                        </Label>
                      </div>

                      {enabled && (
                        <div className="pl-6 space-y-2">
                          <Label className="text-xs">Filter column</Label>
                          {detectedColumns.length > 0 ? (
                            <Select value={column} onValueChange={(val) => setFilterColumn(variable.name, val)}>
                              <SelectTrigger className="h-9 w-72">
                                <SelectValue placeholder="Select a column" />
                              </SelectTrigger>
                              <SelectContent>
                                {sortedColumns.map((col) => (
                                  <SelectItem key={col} value={col}>
                                    {col}
                                    {columnTypeOf(col) ? (
                                      <span className="text-muted-foreground"> · {columnTypeOf(col)}</span>
                                    ) : null}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={column}
                              onChange={(e) => setFilterColumn(variable.name, e.target.value)}
                              placeholder="e.g. event_time"
                              className="h-9 w-72 font-mono"
                            />
                          )}
                          {column ? (
                            <p className="text-xs text-muted-foreground font-mono">
                              WHERE "{column}" BETWEEN {'${'}{names.from}{'}'} AND {'${'}{names.to}{'}'}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600">Pick a column to activate this filter.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          )}

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
