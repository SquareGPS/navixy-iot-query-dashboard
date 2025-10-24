import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { PieVisual } from '@/types/report-schema';

interface PieChartComponentProps {
  visual: PieVisual;
  title?: string;
  editMode: boolean;
  onEdit: () => void;
}

const DEFAULT_COLORS = ['#60A5FA', '#22C55E', '#F59E0B', '#EF4444', '#A78BFA', '#14B8A6'];

export function PieChartComponent({ visual, title, editMode, onEdit }: PieChartComponentProps) {
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
            name: String(row[visual.options.category_field]),
            value: Number(row[visual.options.value_field]) || 0,
          }));

          // Apply sorting
          const sortBy = visual.options.sort_by || 'value';
          const sortDir = visual.options.sort_dir || 'desc';
          processedData.sort((a, b) => {
            const aVal = sortBy === 'value' ? a.value : a.name;
            const bVal = sortBy === 'value' ? b.value : b.name;
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
        console.error('Error fetching pie chart data:', err);
        setError(err.message || 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visual.query.sql, visual.options]);

  const colors = visual.options.palette || DEFAULT_COLORS;
  const isDonut = visual.options.donut || false;
  const innerRadius = isDonut ? (visual.options.inner_radius || 0.55) * 100 : 0;
  const showLegend = visual.options.show_legend !== false;
  const legendPosition = visual.options.legend_position || 'right';
  const labelType = visual.options.label_type || 'percent';
  const precision = visual.options.precision || 1;

  // Calculate total for percentage
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  const renderLabel = (entry: any) => {
    if (labelType === 'none') return '';
    if (labelType === 'category') return entry.name;
    if (labelType === 'value') return entry.value.toFixed(precision);
    if (labelType === 'percent') {
      const percent = ((entry.value / total) * 100).toFixed(precision);
      return `${percent}%`;
    }
    return '';
  };

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
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={labelType !== 'none'}
                  label={labelType !== 'none' ? renderLabel : false}
                  outerRadius={120}
                  innerRadius={innerRadius}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                {visual.options.show_tooltips !== false && (
                  <Tooltip 
                    formatter={(value: number) => [
                      `${value.toFixed(precision)} (${((value / total) * 100).toFixed(precision)}%)`,
                      'Value'
                    ]}
                  />
                )}
                {showLegend && legendPosition !== 'none' && (
                  <Legend 
                    verticalAlign={legendPosition === 'bottom' ? 'bottom' : legendPosition === 'top' ? 'top' : 'middle'}
                    align={legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center'}
                    layout={legendPosition === 'top' || legendPosition === 'bottom' ? 'horizontal' : 'vertical'}
                  />
                )}
              </PieChart>
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
