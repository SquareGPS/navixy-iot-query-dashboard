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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  Clock,
  Database,
  Loader2,
  AlertCircle,
  Table as TableIcon,
  LineChart,
  Map as MapIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Save, Play, MapPin, FileText, Lock, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CompositeReport, CompositeReportExecutionResult, GPSPoint } from '@/types/dashboard-types';
import { MapPanel, MapViewState } from '@/components/reports/visualizations/MapPanel';
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default function CompositeReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

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
  const [exporting, setExporting] = useState<'excel' | 'html' | 'pdf' | null>(null);
  const [excelFormat, setExcelFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [editableSql, setEditableSql] = useState('');
  const [savingSql, setSavingSql] = useState(false);
  const [savingChartConfig, setSavingChartConfig] = useState(false);
  const [savingTableConfig, setSavingTableConfig] = useState(false);
  const [tableSettingsExpanded, setTableSettingsExpanded] = useState(false);

  // Editable table settings (local state, saved explicitly)
  const [editPageSize, setEditPageSize] = useState(50);
  const [editMaxRows, setEditMaxRows] = useState(10000);
  const [editShowTotals, setEditShowTotals] = useState(false);

  // Geocoding state
  const [geocodeEnabled, setGeocodeEnabled] = useState(false);
  const [geocodedAddresses, setGeocodedAddresses] = useState<Map<string, string>>(new Map());
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeConfirmOpen, setGeocodeConfirmOpen] = useState(false);

  const hasSessionId = useMemo(() => {
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    return payload?.session_id != null;
  }, [token]);
  
  // Map view state (for export sync)
  const [mapViewState, setMapViewState] = useState<MapViewState | null>(null);
  
  // Table pagination state
  const [tablePage, setTablePage] = useState(1);

  // Chart column selection state
  const [chartXColumn, setChartXColumn] = useState<string>('');

  const [chartYColumn, setChartYColumn] = useState<string>('');
  const [chartColorColumn, setChartColorColumn] = useState<string>('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]); // Filter by specific group values

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
        const tableConfig = response.data.config?.table;
        if (tableConfig) {
          setEditPageSize(tableConfig.pageSize || 50);
          setEditMaxRows(tableConfig.maxRows || 10000);
          setEditShowTotals(tableConfig.showTotals || false);
        }
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
      const maxRows = report?.config.table.maxRows || 10000;
      const response = await apiService.executeCompositeReport(id, {
        page: 1,
        pageSize: maxRows,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setExecution({
        loading: false,
        error: null,
        data: response.data,
        lastExecuted: new Date(),
      });
      setTablePage(1);
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
      const defaultGroup = report.config.chart.colorColumn || 'none';
      
      if (!chartXColumn) setChartXColumn(defaultX);
      if (!chartYColumn) setChartYColumn(defaultY);
      if (!chartColorColumn) setChartColorColumn(defaultGroup);
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

  // All detected GPS column pairs (for geocoding)
  const gpsPairs = useMemo<Array<{ latColumn: string; lonColumn: string }>>(() => {
    if (execution.data?.gpsPairs && execution.data.gpsPairs.length > 0) return execution.data.gpsPairs;
    if (execution.data?.gps) return [{ latColumn: execution.data.gps.latColumn, lonColumn: execution.data.gps.lonColumn }];
    return [];
  }, [execution.data?.gpsPairs, execution.data?.gps]);

  // Count of unique geocodable coordinates across ALL rows and ALL GPS pairs
  const geocodableCount = useMemo(() => {
    if (gpsPairs.length === 0 || !rowObjects.length) return 0;
    const seen = new Set<string>();
    for (const pair of gpsPairs) {
      for (const row of rowObjects) {
        const lat = parseFloat(String(row[pair.latColumn]));
        const lng = parseFloat(String(row[pair.lonColumn]));
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          seen.add(`${lat.toFixed(6)},${lng.toFixed(6)}`);
        }
      }
    }
    return seen.size;
  }, [gpsPairs, rowObjects]);

  // Geocode ALL coordinates from ALL GPS pairs when enabled
  useEffect(() => {
    if (!geocodeEnabled || gpsPairs.length === 0 || !rowObjects.length) {
      return;
    }

    const geocodeCoordinates = async () => {
      setGeocoding(true);
      
      const coordsToGeocode: { lat: number; lng: number }[] = [];
      const seen = new Set<string>();
      
      for (const pair of gpsPairs) {
        for (const row of rowObjects) {
          const lat = parseFloat(String(row[pair.latColumn]));
          const lng = parseFloat(String(row[pair.lonColumn]));
          
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (!geocodedAddresses.has(key) && !seen.has(key)) {
              seen.add(key);
              coordsToGeocode.push({ lat, lng });
            }
          }
        }
      }

      if (coordsToGeocode.length === 0) {
        setGeocoding(false);
        return;
      }

      try {
        const response = await apiService.geocodeBatch(coordsToGeocode);
        
        if (response.data?.results) {
          setGeocodedAddresses(prev => {
            const updated = new Map(prev);
            for (const result of response.data.results) {
              if (result.address) {
                const key = `${result.lat.toFixed(6)},${result.lng.toFixed(6)}`;
                updated.set(key, result.address);
              }
            }
            return updated;
          });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        toast.error('Geocoding failed. Please try again.');
      }
      
      setGeocoding(false);
    };

    geocodeCoordinates();
  }, [geocodeEnabled, gpsPairs, rowObjects]);

  // Get address for coordinates
  const getAddressForCoords = useCallback((lat: number, lng: number): string | null => {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    return geocodedAddresses.get(key) || null;
  }, [geocodedAddresses]);

  // Get unique group values for the chart - scan ALL rows to find all groups
  const chartGroupValues = useMemo(() => {
    if (!chartColorColumn || chartColorColumn === 'none' || !rowObjects.length) return [];
    
    const uniqueValues = new Set<string>();
    for (const row of rowObjects) {
      const groupVal = row[chartColorColumn];
      if (groupVal !== null && groupVal !== undefined) {
        uniqueValues.add(String(groupVal));
      }
    }
    return Array.from(uniqueValues).slice(0, 10); // Limit to 10 groups for readability
  }, [chartColorColumn, rowObjects]);

  // Get active groups to display (filtered if any selected, otherwise all)
  const activeGroups = useMemo(() => {
    if (selectedGroups.length > 0) {
      return chartGroupValues.filter(g => selectedGroups.includes(g));
    }
    return chartGroupValues;
  }, [chartGroupValues, selectedGroups]);

  // Prepare chart data using selected columns
  const chartData = useMemo(() => {
    if (!report?.config.chart.enabled || !execution.data) return null;
    if (!chartXColumn || !chartYColumn) return null;

    const hasGrouping = chartColorColumn && chartColorColumn !== 'none' && chartGroupValues.length > 0;

    if (hasGrouping) {
      // Filter rows to only include active groups
      const groupsToShow = activeGroups.length > 0 ? activeGroups : chartGroupValues;
      const filteredRows = rowObjects.filter(row => {
        const groupVal = String(row[chartColorColumn] ?? 'Unknown');
        return groupsToShow.includes(groupVal);
      });

      // Sort rows by X value first
      const sortedRows = [...filteredRows].sort((a, b) => {
        const aVal = a[chartXColumn];
        const bVal = b[chartXColumn];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });

      // Create data points - each row creates a point with its group's Y value
      const dataPoints: Record<string, unknown>[] = [];
      const seenX = new Map<string, number>(); // Map to track indices by X value
      
      for (const row of sortedRows) {
        const xRaw = row[chartXColumn];
        const xFormatted = formatChartLabel(xRaw, true); // Include time
        const groupVal = String(row[chartColorColumn] ?? 'Unknown');
        const yVal = row[chartYColumn];
        const yNumeric = typeof yVal === 'number' ? yVal : parseFloat(String(yVal)) || 0;
        
        const xKey = String(xRaw);
        
        if (!seenX.has(xKey)) {
          // New X value - create a new data point
          const point: Record<string, unknown> = { [chartXColumn]: xFormatted };
          // Initialize only active groups to null
          for (const group of groupsToShow) {
            point[group] = null;
          }
          point[groupVal] = yNumeric;
          dataPoints.push(point);
          seenX.set(xKey, dataPoints.length - 1);
        } else {
          // Existing X value - update the point with this group's value
          const idx = seenX.get(xKey)!;
          dataPoints[idx][groupVal] = yNumeric;
        }
      }
      
      return dataPoints;
    } else {
      // No grouping - single series
      return rowObjects.slice(0, 200).map(row => {
        const point: Record<string, unknown> = {
          [chartXColumn]: formatChartLabel(row[chartXColumn], true),
        };
        
        const val = row[chartYColumn];
        point[chartYColumn] = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        
        return point;
      });
    }
  }, [report?.config.chart.enabled, execution.data, rowObjects, chartXColumn, chartYColumn, chartColorColumn, chartGroupValues, activeGroups]);

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
  const savedGroupColumn = report?.config.chart.colorColumn || 'none';
  const currentGroupColumn = chartColorColumn || 'none';
  const chartConfigChanged = report && (
    chartXColumn !== (report.config.chart.xColumn || '') ||
    chartYColumn !== (report.config.chart.yColumns?.[0] || '') ||
    currentGroupColumn !== savedGroupColumn
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

  // Check if table config has unsaved changes
  const tableConfigChanged = report && (
    editPageSize !== (report.config.table.pageSize || 50) ||
    editMaxRows !== (report.config.table.maxRows || 10000) ||
    editShowTotals !== (report.config.table.showTotals || false)
  );

  // Save table configuration
  const handleSaveTableConfig = async () => {
    if (!id || !report) return;

    setSavingTableConfig(true);
    try {
      const updatedConfig = {
        ...report.config,
        table: {
          ...report.config.table,
          pageSize: editPageSize,
          maxRows: editMaxRows,
          showTotals: editShowTotals,
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
      setTablePage(1);
      toast.success('Table settings saved');
    } catch (error: any) {
      toast.error(`Failed to save table settings: ${error.message}`);
    } finally {
      setSavingTableConfig(false);
    }
  };

  // Prepare geocoded addresses and cached execution data for export.
  // We pass the already-fetched rows so the backend doesn't re-execute the query
  // (which could return different data for relative time windows like "last 24h").
  const getExportGeocodingOptions = () => {
    const base: Record<string, unknown> = {};

    if (execution.data) {
      base.cachedData = {
        columns: execution.data.columns,
        rows: execution.data.rows,
      };
    }

    if (!geocodeEnabled || geocodedAddresses.size === 0 || gpsPairs.length === 0) {
      return base;
    }
    
    const addressesObj: Record<string, string> = {};
    geocodedAddresses.forEach((address, key) => {
      addressesObj[key] = address;
    });
    
    return {
      ...base,
      geocodedAddresses: addressesObj,
      latColumn: gpsPairs[0].latColumn,
      lonColumn: gpsPairs[0].lonColumn,
      gpsPairs,
    };
  };

  // Export handlers
  const handleExportExcel = async (format: 'xlsx' | 'csv' = excelFormat) => {
    if (!id) return;
    
    setExporting('excel');
    try {
      const blob = await apiService.exportCompositeReportExcel(id, {
        ...getExportGeocodingOptions(),
        format,
      });
      if (blob) {
        const extension = format === 'csv' ? 'csv' : 'xlsx';
        downloadBlob(blob, `${report?.slug || 'composite-report'}.${extension}`);
        toast.success(`${format.toUpperCase()} export downloaded`);
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
        ...getExportGeocodingOptions(),
        chartSettings: {
          xColumn: chartXColumn || undefined,
          yColumn: chartYColumn || undefined,
          groupColumn: chartColorColumn && chartColorColumn !== 'none' ? chartColorColumn : undefined,
        },
        mapSettings: mapViewState ? {
          center: mapViewState.center,
          zoom: mapViewState.zoom,
        } : undefined,
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

  const handleExportPDF = async () => {
    if (!id) return;
    
    setExporting('pdf');
    try {
      const blob = await apiService.exportCompositeReportPDF(id, {
        includeChart: report?.config.chart.enabled,
        includeMap: report?.config.map.enabled && gpsPoints.length > 0,
        ...getExportGeocodingOptions(),
        chartSettings: {
          xColumn: chartXColumn || undefined,
          yColumn: chartYColumn || undefined,
          groupColumn: chartColorColumn && chartColorColumn !== 'none' ? chartColorColumn : undefined,
        },
        mapSettings: mapViewState ? {
          center: mapViewState.center,
          zoom: mapViewState.zoom,
        } : undefined,
      });
      if (blob) {
        downloadBlob(blob, `${report?.slug || 'composite-report'}.pdf`);
        toast.success('PDF export downloaded');
      } else {
        throw new Error('PDF export failed');
      }
    } catch (error: any) {
      toast.error(`PDF export failed: ${error.message}`);
    } finally {
      setExporting(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Report not found</p>
          <Button variant="outline" onClick={() => navigate('/app')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-6 px-4 print:py-0 print:px-0">
      {/* Header */}
      <header className="mb-8 print:mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!exporting || !execution.data}
                >
                  {exporting === 'excel' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  Excel
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportExcel('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={!!exporting || !execution.data}
            >
              {exporting === 'pdf' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              PDF
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
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <TableIcon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-xl">Data Table</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 print:hidden"
                          onClick={() => setTableSettingsExpanded(prev => !prev)}
                          title="Table settings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        {tableConfigChanged && (
                          <span className="text-xs text-amber-500 print:hidden">unsaved</span>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {execution.data.rows.length} rows loaded
                      </CardDescription>
                    </div>
                    
                    {/* Geocode Checkbox - show if any GPS column pairs detected */}
                    {gpsPairs.length > 0 && (
                      <div className="flex items-center gap-2 print:hidden" title={!hasSessionId ? 'Geocoding requires a session. Please log in via the Navixy platform.' : undefined}>
                        <Checkbox
                          id="geocode"
                          checked={geocodeEnabled}
                          disabled={!hasSessionId || geocoding}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              setGeocodeConfirmOpen(true);
                            } else {
                              setGeocodeEnabled(false);
                              setGeocodedAddresses(new Map());
                            }
                          }}
                        />
                        <label
                          htmlFor="geocode"
                          className={`text-sm font-medium leading-none flex items-center gap-1 ${!hasSessionId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {!hasSessionId ? <Lock className="h-3 w-3" /> : <MapPin className="h-4 w-4" />}
                          Geocode to address
                          {geocoding && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Geocoding Confirmation Dialog */}
                  <AlertDialog open={geocodeConfirmOpen} onOpenChange={setGeocodeConfirmOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Enable Geocoding?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>
                            This will geocode <strong>{geocodableCount.toLocaleString()}</strong> unique coordinate{geocodableCount !== 1 ? 's' : ''} to street addresses.
                          </p>
                          <p>
                            This operation may take some time and will be billed according to your Navixy geocoding tariff.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setGeocodeEnabled(true)}>
                          Geocode {geocodableCount.toLocaleString()} coordinates
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>

                {/* Table Settings Panel */}
                {tableSettingsExpanded && (
                  <div className="px-6 pb-4 space-y-3 border-b print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Page Size</Label>
                        <Select
                          value={String(editPageSize)}
                          onValueChange={(v) => setEditPageSize(parseInt(v))}
                        >
                          <SelectTrigger className="h-8">
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
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Max Rows</Label>
                        <Select
                          value={String(editMaxRows)}
                          onValueChange={(v) => setEditMaxRows(parseInt(v))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1000">1 000</SelectItem>
                            <SelectItem value="5000">5 000</SelectItem>
                            <SelectItem value="10000">10 000</SelectItem>
                            <SelectItem value="50000">50 000</SelectItem>
                            <SelectItem value="100000">100 000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 h-8">
                        <Switch
                          id="editShowTotals"
                          checked={editShowTotals}
                          onCheckedChange={setEditShowTotals}
                        />
                        <Label htmlFor="editShowTotals" className="text-sm">Show Totals</Label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={handleSaveTableConfig}
                        disabled={savingTableConfig || !tableConfigChanged}
                      >
                        {savingTableConfig ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                )}

                <CardContent>
                  {(() => {
                    const tablePageSize = report.config.table.pageSize || 50;
                    const totalRows = execution.data!.rows.length;
                    const totalPages = Math.max(1, Math.ceil(totalRows / tablePageSize));
                    const safeTablePage = Math.min(tablePage, totalPages);
                    const startIdx = (safeTablePage - 1) * tablePageSize;
                    const endIdx = Math.min(startIdx + tablePageSize, totalRows);
                    const pageRows = execution.data!.rows.slice(startIdx, endIdx);
                    const showTotals = report.config.table.showTotals === true;

                    const emptyColumnIndices = new Set<number>();
                    execution.data!.columns.forEach((_, idx) => {
                      if (isColumnEmpty(execution.data?.rows || [], idx)) {
                        emptyColumnIndices.add(idx);
                      }
                    });

                    const numericTotals: Record<number, number> = {};
                    if (showTotals) {
                      execution.data!.columns.forEach((col, idx) => {
                        if (emptyColumnIndices.has(idx)) return;
                        const colType = col.type?.toLowerCase() || '';
                        const isNumeric = ['real', 'double precision', 'numeric', 'integer', 'bigint', 'smallint', 'decimal', 'float', 'int'].some(t => colType.includes(t));
                        if (isNumeric) {
                          numericTotals[idx] = execution.data!.rows.reduce((acc, row) => {
                            const val = row[idx];
                            return acc + (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
                          }, 0);
                        }
                      });
                    }

                    return (
                      <>
                        <div className="overflow-x-auto">
                          <div className="max-h-[600px] overflow-y-auto border rounded-md">
                            <Table>
                              <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                  {execution.data!.columns.map((col, colIdx) => {
                                    if (emptyColumnIndices.has(colIdx)) return null;
                                    if (geocodeEnabled && gpsPairs.length > 0) {
                                      const pairAsLat = gpsPairs.find(p => p.latColumn === col.name);
                                      if (pairAsLat) {
                                        const prefix = col.name.replace(/[_]?(lat|latitude|y_coord|y_coordinate|y)$/i, '').replace(/_+$/, '');
                                        const label = prefix ? `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Address` : 'Address';
                                        return (
                                          <TableHead key={col.name} className="whitespace-nowrap bg-background">
                                            {label}
                                          </TableHead>
                                        );
                                      }
                                      if (gpsPairs.some(p => p.lonColumn === col.name)) return null;
                                    }
                                    return (
                                      <TableHead key={col.name} className="whitespace-nowrap bg-background">
                                        {col.name}
                                      </TableHead>
                                    );
                                  }).filter(Boolean)}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pageRows.map((row, rowIdx) => {
                                  return (
                                    <TableRow key={startIdx + rowIdx}>
                                      {execution.data!.columns.map((col, cellIdx) => {
                                        if (emptyColumnIndices.has(cellIdx)) return null;
                                        const colName = col.name;
                                        const cell = row[cellIdx];
                                        if (geocodeEnabled && gpsPairs.length > 0) {
                                          if (gpsPairs.some(p => p.lonColumn === colName)) return null;
                                          const pairForLat = gpsPairs.find(p => p.latColumn === colName);
                                          if (pairForLat) {
                                            const latIdx = execution.data!.columns.findIndex(c => c.name === pairForLat.latColumn);
                                            const lonIdx = execution.data!.columns.findIndex(c => c.name === pairForLat.lonColumn);
                                            const lat = parseFloat(String(row[latIdx]));
                                            const lng = parseFloat(String(row[lonIdx]));
                                            const address = getAddressForCoords(lat, lng);
                                            return (
                                              <TableCell key={cellIdx} className="max-w-[400px]">
                                                {address || (geocoding ? (
                                                  <span className="text-muted-foreground italic">Loading...</span>
                                                ) : (
                                                  <span className="text-muted-foreground">{`${lat.toFixed(6)}, ${lng.toFixed(6)}`}</span>
                                                ))}
                                              </TableCell>
                                            );
                                          }
                                        }
                                        return (
                                          <TableCell key={cellIdx} className="max-w-[300px] truncate">
                                            {formatCellValue(cell)}
                                          </TableCell>
                                        );
                                      }).filter(Boolean)}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                              {showTotals && Object.keys(numericTotals).length > 0 && (
                                <tfoot>
                                  <TableRow className="border-t-2 font-semibold bg-muted/50">
                                    {execution.data!.columns.map((col, colIdx) => {
                                      if (emptyColumnIndices.has(colIdx)) return null;
                                      if (geocodeEnabled && gpsPairs.length > 0) {
                                        if (gpsPairs.some(p => p.lonColumn === col.name)) return null;
                                      }
                                      return (
                                        <TableCell key={colIdx} className="font-semibold">
                                          {colIdx in numericTotals
                                            ? formatCellValue(numericTotals[colIdx])
                                            : colIdx === 0 ? 'Total' : ''}
                                        </TableCell>
                                      );
                                    }).filter(Boolean)}
                                  </TableRow>
                                </tfoot>
                              )}
                            </Table>
                          </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-3 print:hidden">
                          <div className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={exporting === 'excel'}>
                                  {exporting === 'excel' ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                  )}
                                  Download
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => handleExportExcel('xlsx')}>
                                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                                  Excel (.xlsx)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportExcel('csv')}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  CSV (.csv)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {totalRows === 0 ? 'No rows' : `${startIdx + 1}–${endIdx} of ${totalRows} rows`}
                            </span>
                            {totalPages > 1 && (
                              <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTablePage(1)} disabled={safeTablePage === 1} title="First page">
                                  <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safeTablePage === 1} title="Previous page">
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm text-muted-foreground px-2">
                                  {safeTablePage} / {totalPages}
                                </span>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} disabled={safeTablePage >= totalPages} title="Next page">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTablePage(totalPages)} disabled={safeTablePage >= totalPages} title="Last page">
                                  <ChevronsRight className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
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
                      <Label htmlFor="group-by">Group by</Label>
                      <Select value={chartColorColumn} onValueChange={(val) => {
                        setChartColorColumn(val);
                        setSelectedGroups([]); // Reset filter when group column changes
                      }}>
                        <SelectTrigger id="group-by">
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
                      {chartColorColumn && chartColorColumn !== 'none' && ` (grouped by ${chartColorColumn})`}
                    </p>
                  )}

                  {/* Chart */}
                  {chartData && chartData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey={chartXColumn} 
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              interval="preserveStartEnd"
                              minTickGap={50}
                              angle={-20}
                              textAnchor="end"
                              height={50}
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
                            {/* No built-in Legend - using custom clickable legend below */}
                            {chartColorColumn && chartColorColumn !== 'none' && chartGroupValues.length > 0 ? (
                              // Grouped chart - multiple series (filtered by activeGroups)
                              <>
                                {activeGroups.map((groupVal) => {
                                  // Use original index from chartGroupValues to maintain consistent colors
                                  const colorIdx = chartGroupValues.indexOf(groupVal);
                                  const color = CHART_COLORS[colorIdx % CHART_COLORS.length];
                                  return (
                                    <React.Fragment key={groupVal}>
                                      <Line
                                        type="monotone"
                                        dataKey={groupVal}
                                        name={groupVal}
                                        stroke={color}
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: color }}
                                        connectNulls={true}
                                      />
                                    </React.Fragment>
                                  );
                                })}
                              </>
                            ) : (
                              // Single series chart
                              <>
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
                              </>
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Custom Clickable Legend */}
                      {chartColorColumn && chartColorColumn !== 'none' && chartGroupValues.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 print:gap-x-3">
                          {chartGroupValues.map((groupVal, idx) => {
                            const isActive = selectedGroups.length === 0 || selectedGroups.includes(groupVal);
                            const color = CHART_COLORS[idx % CHART_COLORS.length];
                            
                            return (
                              <button
                                key={groupVal}
                                onClick={() => {
                                  if (selectedGroups.length === 0) {
                                    // No filter - click to filter to this one
                                    setSelectedGroups([groupVal]);
                                  } else if (selectedGroups.includes(groupVal) && selectedGroups.length === 1) {
                                    // This is the only one selected - clear filter (show all)
                                    setSelectedGroups([]);
                                  } else {
                                    // Filter to this one
                                    setSelectedGroups([groupVal]);
                                  }
                                }}
                                className={`
                                  flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-all
                                  hover:bg-muted/50 cursor-pointer
                                  ${isActive ? '' : 'opacity-40 grayscale'}
                                  ${selectedGroups.includes(groupVal) && selectedGroups.length > 0 ? 'bg-muted ring-1 ring-primary/30' : ''}
                                `}
                                title={isActive ? 'Click to filter' : 'Click to show only this'}
                              >
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: isActive ? color : '#9ca3af' }}
                                />
                                <span className={isActive ? 'text-foreground' : 'text-muted-foreground'}>
                                  {groupVal}
                                </span>
                              </button>
                            );
                          })}
                          {selectedGroups.length > 0 && (
                            <button
                              onClick={() => setSelectedGroups([])}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                            >
                              Show all
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Single series legend */}
                      {(!chartColorColumn || chartColorColumn === 'none' || chartGroupValues.length === 0) && (
                        <div className="flex justify-center">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[0] }}
                            />
                            <span>{chartYColumn}</span>
                          </div>
                        </div>
                      )}
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
                    <MapIcon className="h-5 w-5 text-muted-foreground" />
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
                    onViewChange={setMapViewState}
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
                    <MapIcon className="h-5 w-5 text-muted-foreground" />
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
    </AppLayout>
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
  if (typeof value === 'number') {
    // Trim trailing zeros for numbers (especially coordinates)
    // Use parseFloat(toFixed) to remove trailing zeros while keeping precision
    const str = value.toString();
    // Check if it's a coordinate-like number (has many decimal places)
    if (str.includes('.') && str.split('.')[1]?.length > 6) {
      // Remove trailing zeros
      return parseFloat(value.toPrecision(15)).toString();
    }
    return str;
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      // Short locale format for Date objects
      return value.toLocaleString(undefined, {
        day: 'numeric',
        month: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return JSON.stringify(value);
  }
  // Check if string looks like a number with trailing zeros (from DB)
  if (typeof value === 'string' && /^-?\d+\.\d+0+$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num.toString();
    }
  }
  // Check if string looks like an ISO date/timestamp
  if (typeof value === 'string' && value.includes('-') && !isNaN(Date.parse(value))) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // Short locale format for date strings
      return date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return String(value);
}

// Check if a column has any non-empty values
function isColumnEmpty(rows: unknown[][], colIdx: number): boolean {
  return rows.every(row => {
    const val = row[colIdx];
    return val === null || val === undefined || val === '';
  });
}

function formatChartLabel(value: unknown, includeTime: boolean = false): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    // Try to format as date if it looks like a timestamp
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.includes('-')) {
      if (includeTime) {
        // Short locale format: "2/2/26, 10:00 PM" or "02.02.26, 22:00"
        return date.toLocaleString(undefined, { 
          day: 'numeric',
          month: 'numeric',
          year: '2-digit',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
      // Short date only: "2/2/26" or "02.02.26"
      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'numeric', 
        year: '2-digit',
      });
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
