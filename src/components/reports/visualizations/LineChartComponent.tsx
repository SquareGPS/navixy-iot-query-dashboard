import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiService } from '@/services/api';
import { Pencil } from 'lucide-react';
import { 
  LineChart, 
  ComposedChart,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area
} from 'recharts';
import type { LineVisual } from '@/types/report-schema';
import { chartColors } from '@/lib/chartColors';

interface LineChartComponentProps {
  visual: LineVisual;
  title?: string;
  editMode: boolean;
  onEdit: () => void;
}

export function LineChartComponent({ visual, title, editMode, onEdit }: LineChartComponentProps) {
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
          // Convert array rows to objects using column names
          const columns = response.data.columns || [];
          const rowsAsObjects = response.data.rows.map((row: any[]) => {
            const rowObj: any = {};
            columns.forEach((col: any, index: number) => {
              const colName = typeof col === 'string' ? col : col.name;
              rowObj[colName] = row[index];
            });
            return rowObj;
          });

          let processedData: any[] = [];

          // Check if we have a series field (multiple lines)
          const hasSeries = visual.options.series_field && visual.options.series_field.trim() !== '';

          if (hasSeries) {
            // Group data by series
            const seriesMap = new Map<string, any[]>();
            
            rowsAsObjects.forEach((row: any) => {
              const xValue = row[visual.options.category_field];
              const yValue = Number(row[visual.options.value_field]) || 0;
              const seriesName = String(row[visual.options.series_field!]);

              if (!seriesMap.has(seriesName)) {
                seriesMap.set(seriesName, []);
              }
              
              seriesMap.get(seriesName)!.push({
                x: xValue,
                value: yValue,
              });
            });

            // Get all unique x values across all series
            const allXValues = new Set<string | number>();
            seriesMap.forEach((values) => {
              values.forEach((item) => allXValues.add(item.x));
            });

            // Create combined data structure
            const xValuesArray = Array.from(allXValues).sort((a, b) => {
              // Try to sort as dates if they look like dates
              const aDate = new Date(a);
              const bDate = new Date(b);
              if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                return aDate.getTime() - bDate.getTime();
              }
              // Otherwise sort as strings/numbers
              return a > b ? 1 : a < b ? -1 : 0;
            });

            // Build combined data array
            processedData = xValuesArray.map((xValue) => {
              const dataPoint: any = { x: xValue };
              seriesMap.forEach((values, seriesName) => {
                const matchingValue = values.find((v) => v.x === xValue);
                dataPoint[seriesName] = matchingValue ? matchingValue.value : null;
              });
              return dataPoint;
            });
          } else {
            // Single line - simple mapping
            processedData = rowsAsObjects.map((row: any) => ({
              x: row[visual.options.category_field],
              value: Number(row[visual.options.value_field]) || 0,
            }));

            // Sort by x value
            processedData.sort((a, b) => {
              const aDate = new Date(a.x);
              const bDate = new Date(b.x);
              if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                return aDate.getTime() - bDate.getTime();
              }
              return a.x > b.x ? 1 : a.x < b.x ? -1 : 0;
            });
          }

          setData(processedData);
        } else {
          setData([]);
        }
      } catch (err: any) {
        console.error('Error fetching line chart data:', err);
        setError(err.message || 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visual.query.sql, visual.options]);

  // Get color palette
  const colorPalette = visual.options.color_palette || 'classic';
  const colors = visual.options.palette || chartColors.getPalette(colorPalette);

  // Get series names (if multiple series)
  const seriesNames = useMemo(() => {
    if (!data.length) return [];
    const hasSeries = visual.options.series_field && visual.options.series_field.trim() !== '';
    if (!hasSeries) return ['value'];
    
    // Get all keys except 'x' from the first data point
    return Object.keys(data[0] || {}).filter(key => key !== 'x');
  }, [data, visual.options.series_field]);

  // Chart options with defaults
  const lineStyle = visual.options.line_style || 'solid';
  const lineWidth = visual.options.line_width ?? 2;
  const showPoints = visual.options.show_points || 'auto';
  const pointSize = visual.options.point_size ?? 5;
  const interpolation = visual.options.interpolation || 'linear';
  const fillArea = visual.options.fill_area || 'none';
  const showGrid = visual.options.show_grid !== false;
  const showLegend = visual.options.show_legend !== false;
  const legendPosition = visual.options.legend_position || 'bottom';

  // Map line style to strokeDasharray
  const getStrokeDasharray = () => {
    switch (lineStyle) {
      case 'dashed':
        return '5 5';
      case 'dotted':
        return '2 2';
      case 'solid':
      default:
        return '0';
    }
  };

  // Map interpolation to curve type
  const getCurveType = () => {
    switch (interpolation) {
      case 'step':
        return 'step';
      case 'smooth':
        return 'monotone';
      case 'linear':
      default:
        return 'linear';
    }
  };

  // Determine if points should be shown
  const shouldShowPoints = showPoints === 'always' || (showPoints === 'auto' && data.length <= 50);

  // Format x-axis labels (try to format as dates)
  const formatXAxisLabel = (value: any) => {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // Check if it's a time-only value or includes date
      const hasTime = value.toString().includes(':') || value.toString().includes('T');
      if (hasTime) {
        return date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return String(value);
  };

  return (
    <div 
      className="relative h-full"
      onMouseEnter={() => editMode && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="h-full flex flex-col">
        <div className="text-lg font-semibold text-text-primary pb-4 flex-shrink-0">
          {title || visual.label}
        </div>
        <div className="flex-1 min-h-0">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={400}>
              {fillArea !== 'none' ? (
                <ComposedChart
                  data={data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  {showGrid && (
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="var(--border)" 
                      opacity={0.3}
                    />
                  )}
                  <XAxis
                    dataKey="x"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickFormatter={formatXAxisLabel}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  {visual.options.show_tooltips !== false && (
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                      }}
                      labelFormatter={(value) => formatXAxisLabel(value)}
                      formatter={(value: any, name: string) => [
                        value?.toLocaleString() || '0',
                        name === 'value' ? visual.label : name,
                      ]}
                    />
                  )}
                  {showLegend && legendPosition !== 'none' && (
                    <Legend
                      verticalAlign={legendPosition === 'bottom' ? 'bottom' : legendPosition === 'top' ? 'top' : 'middle'}
                      align={legendPosition === 'left' ? 'left' : 'center'}
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                  )}
                  
                  {/* Render area fill - Areas must be rendered before Lines */}
                  {/* Note: "above" fill is treated as "below" since Recharts Area always fills from baseline */}
                  {seriesNames.map((seriesName, index) => {
                    const dataKey = seriesName === 'value' ? 'value' : seriesName;
                    return (
                      <Area
                        key={`area-${seriesName}`}
                        type={getCurveType()}
                        dataKey={dataKey}
                        stroke="none"
                        fill={colors[index % colors.length]}
                        fillOpacity={0.1}
                        isAnimationActive={false}
                      />
                    );
                  })}

                  {/* Render lines */}
                  {seriesNames.map((seriesName, index) => {
                    const dataKey = seriesName === 'value' ? 'value' : seriesName;
                    const lineName = seriesName === 'value' ? visual.label : seriesName;
                    
                    return (
                      <Line
                        key={`line-${seriesName}`}
                        type={getCurveType()}
                        dataKey={dataKey}
                        name={lineName}
                        stroke={colors[index % colors.length]}
                        strokeWidth={lineWidth}
                        strokeDasharray={getStrokeDasharray()}
                        dot={shouldShowPoints ? {
                          r: pointSize,
                          fill: colors[index % colors.length],
                          strokeWidth: 2,
                          stroke: 'var(--surface-1)',
                        } : false}
                        activeDot={{ r: pointSize + 2 }}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                      />
                    );
                  })}
                </ComposedChart>
              ) : (
                <LineChart
                  data={data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  {showGrid && (
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="var(--border)" 
                      opacity={0.3}
                    />
                  )}
                  <XAxis
                    dataKey="x"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickFormatter={formatXAxisLabel}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  {visual.options.show_tooltips !== false && (
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                      }}
                      labelFormatter={(value) => formatXAxisLabel(value)}
                      formatter={(value: any, name: string) => [
                        value?.toLocaleString() || '0',
                        name === 'value' ? visual.label : name,
                      ]}
                    />
                  )}
                  {showLegend && legendPosition !== 'none' && (
                    <Legend
                      verticalAlign={legendPosition === 'bottom' ? 'bottom' : legendPosition === 'top' ? 'top' : 'middle'}
                      align={legendPosition === 'left' ? 'left' : 'center'}
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                  )}
                  
                  {/* Render lines */}
                  {seriesNames.map((seriesName, index) => {
                    const dataKey = seriesName === 'value' ? 'value' : seriesName;
                    const lineName = seriesName === 'value' ? visual.label : seriesName;
                    
                    return (
                      <Line
                        key={`line-${seriesName}`}
                        type={getCurveType()}
                        dataKey={dataKey}
                        name={lineName}
                        stroke={colors[index % colors.length]}
                        strokeWidth={lineWidth}
                        strokeDasharray={getStrokeDasharray()}
                        dot={shouldShowPoints ? {
                          r: pointSize,
                          fill: colors[index % colors.length],
                          strokeWidth: 2,
                          stroke: 'var(--surface-1)',
                        } : false}
                        activeDot={{ r: pointSize + 2 }}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                      />
                    );
                  })}
                </LineChart>
              )}
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

