import { useState, useEffect } from 'react';
import { MetricTile } from '@/components/reports/MetricTile';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';
import type { TileVisual } from '@/types/report-schema';

interface TileVisualComponentProps {
  visual: TileVisual;
  editMode: boolean;
  onEdit: () => void;
}

export function TileVisualComponent({ visual, editMode, onEdit }: TileVisualComponentProps) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchValue = async () => {
      console.log('=== TileVisualComponent fetchValue ===');
      console.log('SQL query:', visual.query.sql);
      console.log('Visual label:', visual.label);
      
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('run-sql-tile', {
          body: { sql: visual.query.sql },
        });

        console.log('Tile query result:', { result, error });

        if (error) throw error;
        
        const newValue = result.value !== undefined ? Number(result.value) : null;
        console.log('Setting tile value:', newValue);
        setValue(newValue);
      } catch (err) {
        console.error('Error fetching tile value:', err);
        setValue(null);
      } finally {
        setLoading(false);
        console.log('=== TileVisualComponent fetchValue complete ===');
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
      <MetricTile
        title={visual.label}
        value={value}
        format="number"
        decimals={visual.options?.precision || 0}
        loading={loading}
      />
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
