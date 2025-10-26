import { TileVisualComponent } from './TileVisualComponent';
import { TableVisualComponent } from './TableVisualComponent';
import { AnnotationComponent } from './AnnotationComponent';
import { BarChartComponent } from './BarChartComponent';
import { PieChartComponent } from './PieChartComponent';
import { UnsupportedVisualComponent } from './UnsupportedVisualComponent';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
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
  onEditAnnotation?: (annotation: {
    rowIndex: number;
    visualIndex: number;
    annotation: {
      section_name?: string;
      text?: string;
      markdown?: boolean;
    };
  }) => void;
  editingRowTitle?: boolean;
  tempRowTitle?: string;
  onStartEditRowTitle?: (rowIndex: number) => void;
  onSaveRowTitle?: () => void;
  onCancelEditRowTitle?: () => void;
  onRowTitleChange?: (value: string) => void;
  canEdit?: boolean;
}

export function RowRenderer({ 
  row, 
  rowIndex, 
  editMode, 
  onEdit, 
  onEditAnnotation,
  editingRowTitle = false,
  tempRowTitle = '',
  onStartEditRowTitle,
  onSaveRowTitle,
  onCancelEditRowTitle,
  onRowTitleChange,
  canEdit = false
}: RowRendererProps) {
  
  
  const renderRowTitle = () => {
    if (editingRowTitle) {
      return (
        <div className="mb-4">
          <Input
            value={tempRowTitle}
            onChange={(e) => onRowTitleChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRowTitle?.();
              if (e.key === 'Escape') onCancelEditRowTitle?.();
            }}
            className="text-2xl font-semibold h-10 px-3"
            placeholder="Row title"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button onClick={onSaveRowTitle} size="sm" variant="default">
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button onClick={onCancelEditRowTitle} size="sm" variant="outline">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      );
    }
    
    if (row.title) {
      return (
        <h2 
          className={`text-2xl font-semibold transition-all mb-4 ${
            canEdit ? 'cursor-pointer hover:text-[var(--text-primary)]' : ''
          }`}
          onClick={() => canEdit && onStartEditRowTitle?.(rowIndex)}
        >
          {row.title}
        </h2>
      );
    }
    
    return null;
  };

  // Render based on row type
  switch (row.type) {
    case 'tiles':
      return (
        <div className="space-y-4">
          {renderRowTitle()}
          
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
          {renderRowTitle()}
          
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

    case 'annotation': {
      const visual = row.visuals[0];
      return (
        <div className="space-y-4">
          {renderRowTitle()}
          
          <AnnotationComponent
            row={row}
            editMode={editMode}
            onEdit={() => onEditAnnotation?.({
              rowIndex,
              visualIndex: 0,
              annotation: {
                section_name: visual.options?.section_name,
                text: visual.options?.text,
                markdown: visual.options?.markdown,
              },
            })}
          />
        </div>
      );
    }

    case 'charts':
      return (
        <div className="space-y-4">
          {renderRowTitle()}
          
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
