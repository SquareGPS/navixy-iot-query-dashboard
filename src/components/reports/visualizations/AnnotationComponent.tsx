import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { AnnotationRow } from '@/types/report-schema';

interface AnnotationComponentProps {
  row: AnnotationRow;
  editMode?: boolean;
  onEdit?: () => void;
}

export function AnnotationComponent({ row, editMode = false, onEdit }: AnnotationComponentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const visual = row.visuals[0];
  
  return (
    <div 
      className="relative space-y-4"
      onMouseEnter={() => editMode && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
      {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
      {visual.options?.section_name && (
        <h3 className="text-xl font-semibold">{visual.options.section_name}</h3>
      )}
      {visual.options?.subtitle && (
        <p className="text-sm text-muted-foreground">{visual.options.subtitle}</p>
      )}
      {visual.options?.text && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {visual.options.markdown ? (
            <div dangerouslySetInnerHTML={{ __html: visual.options.text }} />
          ) : (
            <p>{visual.options.text}</p>
          )}
        </div>
      )}
      {editMode && isHovered && onEdit && (
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
