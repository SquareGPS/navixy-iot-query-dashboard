/**
 * Export Service
 * Handles generation of Excel and HTML exports for composite reports
 */

import ExcelJS from 'exceljs';
import { logger } from '../utils/logger.js';

export interface ExportColumn {
  name: string;
  type: string;
}

export interface ExcelExportOptions {
  title: string;
  description?: string | null;
  columns: ExportColumn[];
  rows: unknown[][];
  executedAt: Date;
}

export interface HTMLExportOptions {
  title: string;
  description?: string | null;
  columns: ExportColumn[];
  rows: unknown[][];
  config: {
    table?: { enabled: boolean; pageSize?: number; showTotals?: boolean };
    chart?: { enabled: boolean; type?: string; xColumn?: string; yColumns?: string[] };
    map?: { enabled: boolean; latColumn?: string; lonColumn?: string };
  };
  gpsColumns?: { latColumn: string; lonColumn: string } | null;
  includeChart?: boolean;
  executedAt: Date;
  // Override chart settings from frontend
  chartSettings?: {
    xColumn?: string;
    yColumn?: string;
    groupColumn?: string;
  };
  // Map view state from frontend (center and zoom)
  mapSettings?: {
    center: [number, number];
    zoom: number;
  };
}

export class ExportService {
  private static instance: ExportService;

