import { LineChartComponent } from '@/components/reports/visualizations/LineChartComponent';
import type { LineVisual } from '@/types/report-schema';

const LineChartTestPage = () => {
  // Sample data provided by user
  const rawData = [
    { date: '2025-11-01 17:00:00.000 -0700', value: 17054 },
    { date: '2025-11-02 16:00:00.000 -0800', value: 28659 },
    { date: '2025-11-03 16:00:00.000 -0800', value: 34694 },
    { date: '2025-11-04 16:00:00.000 -0800', value: 23307 },
    { date: '2025-11-05 16:00:00.000 -0800', value: 25506 },
    { date: '2025-11-06 16:00:00.000 -0800', value: 24347 },
    { date: '2025-11-07 16:00:00.000 -0800', value: 10811 },
  ];

  // Create a mock LineVisual object
  const mockLineVisual: LineVisual = {
    kind: 'line',
    label: 'Test Line Chart',
    query: {
      sql: 'SELECT * FROM test_data',
      params: {},
    },
    options: {
      category_field: 'date',
      value_field: 'value',
      line_style: 'solid',
      line_width: 2,
      show_points: 'auto',
      point_size: 5,
      interpolation: 'linear',
      fill_area: 'none',
      show_grid: true,
      show_legend: true,
      legend_position: 'bottom',
      color_palette: 'classic',
      show_tooltips: true,
    },
  };

  // Mock the component to use static data instead of fetching
  // We'll create a wrapper that bypasses the API call
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Line Chart Test Page</h1>
          <p className="text-muted-foreground">
            Testing LineChartComponent with sample time-series data
          </p>
        </div>

        <div className="grid gap-6">
          {/* Test 1: Basic line chart */}
          <div className="h-[500px]">
            <LineChartTestWrapper
              visual={mockLineVisual}
              staticData={rawData}
              title="Basic Line Chart (Solid, No Fill)"
            />
          </div>

          {/* Test 2: With area fill */}
          <div className="h-[500px]">
            <LineChartTestWrapper
              visual={{
                ...mockLineVisual,
                options: {
                  ...mockLineVisual.options,
                  fill_area: 'below',
                },
              }}
              staticData={rawData}
              title="Line Chart with Area Fill"
            />
          </div>

          {/* Test 3: Dashed line with points */}
          <div className="h-[500px]">
            <LineChartTestWrapper
              visual={{
                ...mockLineVisual,
                options: {
                  ...mockLineVisual.options,
                  line_style: 'dashed',
                  show_points: 'always',
                },
              }}
              staticData={rawData}
              title="Dashed Line with Points"
            />
          </div>

          {/* Test 4: Smooth interpolation */}
          <div className="h-[500px]">
            <LineChartTestWrapper
              visual={{
                ...mockLineVisual,
                options: {
                  ...mockLineVisual.options,
                  interpolation: 'smooth',
                  fill_area: 'below',
                },
              }}
              staticData={rawData}
              title="Smooth Interpolation with Fill"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper component that provides static data instead of fetching
interface LineChartTestWrapperProps {
  visual: LineVisual;
  staticData: Array<{ date: string; value: number }>;
  title: string;
}

const LineChartTestWrapper = ({ visual, staticData, title }: LineChartTestWrapperProps) => {
  // Transform the static data to match the expected format
  const processedData = staticData.map((row) => ({
    x: row.date,
    value: row.value,
  }));

  // We need to modify the LineChartComponent to accept static data
  // For now, let's create a simplified version that uses the data directly
  return (
    <div className="h-full">
      <LineChartComponentWithData
        visual={visual}
        data={processedData}
        title={title}
        editMode={false}
        onEdit={() => {}}
      />
    </div>
  );
};

// Modified version of LineChartComponent that accepts data directly
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
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
import { chartColors } from '@/lib/chartColors';

interface LineChartComponentWithDataProps {
  visual: LineVisual;
  data: Array<{ x: string | number; value: number }>;
  title: string;
  editMode: boolean;
  onEdit: () => void;
}

const LineChartComponentWithData = ({ 
  visual, 
  data, 
  title, 
  editMode, 
  onEdit 
}: LineChartComponentWithDataProps) => {
  // Get color palette
  const colorPalette = visual.options.color_palette || 'classic';
  const colors = visual.options.palette || chartColors.getPalette(colorPalette);

  // Get series names (single series in this case)
  const seriesNames = useMemo(() => {
    if (!data.length) return [];
    return ['value'];
  }, [data]);

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
    <div className="relative h-full">
      <Card className="h-full flex flex-col">
        <div className="text-lg font-semibold text-text-primary pb-4 flex-shrink-0">
          {title}
        </div>
        <div className="flex-1 min-h-0">
          {data.length === 0 ? (
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
                  
                  {/* Render area fill */}
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
    </div>
  );
};

export default LineChartTestPage;

