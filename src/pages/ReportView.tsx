import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { MetricTile } from '@/components/reports/MetricTile';
import { DataTable } from '@/components/reports/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SqlEditor } from '@/components/reports/SqlEditor';
import { ElementEditor } from '@/components/reports/ElementEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, Edit, Save, X, Code, Pencil, Download, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { ReportSchema, TilesRow, TableRow, AnnotationRow, TileVisual } from '@/types/report-schema';

const ReportView = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { userRole } = useAuth();
  const [schema, setSchema] = useState<ReportSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'full' | 'inline'>('inline');
  const [editorValue, setEditorValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingElement, setEditingElement] = useState<{
    rowIndex: number;
    visualIndex: number;
    label: string;
    sql: string;
    params?: Record<string, any>;
  } | null>(null);

  const canEdit = userRole === 'admin';

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;

      setLoading(true);
      setError(null);

      try {
        const { data: report, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (reportError) throw reportError;
        
        if (!report.report_schema) {
          throw new Error('Report schema is missing');
        }

        const reportSchema = report.report_schema as unknown as ReportSchema;
        setSchema(reportSchema);
        setEditorValue(JSON.stringify(reportSchema, null, 2));
      } catch (err: any) {
        console.error('Error fetching report:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  const handleSaveSchema = async () => {
    if (!reportId) return;

    setSaving(true);
    try {
      const parsedSchema = JSON.parse(editorValue);
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({ report_schema: parsedSchema as any })
        .eq('id', reportId);

      if (updateError) throw updateError;

      setSchema(parsedSchema);
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'Report schema updated successfully',
      });
    } catch (err: any) {
      console.error('Error saving schema:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save schema',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveElement = async (sql: string, params?: Record<string, any>) => {
    if (!editingElement || !schema) return;

    const updatedSchema = { ...schema };
    const row = updatedSchema.rows[editingElement.rowIndex];
    
    if (row.type === 'tiles' || row.type === 'table') {
      const visual = row.visuals[editingElement.visualIndex];
      visual.query.sql = sql;
      if (params) {
        visual.query.params = params;
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('reports')
        .update({ report_schema: updatedSchema as any })
        .eq('id', reportId);

      if (updateError) throw updateError;

      setSchema(updatedSchema);
      setEditorValue(JSON.stringify(updatedSchema, null, 2));
      toast({
        title: 'Success',
        description: 'Element updated successfully',
      });
    } catch (err: any) {
      console.error('Error saving element:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save element',
        variant: 'destructive',
      });
    }
  };

  const handleExportSchema = () => {
    const blob = new Blob([editorValue], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema?.title || 'report'}-schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: 'Schema exported successfully',
    });
  };

  const handleImportSchema = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            JSON.parse(content); // Validate JSON
            setEditorValue(content);
            toast({
              title: 'Success',
              description: 'Schema imported successfully',
            });
          } catch (err) {
            toast({
              title: 'Error',
              description: 'Invalid JSON file',
              variant: 'destructive',
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl py-8">
          <Skeleton className="h-12 w-1/3 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (error || !schema) {
    return (
      <AppLayout>
        <div className="container max-w-7xl py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Report not found'}</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] overflow-auto">
          <div className="container max-w-7xl py-8">
            <div className="flex items-start justify-between mb-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">{schema.title}</h1>
                {schema.subtitle && (
                  <p className="text-muted-foreground">{schema.subtitle}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  {isEditing && editMode === 'inline' && (
                    <Button onClick={() => { setEditMode('full'); }} variant="outline" size="sm">
                      <Code className="h-4 w-4 mr-2" />
                      Full Schema
                    </Button>
                  )}
                  <Button 
                    onClick={() => { 
                      setIsEditing(!isEditing); 
                      if (!isEditing) setEditMode('inline');
                    }} 
                    variant={isEditing ? "default" : "outline"}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditing ? 'Exit Edit Mode' : 'Edit Mode'}
                  </Button>
                </div>
              )}
            </div>

                <div className="space-y-8">
                  {schema.rows.map((row, rowIdx) => {
                    const inlineEditActive = isEditing && editMode === 'inline';
                    if (row.type === 'tiles') {
                      return <TilesRowComponent key={rowIdx} row={row} rowIndex={rowIdx} editMode={inlineEditActive} onEdit={setEditingElement} />;
                    } else if (row.type === 'table') {
                      return <TableRowComponent key={rowIdx} row={row} rowIndex={rowIdx} editMode={inlineEditActive} onEdit={setEditingElement} />;
                    } else if (row.type === 'annotation') {
                      return <AnnotationRowComponent key={rowIdx} row={row} />;
                    }
                    return null;
                  })}
                 </div>
          </div>
        </div>

      <Dialog open={isEditing && editMode === 'full'} onOpenChange={(open) => !open && setIsEditing(false)}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Edit Report Schema</DialogTitle>
            <DialogDescription>
              Modify the complete JSON schema for this report
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-6 overflow-hidden">
            <SqlEditor
              value={editorValue}
              onChange={setEditorValue}
              height="100%"
              language="json"
            />
          </div>

          <div className="flex justify-between gap-2 px-6 py-4 border-t">
            <div className="flex gap-2">
              <Button onClick={handleImportSchema} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={handleExportSchema} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveSchema} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {editingElement && (
        <ElementEditor
          open={!!editingElement}
          onClose={() => setEditingElement(null)}
          element={editingElement}
          onSave={handleSaveElement}
        />
      )}
    </AppLayout>
  );
};