  static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  /**
   * Generate Excel file from composite report data
   */
  async generateExcel(options: ExcelExportOptions): Promise<Buffer> {
    const { title, description, columns, rows, executedAt } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Dashboard Studio';
    workbook.created = executedAt;

    // Filter out empty columns
    const emptyColumnIndices = new Set<number>();
    columns.forEach((col, idx) => {
      const isEmpty = rows.every(row => {
        const val = row[idx];
        return val === null || val === undefined || val === '';
      });
      if (isEmpty) {
        emptyColumnIndices.add(idx);
      }
    });
    const visibleColumns = columns.filter((_, idx) => !emptyColumnIndices.has(idx));

    // Create data sheet
    const dataSheet = workbook.addWorksheet('Data');

    // Add header row
    dataSheet.columns = visibleColumns.map(col => ({
      header: col.name,
      key: col.name,
      width: Math.max(col.name.length + 2, 15),
    }));

    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    rows.forEach((row) => {
      const rowData: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        // Skip empty columns
        if (emptyColumnIndices.has(idx)) {
          return;
        }
        
        let value = row[idx];
        
        // Convert values based on type
        if (value === null || value === undefined) {
          rowData[col.name] = '';
        } else if (col.type.includes('timestamp') || col.type.includes('date')) {
          // Handle date/timestamp values
          const dateValue = new Date(value as string);
          rowData[col.name] = isNaN(dateValue.getTime()) ? value : dateValue;
        } else if (col.type.includes('int') || col.type.includes('numeric') || col.type.includes('real') || col.type.includes('double')) {
          // Handle numeric values - parseFloat automatically removes trailing zeros
          rowData[col.name] = typeof value === 'string' ? parseFloat(value) : value;
        } else {
          rowData[col.name] = value;
        }
      });
      dataSheet.addRow(rowData);
    });

    // Auto-fit columns and apply date formatting
    dataSheet.columns.forEach((column, colIdx) => {
      if (column.values) {
        let maxLength = 0;
        column.values.forEach((value) => {
          const length = value ? String(value).length : 0;
          if (length > maxLength) {
            maxLength = length;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
      
      // Apply short date format to date/timestamp columns
      const col = visibleColumns[colIdx];
      if (col && (col.type.includes('timestamp') || col.type.includes('date'))) {
        // Apply date format to all cells in this column (skip header row)
        for (let rowNum = 2; rowNum <= rows.length + 1; rowNum++) {
          const cell = dataSheet.getCell(rowNum, colIdx + 1);
          if (cell.value instanceof Date) {
            cell.numFmt = 'dd/mm/yy hh:mm';
          }
        }
      }
    });

    // Add freeze pane for header
    dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Create info sheet
    const infoSheet = workbook.addWorksheet('Report Info');
    infoSheet.columns = [
      { header: 'Property', key: 'property', width: 20 },
      { header: 'Value', key: 'value', width: 60 },
    ];

    // Style info header
    const infoHeader = infoSheet.getRow(1);
    infoHeader.font = { bold: true };
    infoHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add report metadata
    infoSheet.addRow({ property: 'Report Title', value: title });
    if (description) {
      infoSheet.addRow({ property: 'Description', value: description });
    }
    infoSheet.addRow({ property: 'Executed At', value: executedAt.toISOString() });
    infoSheet.addRow({ property: 'Total Rows', value: rows.length });
    infoSheet.addRow({ property: 'Total Columns', value: columns.length });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    logger.info('Generated Excel export', { 
      title, 
      rowCount: rows.length, 
      columnCount: columns.length 
    });

    return Buffer.from(buffer);
  }

  /**
   * Generate CSV file from composite report data
   */
  generateCSV(options: ExcelExportOptions): Buffer {
    const { columns, rows } = options;
    
    // Filter out empty columns
    const emptyColumnIndices = new Set<number>();
    columns.forEach((col, idx) => {
      const isEmpty = rows.every(row => {
        const val = row[idx];
        return val === null || val === undefined || val === '';
      });
      if (isEmpty) {
        emptyColumnIndices.add(idx);
      }
    });
    const visibleColumns = columns.filter((_, idx) => !emptyColumnIndices.has(idx));
    
    const lines: string[] = [];
    
    // Add header row
    lines.push(visibleColumns.map(col => this.escapeCSVField(col.name)).join(','));
    
    // Add data rows
    rows.forEach((row) => {
      const csvRow: string[] = [];
      columns.forEach((col, idx) => {
        // Skip empty columns
        if (emptyColumnIndices.has(idx)) {
          return;
        }
        
        let value = row[idx];
        
        if (value === null || value === undefined) {
          csvRow.push('');
          return;
        }
        
        // Format dates in short locale format
        if (col.type.includes('timestamp') || col.type.includes('date')) {
          const dateValue = new Date(value as string);
          if (!isNaN(dateValue.getTime())) {
            csvRow.push(this.escapeCSVField(this.formatShortDateTime(dateValue)));
            return;
          }
        }
        
        // Trim trailing zeros for numeric values
        if (typeof value === 'number') {
          csvRow.push(this.escapeCSVField(this.formatNumericValue(value)));
          return;
        }
        
        // Check for string numbers with trailing zeros
        if (typeof value === 'string' && /^-?\d+\.\d+0+$/.test(value)) {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            csvRow.push(this.escapeCSVField(this.formatNumericValue(num)));
            return;
          }
        }
        
        csvRow.push(this.escapeCSVField(String(value)));
      });
      lines.push(csvRow.join(','));
    });
    
    const csvContent = lines.join('\n');
    
    logger.info('Generated CSV export', { 
      rowCount: rows.length, 
      columnCount: visibleColumns.length 
    });
    
    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Escape a field for CSV format
   */
  private escapeCSVField(value: string): string {
    // If field contains comma, quote, or newline, wrap in quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      // Escape quotes by doubling them
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format date/time in short format (e.g., "02/02/26 22:00")
   * Uses manual formatting to avoid Node.js locale issues in Docker/Alpine
   */
  private formatShortDateTime(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Format a numeric value, trimming trailing zeros (for coordinates)
   */
  private formatNumericValue(value: number): string {
    // Remove trailing zeros while keeping precision
    return parseFloat(value.toPrecision(15)).toString();
  }

  /**
   * Check if a column is empty (all values are null/undefined/empty string)
   */
  private isColumnEmpty(rows: Record<string, unknown>[], colName: string): boolean {
    return rows.every(row => {
      const val = row[colName];
      return val === null || val === undefined || val === '';
    });
  }

  /**
   * Filter out columns that have no values
   */
  private filterEmptyColumns(columns: ExportColumn[], rows: Record<string, unknown>[]): ExportColumn[] {
    return columns.filter(col => !this.isColumnEmpty(rows, col.name));
  }

  /**
   * Generate self-contained HTML from composite report data
   */
  async generateHTML(options: HTMLExportOptions): Promise<string> {
    const { title, description, columns, rows, config, gpsColumns, includeChart, executedAt, chartSettings } = options;

    // Convert rows to objects for easier template processing
    const rowObjects = rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        obj[col.name] = row[idx];
      });
      return obj;
    });

    // Generate table HTML
    const tableHTML = this.generateTableHTML(columns, rowObjects);

    // Generate chart HTML/JS if enabled
    // Use chartSettings from frontend if provided, otherwise fall back to config
    let chartHTML = '';
    const effectiveXColumn = chartSettings?.xColumn || config.chart?.xColumn;
    const effectiveYColumn = chartSettings?.yColumn;
    const effectiveGroupColumn = chartSettings?.groupColumn;
    const effectiveYColumns = effectiveYColumn ? [effectiveYColumn] : config.chart?.yColumns;
    
    if (includeChart && config.chart?.enabled && effectiveXColumn && effectiveYColumns?.length) {
      // If groupColumn is specified, generate grouped chart
      if (effectiveGroupColumn && effectiveYColumns[0]) {
        chartHTML = this.generateGroupedChartHTML(columns, rowObjects, {
          xColumn: effectiveXColumn,
          yColumn: effectiveYColumns[0],
          groupColumn: effectiveGroupColumn,
        });
      } else {
        const chartConfigForGeneration: { type?: string; xColumn?: string; yColumns?: string[] } = {
          xColumn: effectiveXColumn,
          yColumns: effectiveYColumns,
        };
        if (config.chart?.type) {
          chartConfigForGeneration.type = config.chart.type;
        }
        chartHTML = this.generateChartHTML(columns, rowObjects, chartConfigForGeneration);
      }
    }

    // Generate map HTML if enabled and GPS data available
    let mapHTML = '';
    if (gpsColumns && config.map?.enabled) {
      mapHTML = this.generateMapHTML(rowObjects, gpsColumns, options.mapSettings);
    }

    // Build full HTML document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHTML(title)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    @media print {
      body {
        padding: 0;
        max-width: none;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }
    
    header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #1a1a1a;
    }
    
    .description {
      font-size: 16px;
      color: #666;
      margin-bottom: 10px;
    }
    
    .meta {
      font-size: 12px;
      color: #999;
    }
    
    section {
      margin-bottom: 40px;
    }
    
    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #1a1a1a;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    /* Table styles */
    .table-container {
      overflow-x: auto;
      margin-bottom: 20px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    th, td {
      padding: 10px 12px;
      text-align: left;
      border: 1px solid #e0e0e0;
    }
    
    th {
      background: #f5f5f5;
      font-weight: 600;
      white-space: nowrap;
    }
    
    tr:nth-child(even) {
      background: #fafafa;
    }
    
    tr:hover {
      background: #f0f7ff;
    }
    
    /* Chart styles */
    .chart-container {
      width: 100%;
      height: 400px;
      margin-bottom: 20px;
    }
    
    /* Map styles */
    .map-container {
      width: 100%;
      height: 400px;
      margin-bottom: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    
    /* Footer */
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
  </style>
  ${chartHTML ? this.getChartLibraryScript() : ''}
  ${mapHTML ? this.getMapLibraryScript() : ''}
</head>
<body>
  <header>
    <h1>${this.escapeHTML(title)}</h1>
    ${description ? `<p class="description">${this.escapeHTML(description)}</p>` : ''}
    <p class="meta">Generated on ${executedAt.toLocaleString()} | ${rows.length} rows</p>
  </header>

  <main>
    <section>
      <h2>Data Table</h2>
      <div class="table-container">
        ${tableHTML}
      </div>
    </section>

    ${chartHTML ? `
    <section class="page-break">
      <h2>Chart</h2>
      <div id="chart-container" class="chart-container"></div>
    </section>
    ` : ''}

    ${mapHTML ? `
    <section class="page-break">
      <h2>Location Map</h2>
      <div id="map-container" class="map-container"></div>
    </section>
    ` : ''}
  </main>

  <footer>
    <p>Exported from Dashboard Studio</p>
  </footer>

  ${chartHTML ? `<script>${chartHTML}</script>` : ''}
  ${mapHTML ? `<script>${mapHTML}</script>` : ''}
</body>
</html>`;

    logger.info('Generated HTML export', { 
      title, 
      rowCount: rows.length, 
      hasChart: !!chartHTML,
      hasMap: !!mapHTML
    });

    return html;
  }

  /**
   * Generate HTML table from data
   */
  private generateTableHTML(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
    // Filter out empty columns
    const visibleColumns = this.filterEmptyColumns(columns, rows);
    
    const headerCells = visibleColumns.map(col => `<th>${this.escapeHTML(col.name)}</th>`).join('');
    
    const bodyRows = rows.slice(0, 500).map(row => {
      const cells = visibleColumns.map(col => {
        let value = row[col.name];
        if (value === null || value === undefined) {
          value = '';
        } else if (typeof value === 'number') {
          // Trim trailing zeros for numbers (especially coordinates)
          value = this.formatNumericValue(value);
        } else if (value instanceof Date) {
          value = this.formatShortDateTime(value);
        } else if (typeof value === 'string' && /^-?\d+\.\d+0+$/.test(value)) {
          // String that looks like a number with trailing zeros
          const num = parseFloat(value);
          if (!isNaN(num)) {
            value = this.formatNumericValue(num);
          }
        } else if (typeof value === 'string' && value.includes('-') && !isNaN(Date.parse(value))) {
          // Format ISO date strings in short format
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = this.formatShortDateTime(date);
          }
        } else if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        return `<td>${this.escapeHTML(String(value))}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');

    const truncationNote = rows.length > 500 
      ? `<p style="margin-top: 10px; color: #666; font-size: 12px;">Showing first 500 of ${rows.length} rows. Download Excel for complete data.</p>`
      : '';

    return `<table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${truncationNote}`;
  }

  /**
   * Generate Chart.js code for time series chart
   */
  private generateChartHTML(
    columns: ExportColumn[], 
    rows: Record<string, unknown>[],
    chartConfig: { type?: string; xColumn?: string; yColumns?: string[] }
  ): string {
    const { xColumn, yColumns } = chartConfig;
    if (!xColumn || !yColumns?.length) return '';

    // Prepare chart data with short date format
    const labels = rows.slice(0, 200).map(row => {
      const val = row[xColumn];
      if (val instanceof Date) return this.formatShortDateTime(val);
      if (typeof val === 'string' && !isNaN(Date.parse(val))) {
        return this.formatShortDateTime(new Date(val));
      }
      return String(val || '');
    });

    const datasets = yColumns.map((yCol, idx) => {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
      const color = colors[idx % colors.length];
      const data = rows.slice(0, 200).map(row => {
        const val = row[yCol];
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      });
      return {
        label: yCol,
        data,
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0.4,
      };
    });

    // Calculate appropriate tick skip based on data size
    const maxTicks = 15;
    const skipInterval = Math.max(1, Math.ceil(labels.length / maxTicks));

    return `
      document.addEventListener('DOMContentLoaded', function() {
        const ctx = document.getElementById('chart-container');
        if (!ctx) return;
        
        const canvas = document.createElement('canvas');
        ctx.appendChild(canvas);
        
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: ${JSON.stringify(datasets)}
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
              }
            },
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: ${JSON.stringify(xColumn)}
                },
                ticks: {
                  maxRotation: 45,
                  minRotation: 20,
                  autoSkip: true,
                  maxTicksLimit: ${maxTicks},
                  callback: function(val, index) {
                    return index % ${skipInterval} === 0 ? this.getLabelForValue(val) : '';
                  }
                }
              },
              y: {
                display: true,
                beginAtZero: true
              }
            }
          }
        });
      });
    `;
  }

  /**
   * Generate Chart.js code for grouped time series chart
   */
  private generateGroupedChartHTML(
    columns: ExportColumn[], 
    rows: Record<string, unknown>[],
    chartConfig: { xColumn: string; yColumn: string; groupColumn: string }
  ): string {
    const { xColumn, yColumn, groupColumn } = chartConfig;
    if (!xColumn || !yColumn || !groupColumn) return '';

    // Get unique group values
    const groupValues = new Set<string>();
    rows.forEach(row => {
      const groupVal = row[groupColumn];
      if (groupVal !== null && groupVal !== undefined) {
        groupValues.add(String(groupVal));
      }
    });
    const groups = Array.from(groupValues).slice(0, 10); // Limit to 10 groups

    // Sort rows by X value
    const sortedRows = [...rows].sort((a, b) => {
      const aVal = a[xColumn];
      const bVal = b[xColumn];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }).slice(0, 500); // Limit for performance

    // Get unique X values (labels) with short date format
    const xValuesSet = new Set<string>();
    sortedRows.forEach(row => {
      const val = row[xColumn];
      if (val !== null && val !== undefined) {
        if (val instanceof Date) {
          xValuesSet.add(this.formatShortDateTime(val));
        } else if (typeof val === 'string' && !isNaN(Date.parse(val))) {
          xValuesSet.add(this.formatShortDateTime(new Date(val)));
        } else {
          xValuesSet.add(String(val));
        }
      }
    });
    const labels = Array.from(xValuesSet);

    // Create datasets for each group
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
    const datasets = groups.map((group, idx) => {
      const color = colors[idx % colors.length];
      const groupRows = sortedRows.filter(row => String(row[groupColumn] ?? 'Unknown') === group);
      
      // Map X values to Y values for this group
      const dataMap = new Map<string, number>();
      groupRows.forEach(row => {
        const xVal = row[xColumn];
        let label: string;
        if (xVal instanceof Date) {
          label = this.formatShortDateTime(xVal);
        } else if (typeof xVal === 'string' && !isNaN(Date.parse(xVal))) {
          label = this.formatShortDateTime(new Date(xVal));
        } else {
          label = String(xVal || '');
        }
        const yVal = row[yColumn];
        const numVal = typeof yVal === 'number' ? yVal : parseFloat(String(yVal)) || 0;
        dataMap.set(label, numVal);
      });
      
      const data = labels.map(label => dataMap.get(label) ?? null);
      
      return {
        label: group,
        data,
        borderColor: color,
        backgroundColor: color + '20',
        fill: false,
        tension: 0.1,
        spanGaps: true,
      };
    });

    // Calculate appropriate tick skip based on data size
    const maxTicks = 15;
    const skipInterval = Math.max(1, Math.ceil(labels.length / maxTicks));

    return `
      document.addEventListener('DOMContentLoaded', function() {
        const ctx = document.getElementById('chart-container');
        if (!ctx) return;
        
        const canvas = document.createElement('canvas');
        ctx.appendChild(canvas);
        
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: ${JSON.stringify(datasets)}
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
              }
            },
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: ${JSON.stringify(xColumn)}
                },
                ticks: {
                  maxRotation: 45,
                  minRotation: 20,
                  autoSkip: true,
                  maxTicksLimit: ${maxTicks},
                  callback: function(val, index) {
                    return index % ${skipInterval} === 0 ? this.getLabelForValue(val) : '';
                  }
                }
              },
              y: {
                display: true,
                beginAtZero: true,
                title: {
                  display: true,
                  text: ${JSON.stringify(yColumn)}
                }
              }
            }
          }
        });
      });
    `;
  }

  /**
   * Generate Leaflet map code
   */
  private generateMapHTML(
    rows: Record<string, unknown>[],
    gpsColumns: { latColumn: string; lonColumn: string },
    mapSettings?: { center: [number, number]; zoom: number }
  ): string {
    // Extract valid GPS points
    const points = rows
      .filter(row => {
        const lat = parseFloat(String(row[gpsColumns.latColumn]));
        const lon = parseFloat(String(row[gpsColumns.lonColumn]));
        return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
      })
      .slice(0, 500) // Limit markers for performance
      .map(row => ({
        lat: parseFloat(String(row[gpsColumns.latColumn])),
        lon: parseFloat(String(row[gpsColumns.lonColumn])),
      }));

    if (points.length === 0) return '';

    // Use mapSettings from frontend if provided, otherwise calculate default
    let centerLat: number;
    let centerLon: number;
    let zoom: number;

    if (mapSettings) {
      // Use the exact view state from the frontend
      centerLat = mapSettings.center[0];
      centerLon = mapSettings.center[1];
      zoom = mapSettings.zoom;
    } else {
      // Calculate center from points
      centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
      zoom = 10;
    }

    // If mapSettings provided, don't auto-fit bounds - use exact view
    const fitBoundsCode = mapSettings ? '' : `
        if (markers.length > 1) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
        }`;

    return `
      document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('map-container');
        if (!container) return;
        
        const map = L.map(container, { attributionControl: false }).setView([${centerLat}, ${centerLon}], ${zoom});
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        // Add Navixy logo in bottom right
        const navixyControl = L.control({ position: 'bottomright' });
        navixyControl.onAdd = function() {
          const div = L.DomUtil.create('div', 'navixy-attribution');
          div.innerHTML = '<a href="https://www.navixy.com" target="_blank" rel="noopener noreferrer" title="Powered by Navixy" style="display:block"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_navixy)"><path d="M9.92784 0.0618557C4.26804 1.05155 0.0927835 5.96907 0 11.7217V12.3402L10.3608 6.15464V0L9.92784 0.0618557Z" fill="#007AD2"/><path d="M24.064 11.8763C24.033 6.06186 19.8578 1.08247 14.1361 0.0618557L13.7031 0V6.21649L24.064 12.4948V11.8763Z" fill="#007AD2"/><path d="M0.772149 16.1754C1.63813 18.4331 3.12266 20.3816 5.10205 21.7733C7.14328 23.196 9.52473 23.9692 12.0299 23.9692C14.5041 23.9692 16.8855 23.227 18.8959 21.8043C20.8752 20.4434 22.3598 18.5259 23.2258 16.2991L23.3185 16.0208L11.999 9.15479L0.648438 15.928L0.772149 16.1754Z" fill="#007AD2"/></g><defs><clipPath id="clip0_navixy"><rect width="24" height="24" fill="white"/></clipPath></defs></svg></a>';
          div.style.background = 'rgba(255,255,255,0.8)';
          div.style.padding = '2px 4px';
          div.style.borderRadius = '4px';
          return div;
        };
        navixyControl.addTo(map);
        
        const points = ${JSON.stringify(points)};
        const markers = [];
        
        points.forEach(function(point) {
          const marker = L.marker([point.lat, point.lon]).addTo(map);
          markers.push(marker);
        });
        ${fitBoundsCode}
      });
    `;
  }

  /**
   * Get Chart.js library script tag
   */
  private getChartLibraryScript(): string {
    return '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>';
  }

  /**
   * Get Leaflet library script and style tags
   */
  private getMapLibraryScript(): string {
    return `
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(str: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, char => escapeMap[char] ?? char);
  }

  /**
   * Generate PDF from HTML content using Puppeteer
   */
  async generatePDF(html: string): Promise<Buffer> {
    // Dynamic import to avoid loading puppeteer when not needed
    const puppeteer = await import('puppeteer');
    
    let browser = null;
    try {
      // Use system Chromium if available (Docker), otherwise use bundled
      const launchOptions: Parameters<typeof puppeteer.default.launch>[0] = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      };
      
      // Only set executablePath if defined (for Docker with system Chromium)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      
      browser = await puppeteer.default.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // Set content and wait for resources to load
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000,
      });
      
      // Wait a bit for any charts/scripts to render
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size: 10px; color: #666; width: 100%; text-align: center; padding: 10px 0;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `,
      });
      
      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error('PDF generation failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
