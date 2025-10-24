import { useState, useEffect } from 'react';
import { DataTable } from '@/components/reports/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';
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
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('run-sql-table', {
          body: { sql: visual.query.sql, page: 1, pageSize: visual.options?.page_size || 25 },
        });

        if (error) throw error;
        
        // Check if result contains an error
        if (result?.error) {
          console.error('Table query error:', result.error);
          throw new Error(result.error.message || 'Query failed');
        }

        if (result?.rows) {
          setData(result.rows);
          
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
          } else if (result.columns && result.columns.length > 0) {
            cols = result.columns.map((col: string) => ({
              id: col,
              accessorKey: col,
              header: col,
              cell: ({ getValue }: any) => {
                const value = getValue();
                return value !== null && value !== undefined ? String(value) : '';
              },
            }));
          } else if (result.rows.length > 0) {
            // Fallback: derive columns from first row
            cols = Object.keys(result.rows[0]).map((col: string) => ({
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
      } catch (err) {
        console.error('Error fetching table data:', err);
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
        <CardHeader>
          <CardTitle>{title || visual.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-96" />
          ) : (
            <DataTable data={data} columns={columns} />
          )}
        </CardContent>
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
