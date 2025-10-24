import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { BarVisual } from '@/types/report-schema';

interface BarChartComponentProps {
  visual: BarVisual;
  title?: string;
  editMode: boolean;
  onEdit: () => void;
}

const DEFAULT_COLORS = ['#60A5FA', '#22C55E', '#F59E0B', '#EF4444', '#A78BFA', '#14B8A6'];

export function BarChartComponent({ visual, title, editMode, onEdit }: BarChartComponentProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke('run-sql-table', {
          body: { sql: visual.query.sql, page: 1, pageSize: 1000 },
        });

        if (fetchError) throw fetchError;

        if (result?.error) {
          throw new Error(result.error.message || 'Query failed');
        }

        if (result?.rows && result.rows.length > 0) {
          let processedData = result.rows.map((row: any) => ({
            category: row[visual.options.category_field],
            value: Number(row[visual.options.value_field]) || 0,
          }));

          // Apply sorting
          const sortBy = visual.options.sort_by || 'value';
          const sortDir = visual.options.sort_dir || 'desc';
          processedData.sort((a, b) => {
            const aVal = sortBy === 'value' ? a.value : a.category;
            const bVal = sortBy === 'value' ? b.value : b.category;
            return sortDir === 'asc' ? 
              (aVal > bVal ? 1 : -1) : 
              (aVal < bVal ? 1 : -1);
          });

          // Apply top_n filter
          if (visual.options.top_n && visual.options.top_n > 0) {
            processedData = processedData.slice(0, visual.options.top_n);
          }

          setData(processedData);
        } else {
          setData([]);
        }
      } catch (err: any) {
        console.error('Error fetching bar chart data:', err);
        setError(err.message || 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visual.query.sql, visual.options]);

  const colors = visual.options.palette || DEFAULT_COLORS;
  const isHorizontal = visual.options.orientation === 'horizontal';
  const showLegend = visual.options.show_legend !== false;
  const legendPosition = visual.options.legend_position || 'right';

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
            <Skeleton className="h-96 w-full" />
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data.length === 0 ? (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={data}
                layout={isHorizontal ? 'horizontal' : 'vertical'}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                {isHorizontal ? (
                  <>
                    <XAxis type="number" />
                    <YAxis dataKey="category" type="category" width={100} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="category" />
                    <YAxis />
                  </>
                )}
                {visual.options.show_tooltips !== false && <Tooltip />}
                {showLegend && legendPosition !== 'none' && (
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                )}
                <Bar 
                  dataKey="value" 
                  name={visual.label}
                  label={visual.options.show_value_labels ? { position: isHorizontal ? 'right' : 'top' } : false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
