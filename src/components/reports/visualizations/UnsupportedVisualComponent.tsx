import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface UnsupportedVisualComponentProps {
  type: string;
  label?: string;
}

export function UnsupportedVisualComponent({ type, label }: UnsupportedVisualComponentProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Unsupported Visualization Type</AlertTitle>
      <AlertDescription>
        The visualization type "{type}"{label ? ` (${label})` : ''} is not yet supported.
        <br />
        <span className="text-xs mt-1 block">
          Supported types: tiles, table, annotation
        </span>
      </AlertDescription>
    </Alert>
  );
}