// Tiles Row Component
const TilesRowComponent = ({ 
  row, 
  rowIndex, 
  editMode, 
  onEdit 
}: { 
  row: TilesRow; 
  rowIndex: number;
  editMode: boolean;
  onEdit: (element: any) => void;
}) => {
  return (
    <div className="space-y-4">
      {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
      {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {row.visuals.map((visual, visualIdx) => (
          <TileWithData
            key={visualIdx}
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
};

// Tile with Data Fetching
const TileWithData = ({ 
  visual, 
  editMode, 
  onEdit 
}: { 
  visual: TileVisual;
  editMode: boolean;
  onEdit: () => void;
}) => {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchValue = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('run-sql-tile', {
          body: { sql: visual.query.sql },
        });

        if (error) throw error;
        
        setValue(result.value !== undefined ? Number(result.value) : null);
      } catch (err) {
        console.error('Error fetching tile value:', err);
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
};

// Table Row Component
const TableRowComponent = ({ 
  row, 
  rowIndex, 
  editMode, 
  onEdit 
}: { 
  row: TableRow;
  rowIndex: number;
  editMode: boolean;
  onEdit: (element: any) => void;
}) => {
  const visual = row.visuals[0];
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('run-sql-table', {
          body: { sql: visual.query.sql, page: 1, pageSize: visual.options?.page_size || 25 },
        });

        if (error) throw error;
        
        // Check if result contains an error
        if (result?.error) {
          console.error('Table query error:', result.error);
          throw new Error(result.error.message || 'Query failed');
        }

        if (result?.rows) {
          setData(result.rows);
          
          // Build columns from schema or result
          let cols;
          if (visual.options?.columns && visual.options.columns.length > 0) {
            cols = visual.options.columns.map(col => ({
              id: col.field,
              accessorKey: col.field,
              header: col.label || col.field,
              cell: ({ getValue }: any) => {
                const value = getValue();
                return value !== null && value !== undefined ? String(value) : '';
              },
            }));
          } else if (result.columns && result.columns.length > 0) {
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
            // Fallback: derive columns from first row
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
          
          console.log('Table columns:', cols);
          console.log('Table data:', result.rows);
          setColumns(cols);
        }
      } catch (err) {
        console.error('Error fetching table data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visual.query.sql, visual.options?.page_size, visual.options?.columns]);

  return (
    <div className="space-y-4">
      {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
      {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
      
      <div 
        className="relative"
        onMouseEnter={() => editMode && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card>
          <CardHeader>
            <CardTitle>{visual.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-96" />
            ) : (
              <DataTable data={data} columns={columns} />
            )}
          </CardContent>
        </Card>
        {editMode && isHovered && (
          <button
            onClick={() => onEdit({
              rowIndex,
              visualIndex: 0,
              label: visual.label,
              sql: visual.query.sql,
              params: visual.query.params,
            })}
            className="absolute top-4 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-10"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Annotation Row Component
const AnnotationRowComponent = ({ row }: { row: AnnotationRow }) => {
  const visual = row.visuals[0];
  
  return (
    <Card>
      <CardContent className="pt-6">
        {visual.options?.section_name && (
          <h3 className="text-xl font-semibold mb-2">{visual.options.section_name}</h3>
        )}
        {visual.options?.subtitle && (
          <p className="text-sm text-muted-foreground mb-4">{visual.options.subtitle}</p>
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
      </CardContent>
    </Card>
  );
};

export default ReportView;
