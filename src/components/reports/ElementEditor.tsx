import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SqlEditor } from './SqlEditor';
import { DataTable } from './DataTable';
import { Save, X, Play, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { formatSql } from '@/lib/sqlFormatter';
import { useSqlExecution } from '@/hooks/use-sql-execution';

interface ElementEditorProps {
  open: boolean;
  onClose: () => void;
  element: {
    label: string;
    sql: string;
    params?: Record<string, any>;
  };
  onSave: (sql: string, params?: Record<string, any>) => void;
  onDelete?: () => void;
}

export function ElementEditor({ open, onClose, element, onSave, onDelete }: ElementEditorProps) {
  const [sql, setSql] = useState(() => formatSql(element.sql));
  const [params, setParams] = useState(JSON.stringify(element.params || {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { executing, results, error, executeQuery } = useSqlExecution();

  const handleSave = () => {
    setSaving(true);
    try {
      const parsedParams = params.trim() ? JSON.parse(params) : undefined;
      // Save SQL with original formatting and comments preserved
      onSave(sql, parsedParams);
      onClose();
    } catch (err) {
      console.error('Invalid JSON in parameters:', err);
      toast({
        title: 'Error',
        description: 'Invalid JSON in parameters',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestQuery = async () => {
    // Parse parameters with better error handling
    let parsedParams: Record<string, unknown> = {};
    const paramsTrimmed = params.trim();
    
    if (paramsTrimmed) {
      try {
        parsedParams = JSON.parse(paramsTrimmed);
        if (typeof parsedParams !== 'object' || parsedParams === null || Array.isArray(parsedParams)) {
          throw new Error('Parameters must be a JSON object');
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Invalid JSON in parameters';
        console.error('Failed to parse parameters:', err);
        toast({
          title: 'Invalid Parameters',
          description: errorMsg + '. Proceeding with empty parameters.',
          variant: 'destructive',
        });
        // Continue with empty params instead of failing completely
        parsedParams = {};
      }
    }
    
    try {
      await executeQuery({
        sql: sql.trim(),
        params: parsedParams,
        timeout_ms: 10000,
        row_limit: 100, // Increased from 5 to allow testing queries that return more rows
      });
    } catch (err: any) {
      console.error('Unexpected error executing query:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to execute query',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setDeleting(true);
    try {
      await onDelete();
      onClose();
      toast({
        title: 'Success',
        description: 'Element deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting element:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete element',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 bg-[var(--surface-1)] border-[var(--border)] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] rounded-t-lg">
          <DialogTitle className="text-[var(--text-primary)]">Edit: {element.label}</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Modify the SQL query and parameters for this element
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sql" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-2 flex-shrink-0">
            <TabsTrigger value="sql">SQL Query</TabsTrigger>
            <TabsTrigger value="params">Parameters</TabsTrigger>
          </TabsList>
          
          {/* SQL Query Tab */}
          <TabsContent value="sql" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <div className="flex-1 flex flex-col min-h-0 gap-3">
              {/* SQL Editor - 50% */}
              <div className="flex-1 flex flex-col min-h-0 basis-0">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                  <Label className="text-sm font-medium">SQL Query</Label>
                  <Button onClick={handleTestQuery} disabled={executing || !sql.trim()} size="sm" variant="outline">
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    {executing ? 'Testing...' : 'Test Query'}
                  </Button>
                </div>
                <div className="flex-1 border rounded-md overflow-hidden min-h-0">
                  <SqlEditor
                    value={sql}
                    onChange={setSql}
                    height="100%"
                    language="sql"
                  />
                </div>
              </div>

              {/* Test Results - 50% */}
              <div className="flex-1 flex flex-col min-h-0 basis-0">
                {error && (
                  <Alert variant="destructive" className="mb-2 flex-shrink-0">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                  <Label className="text-sm font-medium">Test Results</Label>
                  {results && (
                    <span className="text-xs text-muted-foreground">
                      {results.rowCount} row{results.rowCount !== 1 ? 's' : ''} returned
                    </span>
                  )}
                </div>
                
                <div className="flex-1 border rounded-md overflow-auto min-h-0 bg-background">
                  {results ? (
                    <DataTable
                      data={results.rows}
                      columns={results.columns.map((col: string) => ({
                        id: col,
                        accessorKey: col,
                        header: col,
                      }))}
                      columnTypes={results.columnTypes}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Click "Test Query" to see results
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Parameters Tab */}
          <TabsContent value="params" className="flex-1 m-0 mt-4 px-6 data-[state=active]:flex flex-col min-h-0 overflow-hidden bg-[var(--surface-1)]">
            <Label className="mb-2 flex-shrink-0 text-sm font-medium text-[var(--text-primary)]">Query Parameters (JSON)</Label>
            <Textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              className="flex-1 font-mono text-sm resize-none min-h-0 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
              placeholder='{"param1": "value1"}'
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0 bg-[var(--surface-1)] rounded-b-lg">
          <div>
            {onDelete && (
              <Button 
                onClick={() => setShowDeleteDialog(true)} 
                variant="destructive" 
                size="sm"
                disabled={saving || deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Element
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Element
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this element? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Element: <span className="font-medium">{element.label}</span>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Element'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
