import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiService } from '@/services/api';
import { Pencil } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { BarVisual } from '@/types/report-schema';

interface BarChartComponentProps {
  visual: BarVisual;
  title?: string;
  editMode: boolean;
  onEdit: () => void;
}

const DEFAULT_COLORS = ['#3AA3FF', '#22D3EE', '#8B9DB8', '#6B778C', '#B6C3D8'];

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
        const response = await apiService.executeSQL({
          sql: visual.query.sql,
          params: {},
          timeout_ms: 30000,
          row_limit: 1000
        });

        if (response.error) {
          throw new Error(response.error.message || 'Query failed');
        }

        if (response.data?.rows && response.data.rows.length > 0) {
          let processedData = response.data.rows.map((row: any) => ({
            category: row[visual.options.category_field],
            value: Number(row[visual.options.value_field]) || 0,
          }));

          // Filter out outlier dates (more than 1 year in the future)
          const now = new Date();
          const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
          
          processedData = processedData.filter((item) => {
            const categoryDate = new Date(item.category);
            if (!isNaN(categoryDate.getTime())) {
              // If it's a valid date, filter out dates more than 1 year in the future
              return categoryDate <= oneYearFromNow;
            }
            return true; // Keep non-date values
          });

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

  // Calculate Y-axis domain from actual data
  const values = data.map(d => d.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  
  // Domain should be [min, max] for proper ordering (bottom to top)
  const yAxisDomain = [
    Math.floor(minValue * 0.95), // 5% padding below min
    Math.ceil(maxValue * 1.05)   // 5% padding above max
  ];

  console.log('Bar chart data:', data);
  console.log('Y-axis domain:', yAxisDomain);

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
            <Skeleton className="h-96 w-full" />
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data.length === 0 ? (
            <div className="h-96 flex items-center justify-center text-text-muted">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={data}
                layout={isHorizontal ? 'horizontal' : 'vertical'}
                margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                {isHorizontal ? (
                  <>
                    <XAxis 
                      type="number" 
                      domain={[0, 'auto']}
                      tickFormatter={(value) => value.toLocaleString()}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={{ stroke: '#ffffff22' }}
                    />
                    <YAxis 
                      dataKey="category" 
                      type="category" 
                      width={100}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={{ stroke: '#ffffff22' }}
                    />
                  </>
                ) : (
                  <>
                    <XAxis 
                      dataKey="category" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={{ stroke: '#ffffff22' }}
                      tickFormatter={(value) => {
                        // Try to format as date if it looks like one
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
                        }
                        return value;
                      }}
                    />
                    <YAxis 
                      domain={[0, 'auto']}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={{ stroke: '#ffffff22' }}
                      tickFormatter={(value) => {
                        // Format large numbers with commas
                        return value.toLocaleString();
                      }}
                    />
                  </>
                )}
                {visual.options.show_tooltips !== false && (
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--surface-3)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                  />
                )}
                {showLegend && legendPosition !== 'none' && (
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                )}
                <Bar 
                  dataKey="value" 
                  name={visual.label}
                  label={visual.options.show_value_labels ? { position: isHorizontal ? 'right' : 'top' } : false}
                  fill="#60A5FA"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
