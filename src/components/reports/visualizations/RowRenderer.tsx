import { TileVisualComponent } from './TileVisualComponent';
import { TableVisualComponent } from './TableVisualComponent';
import { AnnotationComponent } from './AnnotationComponent';
import { BarChartComponent } from './BarChartComponent';
import { PieChartComponent } from './PieChartComponent';
import { UnsupportedVisualComponent } from './UnsupportedVisualComponent';
import type { TilesRow, TableRow, AnnotationRow, ChartsRow } from '@/types/report-schema';

interface RowRendererProps {
  row: TilesRow | TableRow | AnnotationRow | ChartsRow;
  rowIndex: number;
  editMode: boolean;
  onEdit: (element: {
    rowIndex: number;
    visualIndex: number;
    label: string;
    sql: string;
    params?: Record<string, any>;
  }) => void;
}

export function RowRenderer({ row, rowIndex, editMode, onEdit }: RowRendererProps) {
  // Render based on row type
  switch (row.type) {
    case 'tiles':
      return (
        <div className="space-y-4">
          {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
          {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {row.visuals.map((visual, visualIdx) => (
              <TileVisualComponent
                key={`${visualIdx}-${visual.query.sql}`}
                visual={visual}
                editMode={editMode}
                onEdit={() => onEdit({
                  rowIndex,
                  visualIndex: visualIdx,
                  label: visual.label,
                  sql: visual.query.sql,
                  params: visual.query.params,
                })}
              />
            ))}
          </div>
        </div>
      );

    case 'table': {
      const visual = row.visuals[0];
      return (
        <div className="space-y-4">
          {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
          {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
          
          <TableVisualComponent
            key={visual.query.sql}
            visual={visual}
            title={visual.label}
            editMode={editMode}
            onEdit={() => onEdit({
              rowIndex,
              visualIndex: 0,
              label: visual.label,
              sql: visual.query.sql,
              params: visual.query.params,
            })}
          />
        </div>
      );
    }

    case 'annotation':
      return <AnnotationComponent row={row} />;

    case 'charts':
      return (
        <div className="space-y-4">
          {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
          {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
          
          <div className={`grid gap-4 ${row.visuals.length === 1 ? 'grid-cols-1' : row.visuals.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'}`}>
            {row.visuals.map((visual, visualIdx) => {
              if (visual.kind === 'bar') {
                return (
                  <BarChartComponent
                    key={`${visualIdx}-${visual.query.sql}`}
                    visual={visual}
                    title={visual.label}
                    editMode={editMode}
                    onEdit={() => onEdit({
                      rowIndex,
                      visualIndex: visualIdx,
                      label: visual.label,
                      sql: visual.query.sql,
                      params: visual.query.params,
                    })}
                  />
                );
              } else if (visual.kind === 'pie') {
                return (
                  <PieChartComponent
                    key={`${visualIdx}-${visual.query.sql}`}
                    visual={visual}
                    title={visual.label}
                    editMode={editMode}
                    onEdit={() => onEdit({
                      rowIndex,
                      visualIndex: visualIdx,
                      label: visual.label,
                      sql: visual.query.sql,
                      params: visual.query.params,
                    })}
                  />
                );
              }
              return (
                <UnsupportedVisualComponent 
                  key={visualIdx}
                  type={(visual as any).kind || 'unknown'}
                  label={(visual as any).label || 'Unknown'}
                />
              );
            })}
          </div>
        </div>
      );

    default:
      // Unsupported type - show warning
      return (
        <UnsupportedVisualComponent 
          type={(row as any).type || 'unknown'} 
          label={(row as any).title || (row as any).label}
        />
      );
  }
}
