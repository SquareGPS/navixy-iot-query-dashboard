import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricTileProps {
  title: string;
  value: number | null;
  format?: 'number' | 'percent' | 'currency' | 'decimal';
  decimals?: number;
  loading?: boolean;
}

export function MetricTile({ title, value, format = 'number', decimals = 0, loading }: MetricTileProps) {
  const formatValue = (val: number | null) => {
    if (val === null) return '—';
    
    switch (format) {
      case 'number':
        return new Intl.NumberFormat('en-US', {
          maximumFractionDigits: decimals,
        }).format(val);
      case 'percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          maximumFractionDigits: decimals,
        }).format(val / 100);
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: decimals,
        }).format(val);
      case 'decimal':
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val);
      default:
        return val.toString();
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <div className="text-3xl font-bold text-primary">
            {formatValue(value)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
