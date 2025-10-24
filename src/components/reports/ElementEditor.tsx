import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SqlEditor } from './SqlEditor';
import { Save, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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

  const handleSave = () => {
    setSaving(true);
    try {
      const parsedParams = params.trim() ? JSON.parse(params) : undefined;
      onSave(sql, parsedParams);
      onClose();
    } catch (err) {
      console.error('Invalid JSON in parameters:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit: {element.label}</DialogTitle>
          <DialogDescription>
            Modify the SQL query and parameters for this element
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sql" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sql">SQL Query</TabsTrigger>
            <TabsTrigger value="params">Parameters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sql" className="flex-1 mt-4">
            <div className="h-full">
              <SqlEditor
                value={sql}
                onChange={setSql}
                height="100%"
                language="sql"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="params" className="flex-1 mt-4 flex flex-col">
            <Label className="mb-2">Query Parameters (JSON)</Label>
            <Textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              className="flex-1 font-mono text-sm"
              placeholder='{"param1": "value1"}'
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
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
