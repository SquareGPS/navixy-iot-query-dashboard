/**
 * Panel Handlers
 * Implementation of panel handlers for different visualization types
 */

import type { PanelHandler, DataRows } from './runtime-types';

// KPI Handler - for single value displays
export const KpiHandler: PanelHandler = {
  type: 'kpi',
  
  render(mount, data, props) {
    if (!mount) return;

    const value = data.rows[0]?.[0] ?? null;
    const formattedValue = formatKpiValue(value, props);
    
    const container = document.createElement('div');
    container.className = 'kpi-container';
    container.innerHTML = `
      <div class="kpi-value">${formattedValue}</div>
      ${props.title ? `<div class="kpi-title">${props.title}</div>` : ''}
    `;

    mount.replaceChildren(container);
  },

  measure() {
    return { minHeight: 100 };
  }
};

// Table Handler - for tabular data
export const TableHandler: PanelHandler = {
  type: 'table',
  
  render(mount, data, props) {
    if (!mount) return;

    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    data.columns.forEach(column => {
      const th = document.createElement('th');
      th.textContent = column.name;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.rows.forEach(row => {
      const tr = document.createElement('tr');
      
      row.forEach((cell, index) => {
        const td = document.createElement('td');
        td.textContent = formatCellValue(cell, data.columns[index]?.type);
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    mount.replaceChildren(table);
  },

  measure(containerWidth) {
    return { minHeight: 200 };
  }
};

// Bar Chart Handler - for bar charts
export const BarChartHandler: PanelHandler = {
  type: 'barchart',
  
  render(mount, data, props) {
    if (!mount) return;

    // Simple SVG bar chart implementation
    const container = document.createElement('div');
    container.className = 'bar-chart-container';
    
    const width = 400;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Process data
    const chartData = data.rows.map(row => ({
      category: String(row[0]),
      value: Number(row[1]) || 0
    }));
    
    const maxValue = Math.max(...chartData.map(d => d.value));
    const barWidth = (width - margin.left - margin.right) / chartData.length;
    const scaleY = (height - margin.top - margin.bottom) / maxValue;
    
    // Draw bars
    chartData.forEach((d, i) => {
      const barHeight = d.value * scaleY;
      const x = margin.left + i * barWidth;
      const y = height - margin.bottom - barHeight;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', (barWidth - 2).toString());
      rect.setAttribute('height', barHeight.toString());
      rect.setAttribute('fill', '#3AA3FF');
      
      svg.appendChild(rect);
    });
    
    container.appendChild(svg);
    mount.replaceChildren(container);
  },

  measure() {
    return { minHeight: 300 };
  }
};

// Pie Chart Handler - for pie charts
export const PieChartHandler: PanelHandler = {
  type: 'piechart',
  
  render(mount, data, props) {
    if (!mount) return;

    const container = document.createElement('div');
    container.className = 'pie-chart-container';
    
    // Simple pie chart implementation using CSS
    const total = data.rows.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);
    let cumulativePercentage = 0;
    
    const pieContainer = document.createElement('div');
    pieContainer.className = 'pie-chart';
    pieContainer.style.width = '200px';
    pieContainer.style.height = '200px';
    pieContainer.style.borderRadius = '50%';
    pieContainer.style.position = 'relative';
    pieContainer.style.overflow = 'hidden';
    
    data.rows.forEach((row, index) => {
      const value = Number(row[1]) || 0;
      const percentage = (value / total) * 100;
      
      const segment = document.createElement('div');
      segment.className = 'pie-segment';
      segment.style.position = 'absolute';
      segment.style.width = '100%';
      segment.style.height = '100%';
      segment.style.clipPath = `polygon(50% 50%, ${50 + 50 * Math.cos(2 * Math.PI * cumulativePercentage / 100)}% ${50 + 50 * Math.sin(2 * Math.PI * cumulativePercentage / 100)}%, ${50 + 50 * Math.cos(2 * Math.PI * (cumulativePercentage + percentage) / 100)}% ${50 + 50 * Math.sin(2 * Math.PI * (cumulativePercentage + percentage) / 100)}%)`;
      segment.style.backgroundColor = getColor(index);
      
      pieContainer.appendChild(segment);
      cumulativePercentage += percentage;
    });
    
    container.appendChild(pieContainer);
    mount.replaceChildren(container);
  },

  measure() {
    return { minHeight: 200 };
  }
};

// Line Chart Handler - for time series
export const LineChartHandler: PanelHandler = {
  type: 'linechart',
  
  render(mount, data, props) {
    if (!mount) return;

    const container = document.createElement('div');
    container.className = 'line-chart-container';
    
    // Simple SVG line chart implementation
    const width = 400;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Process data
    const chartData = data.rows.map(row => ({
      x: Number(row[0]) || 0,
      y: Number(row[1]) || 0
    }));
    
    const maxX = Math.max(...chartData.map(d => d.x));
    const maxY = Math.max(...chartData.map(d => d.y));
    const minX = Math.min(...chartData.map(d => d.x));
    const minY = Math.min(...chartData.map(d => d.y));
    
    const scaleX = (width - margin.left - margin.right) / (maxX - minX);
    const scaleY = (height - margin.top - margin.bottom) / (maxY - minY);
    
    // Create path for line
    const pathData = chartData.map((d, i) => {
      const x = margin.left + (d.x - minX) * scaleX;
      const y = height - margin.bottom - (d.y - minY) * scaleY;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#3AA3FF');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    
    svg.appendChild(path);
    container.appendChild(svg);
    mount.replaceChildren(container);
  },

  measure() {
    return { minHeight: 300 };
  }
};

// Annotation Handler - for text content
export const AnnotationHandler: PanelHandler = {
  type: 'annotation',
  
  render(mount, data, props) {
    if (!mount) return;

    const container = document.createElement('div');
    container.className = 'annotation-container';
    
    const content = document.createElement('div');
    content.className = 'annotation-content';
    
    if (props.title) {
      const title = document.createElement('h3');
      title.textContent = props.title;
      content.appendChild(title);
    }
    
    if (props.text) {
      const text = document.createElement('div');
      text.innerHTML = props.markdown ? parseMarkdown(props.text) : props.text;
      content.appendChild(text);
    }
    
    container.appendChild(content);
    mount.replaceChildren(container);
  },

  measure() {
    return { minHeight: 100 };
  }
};

// Utility functions
function formatKpiValue(value: unknown, props: Record<string, any>): string {
  if (value === null || value === undefined) {
    return '—';
  }
  
  const num = Number(value);
  if (Number.isNaN(num)) {
    return String(value);
  }
  
  const prefix = props.prefix || '';
  const suffix = props.suffix || '';
  const precision = props.precision || 0;
  
  return `${prefix}${num.toFixed(precision)}${suffix}`;
}

function formatCellValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) {
    return '—';
  }
  
  switch (type) {
    case 'number':
      return Number(value).toLocaleString();
    case 'timestamp':
      return new Date(value as string).toLocaleString();
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

function getColor(index: number): string {
  const colors = ['#3AA3FF', '#22D3EE', '#8B9DB8', '#6B778C', '#B6C3D8'];
  return colors[index % colors.length];
}

function parseMarkdown(text: string): string {
  // Simple markdown parsing - in a real implementation, use a proper markdown parser
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}
