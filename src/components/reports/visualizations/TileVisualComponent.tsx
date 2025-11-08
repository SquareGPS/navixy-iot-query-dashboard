import { useState, useEffect } from 'react';
import { MetricTile } from '@/components/reports/MetricTile';
import { apiService } from '@/services/api';
import { Pencil, AlertCircle } from 'lucide-react';
import type { TileVisual } from '@/types/report-schema';

interface TileVisualComponentProps {
  visual: TileVisual;
  editMode: boolean;
  onEdit: () => void;
}

export function TileVisualComponent({ visual, editMode, onEdit }: TileVisualComponentProps) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchValue = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.executeSQL({
          sql: visual.query.sql,
          params: {},
          timeout_ms: 30000,
          row_limit: 1
        });

        if (response.error) {
          console.error('Tile query error:', response.error);
          setError(response.error.message || 'Query failed');
          setValue(null);
          return;
        }
        
        const newValue = response.data?.rows?.[0]?.[0] !== undefined ? Number(response.data.rows[0][0]) : null;
        setValue(newValue);
      } catch (err: any) {
        console.error('Error fetching tile value:', err);
        setError(err.message || 'Query failed');
        setValue(null);
      } finally {
        setLoading(false);
      }
    };

    fetchValue();
  }, [visual.query.sql]);

  return (
    <div 
      className="relative"
      onMouseEnter={() => {
        if (editMode) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {error ? (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Query Error</span>
          </div>
          <p className="text-red-700 dark:text-red-300 text-xs mt-1">{error}</p>
        </div>
      ) : (
        <MetricTile
          title={visual.label}
          value={value}
          format="number"
          decimals={visual.options?.precision || 0}
          loading={loading}
        />
      )}
      {editMode && isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-2 right-2 p-2.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-50"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
