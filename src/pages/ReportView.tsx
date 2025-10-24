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
import { AlertCircle, Edit, Save, X } from 'lucide-react';
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
  const [editorValue, setEditorValue] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = userRole === 'admin' || userRole === 'editor';

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
        .update({ report_schema: parsedSchema })
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
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Report Content */}
        <div className={isEditing ? "flex-1 overflow-auto" : "flex-1"}>
          <div className="container max-w-7xl py-8">
            <div className="flex items-start justify-between mb-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">{schema.title}</h1>
                {schema.subtitle && (
                  <p className="text-muted-foreground">{schema.subtitle}</p>
                )}
              </div>
              {canEdit && !isEditing && (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Schema
                </Button>
              )}
            </div>

            <div className="space-y-8">
              {schema.rows.map((row, idx) => {
                if (row.type === 'tiles') {
                  return <TilesRowComponent key={idx} row={row} />;
                } else if (row.type === 'table') {
                  return <TableRowComponent key={idx} row={row} />;
                } else if (row.type === 'annotation') {
                  return <AnnotationRowComponent key={idx} row={row} />;
                }
                return null;
              })}
            </div>
          </div>
        </div>

        {/* Editor Panel */}
        {isEditing && (
          <div className="h-[50vh] border-t bg-background flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <div>
                <h3 className="text-lg font-semibold">Edit Report Schema</h3>
                <p className="text-sm text-muted-foreground">
                  Modify the JSON schema for this report. Press Ctrl/Cmd+S to save.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSchema} disabled={saving} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <SqlEditor
                value={editorValue}
                onChange={setEditorValue}
                onExecute={handleSaveSchema}
                height="100%"
                language="json"
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// Tiles Row Component
const TilesRowComponent = ({ row }: { row: TilesRow }) => {
  return (
    <div className="space-y-4">
      {row.title && <h2 className="text-2xl font-semibold">{row.title}</h2>}
      {row.subtitle && <p className="text-muted-foreground">{row.subtitle}</p>}
      
      <div className="grid gap-4 md:grid-cols-3">
        {row.visuals.map((visual, idx) => (
          <TileWithData
            key={idx}
            visual={visual}
          />
        ))}
      </div>
    </div>
  );
};

// Tile with Data Fetching
const TileWithData = ({ visual }: { visual: TileVisual }) => {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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
    <MetricTile
      title={visual.label}
      value={value}
      format="number"
      decimals={visual.options?.precision || 0}
      loading={loading}
    />
  );
};

// Table Row Component
const TableRowComponent = ({ row }: { row: TableRow }) => {
  const visual = row.visuals[0];
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('run-sql-table', {
          body: { sql: visual.query.sql, page: 1, pageSize: visual.options?.page_size || 25 },
        });

        if (error) throw error;

        if (result.rows) {
          setData(result.rows);
          
          // Build columns from schema or result
          const cols = visual.options?.columns?.map(col => ({
            id: col.field,
            accessorKey: col.field,
            header: col.label || col.field,
          })) || result.columns?.map((col: string) => ({
            id: col,
            accessorKey: col,
            header: col,
          }));
          
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
