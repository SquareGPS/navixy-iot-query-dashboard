/**
 * CompositeReportView - View page for Composite Reports
 * Displays SQL query results as Table, Chart, and Map in a linear, print-friendly layout
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  FileCode2, 
  ChevronDown, 
  ChevronRight,
  ArrowLeft,
  Clock,
  Database,
  Loader2,
  AlertCircle,
  Table as TableIcon,
  LineChart,
  Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Play } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import type { CompositeReport, CompositeReportExecutionResult, GPSPoint } from '@/types/dashboard-types';
import { MapPanel } from '@/components/reports/visualizations/MapPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';

// Chart color palette
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

interface ExecutionState {
  loading: boolean;
  error: string | null;
  data: CompositeReportExecutionResult | null;
  lastExecuted: Date | null;
}

export default function CompositeReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [report, setReport] = useState<CompositeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [execution, setExecution] = useState<ExecutionState>({
    loading: false,
    error: null,
    data: null,
    lastExecuted: null,
  });
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'html' | null>(null);
  const [editableSql, setEditableSql] = useState('');
  const [savingSql, setSavingSql] = useState(false);
  const [savingChartConfig, setSavingChartConfig] = useState(false);
  
  // Chart column selection state
  const [chartXColumn, setChartXColumn] = useState<string>('');
  const [chartYColumn, setChartYColumn] = useState<string>('');
  const [chartColorColumn, setChartColorColumn] = useState<string>('');

  // Load report
  useEffect(() => {
    async function loadReport() {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await apiService.getCompositeReportById(id);
        if (response.error) {
          throw new Error(response.error.message);
        }
        setReport(response.data);
        setEditableSql(response.data.sql_query || '');
      } catch (error: any) {
        toast.error(`Failed to load report: ${error.message}`);
        navigate('/');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [id, navigate]);

  // Execute query when report loads
  useEffect(() => {
    if (report) {
      executeQuery();
    }
  }, [report?.id]);

  // Execute the SQL query
  const executeQuery = useCallback(async () => {
    if (!id) return;

    setExecution(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await apiService.executeCompositeReport(id, {
        page: 1,
        pageSize: 1000,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setExecution({
        loading: false,
        error: null,
        data: response.data,
        lastExecuted: new Date(),
      });
    } catch (error: any) {
      setExecution({
        loading: false,
        error: error.message || 'Query execution failed',
        data: null,
        lastExecuted: null,
      });
    }
  }, [id]);

  // Convert rows to objects for easier processing
  const rowObjects = useMemo(() => {
    if (!execution.data) return [];
    
    return execution.data.rows.map(row => {
      const obj: Record<string, unknown> = {};
      execution.data!.columns.forEach((col, idx) => {
        obj[col.name] = row[idx];
      });
      return obj;
    });
  }, [execution.data]);

  // Available columns for chart selection
  const availableColumns = useMemo(() => {
    if (!execution.data?.columns) return [];
    return execution.data.columns.map(col => col.name);
  }, [execution.data?.columns]);

  // Initialize chart columns when data loads
  useEffect(() => {
    if (execution.data?.columns && report?.config.chart) {
      // Set defaults from report config or first available columns
      const columns = execution.data.columns.map(c => c.name);
      const defaultX = report.config.chart.xColumn || columns[0] || '';
      const defaultY = report.config.chart.yColumns?.[0] || columns.find(c => c !== defaultX) || '';
      
      if (!chartXColumn) setChartXColumn(defaultX);
      if (!chartYColumn) setChartYColumn(defaultY);
    }
  }, [execution.data?.columns, report?.config.chart]);

  // Extract GPS points for map
  const gpsPoints = useMemo<GPSPoint[]>(() => {
    if (!execution.data?.gps || !rowObjects.length) return [];

    const { latColumn, lonColumn, labelColumn } = execution.data.gps;
    
    return rowObjects
      .filter(row => {
        const lat = parseFloat(String(row[latColumn]));
        const lon = parseFloat(String(row[lonColumn]));
        return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
      })
      .map(row => ({
        lat: parseFloat(String(row[latColumn])),
        lon: parseFloat(String(row[lonColumn])),
        label: labelColumn ? String(row[labelColumn] || '') : undefined,
        data: row,
      }));
  }, [execution.data?.gps, rowObjects]);

  // Prepare chart data using selected columns
  const chartData = useMemo(() => {
    if (!report?.config.chart.enabled || !execution.data) return null;
    if (!chartXColumn || !chartYColumn) return null;

    return rowObjects.slice(0, 200).map(row => {
      const point: Record<string, unknown> = {
        [chartXColumn]: formatChartLabel(row[chartXColumn]),
      };
      
      const val = row[chartYColumn];
      point[chartYColumn] = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      
      return point;
    });
  }, [report?.config.chart.enabled, execution.data, rowObjects, chartXColumn, chartYColumn]);

  // Save SQL query
  const handleSaveSql = async (): Promise<boolean> => {
    if (!id || !report) return false;
    
    setSavingSql(true);
    try {
      const response = await apiService.updateCompositeReport(id, {
        title: report.title,
        description: report.description,
        slug: report.slug,
        section_id: report.section_id,
        sort_order: report.sort_order,
        sql_query: editableSql,
        config: report.config,
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      // Update both report and editableSql to match
      setReport(response.data);
      setEditableSql(response.data.sql_query || editableSql);
      toast.success('SQL query saved');
      return true;
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
      return false;
    } finally {
      setSavingSql(false);
    }
  };

  // Save and execute SQL query
  const handleSaveAndExecute = async () => {
    const saved = await handleSaveSql();
    if (saved) {
      executeQuery();
    }
  };

  // Check if chart config has unsaved changes
  const chartConfigChanged = report && (
    chartXColumn !== (report.config.chart.xColumn || '') ||
    chartYColumn !== (report.config.chart.yColumns?.[0] || '') ||
    (chartColorColumn !== 'none' && chartColorColumn !== '') !== Boolean(report.config.chart.colorColumn) ||
    (chartColorColumn !== 'none' && chartColorColumn !== '' && chartColorColumn !== report.config.chart.colorColumn)
  );

  // Save chart configuration
  const handleSaveChartConfig = async () => {
    if (!id || !report) return;
    
    setSavingChartConfig(true);
    try {
      const updatedConfig = {
        ...report.config,
        chart: {
          ...report.config.chart,
          xColumn: chartXColumn,
          yColumns: chartYColumn ? [chartYColumn] : [],
          colorColumn: chartColorColumn !== 'none' ? chartColorColumn : undefined,
        },
      };

      const response = await apiService.updateCompositeReport(id, {
        title: report.title,
        description: report.description,
        slug: report.slug,
        section_id: report.section_id,
        sort_order: report.sort_order,
        sql_query: report.sql_query,
        config: updatedConfig,
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      setReport(response.data);
      toast.success('Chart settings saved');
    } catch (error: any) {
      toast.error(`Failed to save chart settings: ${error.message}`);
    } finally {
      setSavingChartConfig(false);
    }
  };

  // Export handlers
  const handleExportExcel = async () => {
    if (!id) return;
    
    setExporting('excel');
    try {
      const blob = await apiService.exportCompositeReportExcel(id);
      if (blob) {
        downloadBlob(blob, `${report?.slug || 'composite-report'}.xlsx`);
        toast.success('Excel export downloaded');
      } else {
        throw new Error('Export failed');
      }
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportHTML = async () => {
    if (!id) return;
    
    setExporting('html');
    try {
      const blob = await apiService.exportCompositeReportHTML(id, {
        includeChart: report?.config.chart.enabled,
        includeMap: report?.config.map.enabled && gpsPoints.length > 0,
      });
      if (blob) {
        downloadBlob(blob, `${report?.slug || 'composite-report'}.html`);
        toast.success('HTML export downloaded');
      } else {
        throw new Error('Export failed');
      }
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Report not found</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 print:py-0 print:px-0">
      {/* Header */}
      <header className="mb-8 print:mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="print:hidden"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{report.title}</h1>
            {report.description && (
              <p className="text-muted-foreground mt-2">{report.description}</p>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 print:hidden">
            <Button 
              variant="outline" 
              size="sm"
              onClick={executeQuery}
              disabled={execution.loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${execution.loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={!!exporting || !execution.data}
            >
              {exporting === 'excel' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Excel
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportHTML}
              disabled={!!exporting || !execution.data}
            >
              {exporting === 'html' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCode2 className="h-4 w-4 mr-2" />
              )}
              HTML
            </Button>
          </div>
        </div>

        {/* Execution metadata */}
        {execution.lastExecuted && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last updated: {execution.lastExecuted.toLocaleString()}
            </span>
            {execution.data?.stats && (
              <>
                <span className="flex items-center gap-1">
                  <Database className="h-4 w-4" />
                  {execution.data.stats.rowCount} rows
                </span>
                <span>
                  Query time: {execution.data.stats.elapsedMs}ms
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {/* SQL Query (collapsible) */}
      <Collapsible open={sqlExpanded} onOpenChange={setSqlExpanded} className="mb-6 print:hidden">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-transparent">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {sqlExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>SQL Query</span>
              {editableSql !== report.sql_query && (
                <span className="text-xs text-amber-500">(unsaved changes)</span>
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="p-4 space-y-4">
              <Textarea
                value={editableSql}
                onChange={(e) => setEditableSql(e.target.value)}
                className="font-mono text-sm min-h-[200px] resize-y"
                placeholder="Enter SQL query..."
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSql}
                  disabled={savingSql || editableSql === report.sql_query}
                >
                  {savingSql ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveAndExecute}
                  disabled={savingSql || execution.loading}
                >
                  {execution.loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Save & Run
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Error State */}
      {execution.error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Query Error</p>
                <p className="text-sm mt-1">{execution.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {execution.loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Executing query...</span>
          </div>
        </div>
      )}

      {/* Content Sections */}
      {execution.data && !execution.loading && (
        <div className="space-y-8">
          {/* Table Section */}
          {report.config.table.enabled && (
            <section className="print:break-before-avoid">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">Data Table</CardTitle>
                  </div>
                  <CardDescription>
                    {execution.data.pagination 
                      ? `Showing ${Math.min(execution.data.rows.length, 15)} of ${execution.data.pagination.total} rows`
                      : `Showing ${Math.min(execution.data.rows.length, 15)} of ${execution.data.rows.length} rows`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="max-h-[480px] overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            {execution.data.columns.map((col) => (
                              <TableHead key={col.name} className="whitespace-nowrap bg-background">
                                {col.name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {execution.data.rows.slice(0, 15).map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              {row.map((cell, cellIdx) => (
                                <TableCell key={cellIdx} className="max-w-[300px] truncate">
                                  {formatCellValue(cell)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {execution.data.rows.length > 15 && (
                      <p className="text-sm text-muted-foreground mt-3 text-center">
                        Showing first 15 of {execution.data.rows.length} rows. 
                        Download Excel for complete data.
                      </p>
                    )}
                  </div>
                  
                  {/* Download Excel Button */}
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportExcel}
                      disabled={exporting === 'excel'}
                    >
                      {exporting === 'excel' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                      )}
                      Download Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Chart Section */}
          {report.config.chart.enabled && (
            <section className="print:break-before-page">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">Chart</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Column Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                    <div className="space-y-2">
                      <Label htmlFor="x-axis">X-axis</Label>
                      <Select value={chartXColumn} onValueChange={setChartXColumn}>
                        <SelectTrigger id="x-axis">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="y-axis">Y-axis</Label>
                      <Select value={chartYColumn} onValueChange={setChartYColumn}>
                        <SelectTrigger id="y-axis">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="color-by">Color by</Label>
                      <Select value={chartColorColumn} onValueChange={setChartColorColumn}>
                        <SelectTrigger id="color-by">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Save Chart Settings Button */}
                  <div className="flex items-center gap-3 print:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveChartConfig}
                      disabled={savingChartConfig || !chartConfigChanged}
                    >
                      {savingChartConfig ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Chart Settings
                    </Button>
                    {chartConfigChanged && (
                      <span className="text-xs text-amber-500">Unsaved changes</span>
                    )}
                  </div>

                  {/* Chart Title */}
                  {chartXColumn && chartYColumn && (
                    <p className="text-sm font-medium text-muted-foreground">
                      {chartYColumn} over {chartXColumn}
                    </p>
                  )}

                  {/* Chart */}
                  {chartData && chartData.length > 0 ? (
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey={chartXColumn} 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px',
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey={chartYColumn}
                            fill={CHART_COLORS[0]}
                            fillOpacity={0.1}
                            stroke="none"
                          />
                          <Line
                            type="monotone"
                            dataKey={chartYColumn}
                            stroke={CHART_COLORS[0]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      Select X and Y axis columns to generate chart
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Map Section */}
          {report.config.map.enabled && gpsPoints.length > 0 && (
            <section className="print:break-before-page">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">Location Map</CardTitle>
                  </div>
                  <CardDescription>
                    {gpsPoints.length} location{gpsPoints.length !== 1 ? 's' : ''} on map
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MapPanel
                    points={gpsPoints}
                    height={400}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {/* No Map Data Notice */}
          {report.config.map.enabled && gpsPoints.length === 0 && execution.data.gps === null && (
            <section>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">Location Map</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p>No GPS coordinates detected in query results</p>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function formatChartLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    // Try to format as date if it looks like a timestamp
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.includes('-')) {
      return date.toLocaleDateString();
    }
  }
  return String(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
