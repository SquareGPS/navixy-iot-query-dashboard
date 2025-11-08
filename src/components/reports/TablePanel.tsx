import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { GrafanaQueryResult, NavixyVisualizationConfig } from '@/types/grafana-dashboard';

interface TablePanelProps {
  data: GrafanaQueryResult;
  visualization?: NavixyVisualizationConfig;
}

type SortConfig = {
  column: string;
  direction: 'asc' | 'desc';
} | null;

export function TablePanel({ data, visualization }: TablePanelProps) {
  const showHeader = visualization?.showHeader !== false; // Default: true
  const sortable = visualization?.sortable !== false; // Default: true
  const showPagination = visualization?.showPagination !== false; // Default: true
  const pageSize = visualization?.pageSize; // No default - can be undefined
  const columnWidth = visualization?.columnWidth || 'auto';
  const rowHighlighting = visualization?.rowHighlighting || 'none';
  const showTotals = visualization?.showTotals === true;
  const totalsRow = visualization?.totalsRow || 'bottom';

  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [localPageSize, setLocalPageSize] = useState<number | undefined>(pageSize);

  // Sync localPageSize with prop when it changes
  useEffect(() => {
    setLocalPageSize(pageSize);
  }, [pageSize]);

  // Calculate totals if needed
  const totalsRowData = useMemo(() => {
    if (!showTotals) return null;
    
    const totals: Record<string, any> = {};
    data.columns.forEach((col, colIndex) => {
      if (col.type === 'number' || col.type === 'integer' || col.type === 'numeric' || col.type === 'decimal') {
        const sum = data.rows.reduce((acc, row) => {
          const val = row[colIndex];
          return acc + (typeof val === 'number' ? val : 0);
        }, 0);
        totals[col.name] = sum;
      } else {
        totals[col.name] = '';
      }
    });
    return totals;
  }, [showTotals, data.columns, data.rows]);

  // Sort data
  const sortedRows = useMemo(() => {
    if (!sortConfig || !sortable) return data.rows;

    const sorted = [...data.rows];
    const colIndex = data.columns.findIndex((col) => col.name === sortConfig.column);
    
    if (colIndex === -1) return sorted;

    sorted.sort((a, b) => {
      const aVal = a[colIndex];
      const bVal = b[colIndex];
      
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return sorted;
  }, [data.rows, data.columns, sortConfig, sortable]);

  // Reset to first page when data changes or pageSize changes
  // Use localPageSize for pagination, but if not set (undefined), show all rows
  const effectivePageSize = localPageSize || sortedRows.length;
  
  // Calculate total pages
  const totalPages = showPagination && localPageSize ? Math.max(1, Math.ceil(sortedRows.length / effectivePageSize)) : 1;
  
  // Reset current page if it's out of bounds or when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [sortedRows.length, effectivePageSize, showPagination, currentPage, totalPages]);

  // Paginate data
  const paginatedRows = useMemo(() => {
    if (!showPagination || !localPageSize) return sortedRows;
    
    const startIndex = (currentPage - 1) * effectivePageSize;
    const endIndex = startIndex + effectivePageSize;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, currentPage, effectivePageSize, showPagination, localPageSize]);

  // Handle column sorting
  const handleSort = (columnName: string) => {
    if (!sortable) return;
    
    if (sortConfig?.column === columnName) {
      // Toggle direction or clear
      if (sortConfig.direction === 'asc') {
        setSortConfig({ column: columnName, direction: 'desc' });
      } else {
        setSortConfig(null);
      }
    } else {
      setSortConfig({ column: columnName, direction: 'asc' });
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  // Get table style for column width
  const getTableStyle = () => {
    if (columnWidth === 'equal') {
      return { tableLayout: 'fixed' as const };
    }
    if (columnWidth === 'fit') {
      return { tableLayout: 'auto' as const };
    }
    return {};
  };

  // Get row highlighting class
  const getRowClassName = (index: number) => {
    const baseClass = 'border-b';
    if (rowHighlighting === 'none') {
      return baseClass;
    }
    if (rowHighlighting === 'alternating') {
      return `${baseClass} ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''}`;
    }
    if (rowHighlighting === 'hover') {
      return `${baseClass} hover:bg-gray-50 dark:hover:bg-gray-900`;
    }
    if (rowHighlighting === 'both') {
      return `${baseClass} ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''} hover:bg-gray-100 dark:hover:bg-gray-800`;
    }
    return baseClass;
  };

  // Get sort icon for column header
  const getSortIcon = (columnName: string) => {
    if (!sortable) return null;
    if (sortConfig?.column !== columnName) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-gray-700 dark:text-gray-300" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-gray-700 dark:text-gray-300" />;
  };

  if (!data.rows || data.rows.length === 0) {
    return <div className="text-gray-500 py-4">No data</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={getTableStyle()}>
          {showHeader && (
            <thead>
              <tr className="border-b">
                {data.columns.map((column) => (
                  <th
                    key={column.name}
                    className={`text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300 ${
                      sortable ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                    }`}
                    onClick={() => handleSort(column.name)}
                  >
                    <div className="flex items-center">
                      {column.name}
                      {getSortIcon(column.name)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          )}
          
          {totalsRow === 'top' && showTotals && totalsRowData && (
            <tfoot>
              <tr className="border-t-2 border-gray-400 dark:border-gray-600 font-semibold bg-gray-100 dark:bg-gray-800">
                {data.columns.map((column) => (
                  <td key={column.name} className="py-2 px-3">
                    {totalsRowData[column.name]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
          
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="py-8 text-center text-gray-500">
                  No data to display
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, rowIndex) => {
                // Calculate actual row index for highlighting (considering pagination)
                const actualIndex = showPagination ? (currentPage - 1) * effectivePageSize + rowIndex : rowIndex;
                return (
                  <tr key={rowIndex} className={getRowClassName(actualIndex)}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="py-2 px-3">
                        {cell != null ? String(cell) : ''}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          
          {totalsRow === 'bottom' && showTotals && totalsRowData && (
            <tfoot>
              <tr className="border-t-2 border-gray-400 dark:border-gray-600 font-semibold bg-gray-100 dark:bg-gray-800">
                {data.columns.map((column) => (
                  <td key={column.name} className="py-2 px-3">
                    {totalsRowData[column.name]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showPagination && sortedRows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
              {localPageSize !== undefined ? (
                <Select
                  value={localPageSize.toString()}
                  onValueChange={(value) => {
                    const newPageSize = parseInt(value, 10);
                    if (!isNaN(newPageSize)) {
                      setLocalPageSize(newPageSize);
                      setCurrentPage(1); // Reset to first page when page size changes
                    }
                  }}
                >
                  <SelectTrigger className="w-20 h-auto py-0.5 text-sm text-gray-600 dark:text-gray-400 border-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Include the current value if it's not in the standard list */}
                    {localPageSize && ![10, 25, 50, 100, 250].includes(localPageSize) && (
                      <SelectItem value={localPageSize.toString()}>{localPageSize}</SelectItem>
                    )}
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  onValueChange={(value) => {
                    const newPageSize = parseInt(value, 10);
                    if (!isNaN(newPageSize)) {
                      setLocalPageSize(newPageSize);
                      setCurrentPage(1); // Reset to first page when page size changes
                    }
                  }}
                >
                  <SelectTrigger className="w-20 h-auto py-0.5 text-sm text-gray-600 dark:text-gray-400 border-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {localPageSize 
                ? `Showing ${sortedRows.length === 0 ? 0 : ((currentPage - 1) * effectivePageSize) + 1} to ${Math.min(currentPage * effectivePageSize, sortedRows.length)} of ${sortedRows.length} rows`
                : `${sortedRows.length} row${sortedRows.length !== 1 ? 's' : ''}`
              }
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 !px-0 !py-0 min-w-8 flex items-center justify-center"
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 !px-0 !py-0 min-w-8 flex items-center justify-center"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 !px-0 !py-0 min-w-8 flex items-center justify-center"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 !px-0 !py-0 min-w-8 flex items-center justify-center"
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

