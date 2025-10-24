import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SqlEditor } from './SqlEditor';
import { DataTable } from './DataTable';
import { Save, X, Play } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ElementEditorProps {
  open: boolean;
  onClose: () => void;
  element: {
    label: string;
    sql: string;
    params?: Record<string, any>;
  };
  onSave: (sql: string, params?: Record<string, any>) => void;
}

export function ElementEditor({ open, onClose, element, onSave }: ElementEditorProps) {
  const [sql, setSql] = useState(element.sql);
  const [params, setParams] = useState(JSON.stringify(element.params || {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{ columns: any[], rows: any[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleSave = () => {
    setSaving(true);
    try {
      const parsedParams = params.trim() ? JSON.parse(params) : undefined;
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
    setTesting(true);
    setTestError(null);
    setTestResults(null);

    try {
      const { data: result, error } = await supabase.functions.invoke('run-sql-table', {
        body: { sql, page: 1, pageSize: 5 },
      });

      if (error) throw error;

      if (result?.error) {
        setTestError(result.error.message || 'Query failed');
        return;
      }

      if (result?.rows) {
        // Build columns from result
        let cols;
        if (result.columns && result.columns.length > 0) {
          cols = result.columns.map((col: string) => ({
            id: col,
            accessorKey: col,
            header: col,
            cell: ({ getValue }: any) => {
              const value = getValue();
              return value !== null && value !== undefined ? String(value) : '';
            },
          }));
        } else if (result.rows.length > 0) {
          cols = Object.keys(result.rows[0]).map((col: string) => ({
            id: col,
            accessorKey: col,
            header: col,
            cell: ({ getValue }: any) => {
              const value = getValue();
              return value !== null && value !== undefined ? String(value) : '';
            },
          }));
        } else {
          cols = [];
        }

        setTestResults({ columns: cols, rows: result.rows });
        toast({
          title: 'Success',
          description: 'Query executed successfully',
        });
      }
    } catch (err: any) {
      console.error('Error testing query:', err);
      setTestError(err.message || 'Failed to execute query');
      toast({
        title: 'Error',
        description: err.message || 'Failed to execute query',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Edit: {element.label}</DialogTitle>
          <DialogDescription>
            Modify the SQL query and parameters for this element
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sql" className="flex-1 flex flex-col px-6 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sql">SQL Query</TabsTrigger>
            <TabsTrigger value="params">Parameters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sql" className="flex-1 mt-4 overflow-auto flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>SQL Query</Label>
                <Button onClick={handleTestQuery} disabled={testing || !sql.trim()} size="sm" variant="outline">
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {testing ? 'Testing...' : 'Test Query'}
                </Button>
              </div>
              <div className="h-[200px] border rounded-md overflow-hidden">
                <SqlEditor
                  value={sql}
                  onChange={setSql}
                  height="100%"
                  language="sql"
                />
              </div>
            </div>

            {testError && (
              <Alert variant="destructive">
                <AlertDescription>{testError}</AlertDescription>
              </Alert>
            )}

            {testResults && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Test Results</Label>
                  <span className="text-xs text-muted-foreground">Showing first 5 rows</span>
                </div>
                <div className="border rounded-md">
                  <DataTable data={testResults.rows} columns={testResults.columns} />
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="params" className="flex-1 mt-4 overflow-hidden flex flex-col">
            <Label className="mb-2">Query Parameters (JSON)</Label>
            <Textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              className="flex-1 font-mono text-sm resize-none"
              placeholder='{"param1": "value1"}'
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
