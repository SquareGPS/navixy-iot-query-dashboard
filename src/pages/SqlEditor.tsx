import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Play, Database, Plus, X, Download } from 'lucide-react';
import { SqlEditor as SqlEditorComponent } from '@/components/reports/SqlEditor';
import { DataTable } from '@/components/reports/DataTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface QueryTab {
  id: string;
  name: string;
  sql: string;
  results: any;
  error: string | null;
  executing: boolean;
  executionTime: number | null;
  fetchTime: number | null;
  rowCount: number;
  executedAt: Date | null;
}

const SqlEditor = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: '1',
      name: 'Query 1',
      sql: 'SELECT * FROM vehicles LIMIT 10',
      results: null,
      error: null,
      executing: false,
      executionTime: null,
      fetchTime: null,
      rowCount: 0,
      executedAt: null,
    },
  ]);
  const [activeTab, setActiveTab] = useState('1');

  // Redirect if not admin
  if (!loading && (!user || userRole !== 'admin')) {
    navigate('/app');
    toast.error('Access denied. Admin role required.');
    return null;
  }

  const addNewTab = () => {
    const newId = String(Date.now());
    const newTab: QueryTab = {
      id: newId,
      name: `Query ${tabs.length + 1}`,
      sql: 'SELECT * FROM vehicles LIMIT 10',
      results: null,
      error: null,
      executing: false,
      executionTime: null,
      fetchTime: null,
      rowCount: 0,
      executedAt: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newId);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      toast.error('Cannot close the last tab');
      return;
    }
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs[0].id);
    }
  };

  const updateTabSql = (tabId: string, sql: string) => {
    setTabs(tabs.map((t) => (t.id === tabId ? { ...t, sql } : t)));
  };

  const handleExecuteQuery = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !tab.sql.trim()) {
      toast.error('Please enter a SQL query');
      return;
    }

    // Start timing
    const startTime = performance.now();

    setTabs(
      tabs.map((t) =>
        t.id === tabId
          ? { ...t, executing: true, error: null, results: null, executionTime: null, fetchTime: null, executedAt: null }
          : t
      )
    );

    try {
      const fetchStartTime = performance.now();
      const { data, error: queryError } = await supabase.functions.invoke('run-sql-table', {
        body: { sql: tab.sql.trim() },
      });
      const fetchEndTime = performance.now();

      const executionTime = fetchEndTime - startTime;
      const fetchTime = fetchEndTime - fetchStartTime;
      const executedAt = new Date();

      if (queryError) throw queryError;

      if (data.error) {
        setTabs(
          tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  executing: false,
                  error: data.error.message || 'Query execution failed',
                  executionTime,
                  fetchTime,
                  executedAt,
                }
              : t
          )
        );
        toast.error(data.error.message || 'Query execution failed');
      } else {
        setTabs(
          tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  executing: false,
                  results: data,
                  rowCount: data.rows?.length || 0,
                  executionTime,
                  fetchTime,
                  executedAt,
                }
              : t
          )
        );
        toast.success('Query executed successfully');
      }
    } catch (err: any) {
      console.error('Error executing query:', err);
      const errorMessage = err.message || 'Failed to execute query';
      const executionTime = performance.now() - startTime;
      const executedAt = new Date();
      setTabs(
        tabs.map((t) =>
          t.id === tabId
            ? { ...t, executing: false, error: errorMessage, executionTime, fetchTime: null, executedAt }
            : t
        )
      );
      toast.error(errorMessage);
    }
  };

  const exportToCSV = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !tab.results || !tab.results.rows || tab.results.rows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const { rows, columns } = tab.results;
    
    // Create CSV header
    const csvHeader = columns.join(',');
    
    // Create CSV rows
    const csvRows = rows.map((row: any) => {
      return columns.map((col: string) => {
        const value = row[col];
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });
    
    const csv = [csvHeader, ...csvRows].join('\n');
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV exported successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentTab = tabs.find((t) => t.id === activeTab);

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">SQL Editor</h1>
              <p className="text-muted-foreground">
                Write and execute SELECT queries to test your database connection
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="border-b px-4 pt-4 flex items-center justify-between">
                  <TabsList className="h-auto p-0 bg-transparent">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="relative rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary"
                      >
                        <span className="mr-2">{tab.name}</span>
                        {tabs.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className="ml-1 hover:bg-muted rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addNewTab}
                    className="mb-2"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {tabs.map((tab) => (
                  <TabsContent key={tab.id} value={tab.id} className="m-0 p-4 space-y-4">
                    <div className="space-y-2">
                      <SqlEditorComponent
                        value={tab.sql}
                        onChange={(val) => updateTabSql(tab.id, val)}
                        onExecute={() => handleExecuteQuery(tab.id)}
                        height="300px"
                      />
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          {tab.executionTime !== null && (
                            <span>Query time: {tab.executionTime.toFixed(2)}ms</span>
                          )}
                          {tab.fetchTime !== null && (
                            <span>Fetch time: {tab.fetchTime.toFixed(2)}ms</span>
                          )}
                          {tab.results && (
                            <span>{tab.rowCount} row{tab.rowCount !== 1 ? 's' : ''} returned</span>
                          )}
                          {tab.executedAt && (
                            <span>Executed: {tab.executedAt.toLocaleTimeString()}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Only SELECT queries are allowed for security reasons
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleExecuteQuery(tab.id)}
                        disabled={tab.executing || !tab.sql.trim()}
                      >
                        {tab.executing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Execute Query
                          </>
                        )}
                      </Button>
                      {tab.results && tab.results.rows && tab.results.rows.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => exportToCSV(tab.id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export CSV
                        </Button>
                      )}
                    </div>

                    {tab.error && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <strong>Error:</strong> {tab.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {tab.results && (
                      <Card>
                        <CardContent className="p-4">
                          {tab.results.rows && tab.results.rows.length > 0 ? (
                            <DataTable
                              data={tab.results.rows}
                              columns={(tab.results.columns || []).map((col: string) => ({
                                id: col,
                                accessorKey: col,
                                header: col,
                              }))}
                              columnTypes={tab.results.columnTypes}
                            />
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No results returned
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SqlEditor;
