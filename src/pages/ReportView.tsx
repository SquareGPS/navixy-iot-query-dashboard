import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { MetricTile } from '@/components/reports/MetricTile';
import { DataTable } from '@/components/reports/DataTable';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

interface Tile {
  id: string;
  title: string;
  sql: string;
  format: string;
  decimals: number;
  position: number;
}

interface Report {
  id: string;
  title: string;
  description: string | null;
  section_id: string | null;
  updated_at: string;
}

const ReportView = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [tileValues, setTileValues] = useState<Record<string, number | null>>({});
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<ColumnDef<any>[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  const canEdit = userRole === 'admin' || userRole === 'editor';

  useEffect(() => {
    if (reportId) {
      fetchReport();
    }
  }, [reportId]);

  const fetchReport = async () => {
    setLoading(true);
    
    const [reportRes, tilesRes, tableRes] = await Promise.all([
      supabase.from('reports').select('*').eq('id', reportId).single(),
      supabase.from('report_tiles').select('*').eq('report_id', reportId).order('position'),
      supabase.from('report_tables').select('*').eq('report_id', reportId).maybeSingle()
    ]);

    if (reportRes.data) setReport(reportRes.data);
    if (tilesRes.data) {
      setTiles(tilesRes.data);
      fetchTileValues(tilesRes.data);
    }
    
    if (tableRes.data) {
      fetchTableData(tableRes.data.sql);
    }

    setLoading(false);
  };

  const fetchTileValues = async (tiles: Tile[]) => {
    const values: Record<string, number | null> = {};
    
    for (const tile of tiles) {
      try {
        const { data } = await supabase.functions.invoke('run-sql-tile', {
          body: { sql: tile.sql }
        });
        values[tile.id] = data?.value ?? null;
      } catch (error) {
        console.error('Error fetching tile value:', error);
        values[tile.id] = null;
      }
    }
    
    setTileValues(values);
  };

  const fetchTableData = async (sql: string) => {
    setTableLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('run-sql-table', {
        body: {
          sql,
          page: pagination.page,
          pageSize: pagination.pageSize
        }
      });

      if (error) throw error;

      if (data?.columns && data?.rows) {
        const cols: ColumnDef<any>[] = data.columns.map((col: string) => ({
          accessorKey: col,
          header: col,
        }));
        setTableColumns(cols);
        setTableData(data.rows);
        setPagination(prev => ({ ...prev, total: data.total || 0 }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load table data');
    }
    
    setTableLoading(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Report not found</h2>
            <p className="text-muted-foreground mt-2">The report you're looking for doesn't exist.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{report.title}</h1>
            {report.description && (
              <p className="text-muted-foreground mt-2">{report.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date(report.updated_at).toLocaleString()}
            </p>
          </div>
          
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {/* Metric Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((tile) => (
            <MetricTile
              key={tile.id}
              title={tile.title}
              value={tileValues[tile.id] ?? null}
              format={tile.format as any}
              decimals={tile.decimals}
            />
          ))}
        </div>

        {/* Data Table */}
        {tableColumns.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Data Table</h2>
            <DataTable
              data={tableData}
              columns={tableColumns}
              loading={tableLoading}
              pagination={{
                ...pagination,
                onPageChange: (page) => setPagination(prev => ({ ...prev, page })),
                onPageSizeChange: (pageSize) => setPagination(prev => ({ ...prev, pageSize, page: 1 }))
              }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ReportView;
