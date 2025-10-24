import type { AnnotationRow } from '@/types/report-schema';

interface AnnotationComponentProps {
  row: AnnotationRow;
}

export function AnnotationComponent({ row }: AnnotationComponentProps) {
  const visual = row.visuals[0];
  
  return (
    <div className="space-y-4">
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
    </div>
  );
}
