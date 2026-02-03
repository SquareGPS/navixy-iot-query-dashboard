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

    // Create data sheet
    const dataSheet = workbook.addWorksheet('Data');

    // Add header row
    dataSheet.columns = columns.map(col => ({
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
        let value = row[idx];
        
        // Convert values based on type
        if (value === null || value === undefined) {
          rowData[col.name] = '';
        } else if (col.type.includes('timestamp') || col.type.includes('date')) {
          // Handle date/timestamp values
          const dateValue = new Date(value as string);
          rowData[col.name] = isNaN(dateValue.getTime()) ? value : dateValue;
        } else if (col.type.includes('int') || col.type.includes('numeric') || col.type.includes('real') || col.type.includes('double')) {
          // Handle numeric values
          rowData[col.name] = typeof value === 'string' ? parseFloat(value) : value;
        } else {
          rowData[col.name] = value;
        }
      });
      dataSheet.addRow(rowData);
    });

    // Auto-fit columns based on content
    dataSheet.columns.forEach((column) => {
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
   * Generate self-contained HTML from composite report data
   */
  async generateHTML(options: HTMLExportOptions): Promise<string> {
    const { title, description, columns, rows, config, gpsColumns, includeChart, executedAt } = options;

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
    let chartHTML = '';
    if (includeChart && config.chart?.enabled && config.chart.xColumn && config.chart.yColumns?.length) {
      chartHTML = this.generateChartHTML(columns, rowObjects, config.chart);
    }

    // Generate map HTML if enabled and GPS data available
    let mapHTML = '';
    if (gpsColumns && config.map?.enabled) {
      mapHTML = this.generateMapHTML(rowObjects, gpsColumns);
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
    const headerCells = columns.map(col => `<th>${this.escapeHTML(col.name)}</th>`).join('');
    
    const bodyRows = rows.slice(0, 500).map(row => {
      const cells = columns.map(col => {
        let value = row[col.name];
        if (value === null || value === undefined) {
          value = '';
        } else if (value instanceof Date) {
          value = value.toLocaleString();
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

    // Prepare chart data
    const labels = rows.slice(0, 200).map(row => {
      const val = row[xColumn];
      if (val instanceof Date) return val.toLocaleString();
      if (typeof val === 'string' && !isNaN(Date.parse(val))) {
        return new Date(val).toLocaleString();
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
   * Generate Leaflet map code
   */
  private generateMapHTML(
    rows: Record<string, unknown>[],
    gpsColumns: { latColumn: string; lonColumn: string }
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

    // Calculate center
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;

    return `
      document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('map-container');
        if (!container) return;
        
        const map = L.map(container).setView([${avgLat}, ${avgLon}], 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        
        const points = ${JSON.stringify(points)};
        const markers = [];
        
        points.forEach(function(point) {
          const marker = L.marker([point.lat, point.lon]).addTo(map);
          markers.push(marker);
        });
        
        if (markers.length > 1) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
        }
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
}
