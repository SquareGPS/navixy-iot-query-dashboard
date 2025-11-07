import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiService } from '@/services/api';
import { Pencil } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from 'recharts';
import type { PieVisual } from '@/types/report-schema';

interface PieChartComponentProps {
  visual: PieVisual;
  title?: string;
  editMode: boolean;
  onEdit: () => void;
}

const DEFAULT_COLORS = ['#3AA3FF', '#22D3EE', '#8B9DB8', '#6B778C', '#B6C3D8'];

// Active shape for hover effect - enlarges slice
const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;
  
  // Enlarge the slice slightly on hover (5% larger)
  const enlargedOuterRadius = outerRadius * 1.05;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={enlargedOuterRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
};

export function PieChartComponent({ visual, title, editMode, onEdit }: PieChartComponentProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  console.log('PieChartComponent mounted/updated, SQL:', visual.query.sql?.substring(0, 50));

  useEffect(() => {
    console.log('PieChartComponent useEffect triggered, SQL:', visual.query.sql?.substring(0, 50));
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

          // Limit to top 10 items, group the rest into "Other"
          const MAX_ITEMS = 10;
          if (processedData.length > MAX_ITEMS) {
            const topItems = processedData.slice(0, MAX_ITEMS);
            const remainingItems = processedData.slice(MAX_ITEMS);
            const otherValue = remainingItems.reduce((sum, item) => sum + item.value, 0);
            processedData = [...topItems, { name: 'Other', value: otherValue }];
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
  const isDonut = visual.options.donut !== false; // Default to donut style
  const innerRadiusPercent = isDonut ? (visual.options.inner_radius || 0.55) * 100 : 0;
  const showLegend = visual.options.show_legend !== false;
  const legendPosition = visual.options.legend_position || 'right';
  const labelType = visual.options.label_type || 'percent';
  const precision = visual.options.precision || 1;

  // Calculate total for percentage
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  // Calculate angles for positioning largest slice
  // Anchor angle: 240° positions largest slice in top-left quadrant
  // Increase to rotate clockwise further, decrease to rotate counter-clockwise
  const anchorDeg = 240; // Top-left quadrant
  const firstSliceAngle = data.length > 0 && total > 0 
    ? (data[0].value / total) * 360 
    : 0;
  
  // Center the largest slice at anchorDeg
  // Center = startAngle + firstSliceAngle/2, so: startAngle = anchorDeg - firstSliceAngle/2
  // To rotate clockwise: endAngle = startAngle - 360
  const startAngle = anchorDeg - (firstSliceAngle / 2);
  const endAngle = startAngle - 360;

  // Custom tooltip content
  const renderTooltipContent = (props: any) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }
    
    const data = props.payload[0];
    const value = data.value;
    const name = data.name;
    const percent = ((value / total) * 100).toFixed(precision);
    
    return (
      <div
        style={{
          backgroundColor: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '8px 12px',
        }}
      >
        <div className="text-sm font-medium text-text-primary">{name}</div>
        <div className="text-xs text-text-muted">
          {value.toFixed(1)} ({percent}%)
        </div>
      </div>
    );
  };

  // Custom legend renderer for right-side vertical alignment with bold labels
  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload || payload.length === 0) return null;

    return (
      <div className="flex flex-col gap-3 ml-6">
        {payload.map((entry: any, index: number) => {
          const percent = ((entry.value / total) * 100).toFixed(1);
          return (
            <div key={`legend-${index}`} className="flex items-start gap-2">
              <div
                className="w-4 h-4 rounded-sm mt-0.5 flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-text-primary">
                  {entry.name}
                </span>
                <span className="text-xs text-text-muted">
                  {entry.value.toFixed(1)} ({percent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="relative h-full"
      onMouseEnter={() => editMode && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="h-full flex flex-col">
        <div className="text-lg font-semibold text-text-primary pb-4 flex-shrink-0">{title || visual.label}</div>
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
            <div className="flex items-center gap-4 md:gap-6 h-full w-full overflow-hidden">
              <div className="relative flex-shrink-0" style={{ 
                width: 'clamp(200px, 55%, 400px)', 
                aspectRatio: '1',
                height: '100%',
                maxHeight: '100%'
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius="80%"
                      innerRadius={isDonut ? `${innerRadiusPercent}%` : 0}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                      startAngle={startAngle}
                      endAngle={endAngle}
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(undefined)}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={250}
                      animationEasing="ease-out"
                    >
                      {data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={colors[index % colors.length]}
                          style={{
                            filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                            transition: 'filter 0.2s ease-out',
                          }}
                        />
                      ))}
                    </Pie>
                    {visual.options.show_tooltips !== false && (
                      <Tooltip content={renderTooltipContent} />
                    )}
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label showing Total - positioned absolutely over the donut */}
                {isDonut && (
                  <div 
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    <div className="text-sm font-semibold text-text-primary">Total</div>
                    <div className="text-lg font-bold text-text-muted mt-1">
                      {total.toLocaleString(undefined, { 
                        maximumFractionDigits: precision === 0 ? 0 : precision 
                      })}
                    </div>
                  </div>
                )}
              </div>
              {showLegend && legendPosition === 'right' && (
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 self-center" style={{ 
                  minWidth: '200px', 
                  maxWidth: '45%',
                  height: 'clamp(200px, 55%, 400px)',
                  maxHeight: 'clamp(200px, 55%, 400px)'
                }}>
                  {renderCustomLegend({ payload: data.map((entry, index) => ({
                    value: entry.value,
                    name: entry.name,
                    color: colors[index % colors.length],
                  })) })}
                </div>
              )}
              {showLegend && legendPosition !== 'right' && legendPosition !== 'none' && (
                <Legend 
                  verticalAlign={legendPosition === 'bottom' ? 'bottom' : legendPosition === 'top' ? 'top' : 'middle'}
                  align={legendPosition === 'left' ? 'left' : 'center'}
                  layout={legendPosition === 'top' || legendPosition === 'bottom' ? 'horizontal' : 'vertical'}
                />
              )}
            </div>
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
