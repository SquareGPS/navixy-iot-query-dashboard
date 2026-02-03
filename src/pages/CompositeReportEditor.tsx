/**
 * CompositeReportEditor - Create/Edit page for Composite Reports
 * Provides SQL editor, component configuration, and live preview
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Play,
  Loader2,
  AlertCircle,
  Table as TableIcon,
  LineChart,
  Map,
  Settings,
  Eye,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import type { 
  CompositeReport, 
  CompositeReportConfig, 
  ColumnDetectionResult 
} from '@/types/dashboard-types';

const DEFAULT_CONFIG: CompositeReportConfig = {
  table: { enabled: true, pageSize: 50, showTotals: false },
  chart: { enabled: true, type: 'timeseries', xColumn: '', yColumns: [] },
  map: { enabled: false, autoDetect: true },
};

export default function CompositeReportEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id;
  const sectionId = searchParams.get('section_id');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [config, setConfig] = useState<CompositeReportConfig>(DEFAULT_CONFIG);

  // UI state
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [columns, setColumns] = useState<ColumnDetectionResult | null>(null);
  const [activeTab, setActiveTab] = useState('query');
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing report
  useEffect(() => {
    async function loadReport() {
      if (!id) return;

      setLoading(true);
      try {
        const response = await apiService.getCompositeReportById(id);
        if (response.error) {
          throw new Error(response.error.message);
        }

        const report = response.data as CompositeReport;
        setTitle(report.title);
        setDescription(report.description || '');
        setSqlQuery(report.sql_query);
        setConfig(report.config);
      } catch (error: any) {
        toast.error(`Failed to load report: ${error.message}`);
        navigate('/');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [id, navigate]);

  // Track changes
  useEffect(() => {
    if (!loading) {
      setHasChanges(true);
    }
  }, [title, description, sqlQuery, config]);

  // Detect columns from SQL query
  const detectColumns = useCallback(async () => {
    if (!sqlQuery.trim()) {
      toast.error('Please enter a SQL query first');
      return;
    }

    setDetecting(true);
    try {
      // For new reports, we need to create a temporary one or use a different endpoint
      // For now, we'll execute the query directly to get column info
      const response = await apiService.executeSQL({
        sql: sqlQuery,
        row_limit: 1,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const cols = response.data?.columns || [];
      
      // Determine suggestions based on column types
      const numericCols = cols.filter((c: any) => 
        ['real', 'double precision', 'numeric', 'integer', 'bigint', 'smallint'].some(t => c.type?.includes(t))
      );
      const timeCols = cols.filter((c: any) =>
        ['timestamp', 'date', 'time'].some(t => c.type?.includes(t))
      );

      // Detect GPS columns
      const latPatterns = ['lat', 'latitude', 'y_coord'];
      const lonPatterns = ['lon', 'lng', 'longitude', 'x_coord'];
      
      const latCol = cols.find((c: any) => 
        latPatterns.some(p => c.name.toLowerCase().includes(p))
      );
      const lonCol = cols.find((c: any) =>
        lonPatterns.some(p => c.name.toLowerCase().includes(p))
      );

      const detectionResult: ColumnDetectionResult = {
        columns: cols.map((c: any) => ({ name: c.name, type: c.type })),
        suggestions: {
          gps: latCol && lonCol ? { latColumn: latCol.name, lonColumn: lonCol.name } : null,
          xColumn: timeCols[0]?.name || cols[0]?.name,
          yColumns: numericCols.slice(0, 3).map((c: any) => c.name),
        },
      };

      setColumns(detectionResult);

      // Auto-apply suggestions if config is default
      if (!config.chart.xColumn && detectionResult.suggestions.xColumn) {
        setConfig(prev => ({
          ...prev,
          chart: {
            ...prev.chart,
            xColumn: detectionResult.suggestions.xColumn || '',
            yColumns: detectionResult.suggestions.yColumns || [],
          },
          map: {
            ...prev.map,
            enabled: !!detectionResult.suggestions.gps,
            latColumn: detectionResult.suggestions.gps?.latColumn,
            lonColumn: detectionResult.suggestions.gps?.lonColumn,
          },
        }));
      }

      toast.success(`Detected ${cols.length} columns`);
    } catch (error: any) {
      toast.error(`Failed to detect columns: ${error.message}`);
    } finally {
      setDetecting(false);
    }
  }, [sqlQuery, config]);

  // Save report
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!sqlQuery.trim()) {
      toast.error('Please enter a SQL query');
      return;
    }

    setSaving(true);
    try {
      const reportData = {
        title: title.trim(),
        description: description.trim() || undefined,
        sql_query: sqlQuery.trim(),
        config,
        section_id: sectionId || undefined,
      };

      let response;
      if (isNew) {
        response = await apiService.createCompositeReport(reportData);
      } else {
        response = await apiService.updateCompositeReport(id!, reportData);
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success(isNew ? 'Composite report created' : 'Composite report updated');
      setHasChanges(false);

      // Navigate to view page
      navigate(`/app/composite-report/${response.data.id}`);
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Update config helper
  const updateConfig = <K extends keyof CompositeReportConfig>(
    section: K,
    updates: Partial<CompositeReportConfig[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  };

  // Toggle Y column selection
  const toggleYColumn = (colName: string) => {
    setConfig(prev => {
      const yColumns = prev.chart.yColumns || [];
      const newYColumns = yColumns.includes(colName)
        ? yColumns.filter(c => c !== colName)
        : [...yColumns, colName];
      return {
        ...prev,
        chart: { ...prev.chart, yColumns: newYColumns },
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? 'New Composite Report' : 'Edit Composite Report'}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Create a report with table, chart, and map visualizations from a SQL query
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="My Composite Report"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Query and Configuration */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="query" className="gap-2">
              <Play className="h-4 w-4" />
              SQL Query
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Components
            </TabsTrigger>
          </TabsList>

          {/* SQL Query Tab */}
          <TabsContent value="query" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">SQL Query</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={detectColumns}
                    disabled={detecting || !sqlQuery.trim()}
                  >
                    {detecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Detect Columns
                  </Button>
                </div>
                <CardDescription>
                  Enter the SQL query that will power this report
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="font-mono min-h-[200px]"
                  placeholder="SELECT timestamp, value, latitude, longitude FROM my_table WHERE ..."
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                />

                {/* Detected Columns */}
                {columns && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Detected Columns</Label>
                    <div className="flex flex-wrap gap-2">
                      {columns.columns.map((col) => (
                        <Badge key={col.name} variant="secondary">
                          {col.name}
                          <span className="ml-1 text-xs opacity-70">({col.type})</span>
                        </Badge>
                      ))}
                    </div>

                    {columns.suggestions.gps && (
                      <div className="text-sm text-green-600 dark:text-green-400 mt-2">
                        GPS columns detected: {columns.suggestions.gps.latColumn}, {columns.suggestions.gps.lonColumn}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Components Configuration Tab */}
          <TabsContent value="config" className="mt-4 space-y-4">
            {/* Table Config */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Table</CardTitle>
                  </div>
                  <Switch
                    checked={config.table.enabled}
                    onCheckedChange={(checked) => updateConfig('table', { enabled: checked })}
                  />
                </div>
              </CardHeader>
              {config.table.enabled && (
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Page Size</Label>
                      <Select
                        value={String(config.table.pageSize)}
                        onValueChange={(v) => updateConfig('table', { pageSize: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 rows</SelectItem>
                          <SelectItem value="50">50 rows</SelectItem>
                          <SelectItem value="100">100 rows</SelectItem>
                          <SelectItem value="200">200 rows</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="showTotals"
                        checked={config.table.showTotals || false}
                        onCheckedChange={(checked) => updateConfig('table', { showTotals: checked })}
                      />
                      <Label htmlFor="showTotals">Show Totals Row</Label>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Chart Config */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Chart</CardTitle>
                  </div>
                  <Switch
                    checked={config.chart.enabled}
                    onCheckedChange={(checked) => updateConfig('chart', { enabled: checked })}
                  />
                </div>
              </CardHeader>
              {config.chart.enabled && (
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Chart Type</Label>
                      <Select
                        value={config.chart.type}
                        onValueChange={(v: 'timeseries' | 'bar') => updateConfig('chart', { type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timeseries">Time Series (Line)</SelectItem>
                          <SelectItem value="bar">Bar Chart</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>X-Axis Column</Label>
                      <Select
                        value={config.chart.xColumn || ''}
                        onValueChange={(v) => updateConfig('chart', { xColumn: v })}
                        disabled={!columns}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={columns ? 'Select column' : 'Detect columns first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {columns?.columns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Y-Axis Columns (select one or more)</Label>
                    {columns ? (
                      <div className="flex flex-wrap gap-2">
                        {columns.columns
                          .filter((col) =>
                            ['real', 'double precision', 'numeric', 'integer', 'bigint', 'smallint', 'decimal'].some(
                              (t) => col.type.includes(t)
                            )
                          )
                          .map((col) => (
                            <Badge
                              key={col.name}
                              variant={config.chart.yColumns?.includes(col.name) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => toggleYColumn(col.name)}
                            >
                              {col.name}
                            </Badge>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Click "Detect Columns" in the SQL Query tab first
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Map Config */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Map</CardTitle>
                  </div>
                  <Switch
                    checked={config.map.enabled}
                    onCheckedChange={(checked) => updateConfig('map', { enabled: checked })}
                  />
                </div>
                <CardDescription>
                  Display data points on an interactive map (requires GPS coordinates)
                </CardDescription>
              </CardHeader>
              {config.map.enabled && (
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoDetect"
                      checked={config.map.autoDetect}
                      onCheckedChange={(checked) => updateConfig('map', { autoDetect: checked })}
                    />
                    <Label htmlFor="autoDetect">Auto-detect GPS columns</Label>
                  </div>

                  {!config.map.autoDetect && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Latitude Column</Label>
                        <Select
                          value={config.map.latColumn || ''}
                          onValueChange={(v) => updateConfig('map', { latColumn: v })}
                          disabled={!columns}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {columns?.columns.map((col) => (
                              <SelectItem key={col.name} value={col.name}>
                                {col.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Longitude Column</Label>
                        <Select
                          value={config.map.lonColumn || ''}
                          onValueChange={(v) => updateConfig('map', { lonColumn: v })}
                          disabled={!columns}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {columns?.columns.map((col) => (
                              <SelectItem key={col.name} value={col.name}>
                                {col.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {columns?.suggestions.gps && config.map.autoDetect && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Will use auto-detected columns: {columns.suggestions.gps.latColumn}, {columns.suggestions.gps.lonColumn}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
