import { useState, useEffect } from 'react';
import { DataTable } from '@/components/reports/DataTable';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiService } from '@/services/api';
import { Pencil, AlertCircle } from 'lucide-react';
import type { TableVisual } from '@/types/report-schema';

interface TableVisualComponentProps {
  visual: TableVisual;
  title?: string;
  editMode: boolean;
  onEdit: () => void;
}

export function TableVisualComponent({ visual, title, editMode, onEdit }: TableVisualComponentProps) {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.executeSQL({
          sql: visual.query.sql,
          params: {},
          timeout_ms: 30000,
          row_limit: visual.options?.page_size || 25
        });

        if (response.error) {
          console.error('Table query error:', response.error);
          setError(response.error.message || 'Query failed');
          setData([]);
          setColumns([]);
          return;
        }

        if (response.data?.rows) {
          setData(response.data.rows);
          
          // Build columns from schema or result
          let cols;
          if (visual.options?.columns && visual.options.columns.length > 0) {
            cols = visual.options.columns.map(col => ({
              id: col.field,
              accessorKey: col.field,
              header: col.label || col.field,
              cell: ({ getValue }: any) => {
                const value = getValue();
                return value !== null && value !== undefined ? String(value) : '';
              },
            }));
          } else if (response.data.columns && response.data.columns.length > 0) {
            cols = response.data.columns.map((col: string) => ({
              id: col,
              accessorKey: col,
              header: col,
              cell: ({ getValue }: any) => {
                const value = getValue();
                return value !== null && value !== undefined ? String(value) : '';
              },
            }));
          } else if (response.data.rows.length > 0) {
            // Fallback: derive columns from first row
            cols = Object.keys(response.data.rows[0]).map((col: string) => ({
              id: col,
              accessorKey: col,
              header: col,
              cell: ({ getValue }: any) => {
                const value = getValue();
                return value !== null && value !== undefined ? String(value) : '';
              },
            }));
          } else {
            cols = [];
          }
          
          setColumns(cols);
        }
      } catch (err: any) {
        console.error('Error fetching table data:', err);
        setError(err.message || 'Query failed');
        setData([]);
        setColumns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visual.query.sql, visual.options?.page_size, visual.options?.columns]);

  return (
    <div 
      className="relative"
      onMouseEnter={() => editMode && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card>
        <div className="space-y-4">
          <div className="text-lg font-semibold text-text-primary">{title || visual.label}</div>
          {loading ? (
            <Skeleton className="h-96" />
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Query Error</span>
              </div>
              <p className="text-red-700 dark:text-red-300 text-xs mt-1">{error}</p>
            </div>
          ) : (
            <DataTable data={data} columns={columns} />
          )}
        </div>
      </Card>
      {editMode && isHovered && (
        <button
          onClick={onEdit}
          className="absolute top-4 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-10"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
