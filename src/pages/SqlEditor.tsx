import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');

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

  const startEditingTab = (tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditingTabName(currentName);
  };

  const saveTabName = (tabId: string) => {
    if (editingTabName.trim()) {
      setTabs(tabs.map((t) => (t.id === tabId ? { ...t, name: editingTabName.trim() } : t)));
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const cancelEditingTab = () => {
    setEditingTabId(null);
    setEditingTabName('');
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

      // Edge function errors should not happen now since we return 200 with error in body
      if (queryError) {
        console.error('Unexpected edge function invocation error:', queryError);
        const errorMsg = queryError.message || 'Failed to connect to database';
        setTabs(
          tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  executing: false,
                  error: errorMsg,
                  executionTime,
                  fetchTime,
                  executedAt,
                }
              : t
          )
        );
        toast.error(errorMsg);
        return; // Exit early
      }

      // Handle SQL execution errors from edge function
      if (data?.error) {
        console.error('SQL execution error:', data.error);
        let errorMsg = data.error.message || 'Query execution failed';
        
        // Add error code if available
        if (data.error.code) {
          errorMsg = `[${data.error.code}] ${errorMsg}`;
        }
        
        setTabs(
          tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  executing: false,
                  error: errorMsg,
                  executionTime,
                  fetchTime,
                  executedAt,
                }
              : t
          )
        );
        toast.error(errorMsg);
        return; // Exit early on error
      }

      // Success case - only reached if no errors
      setTabs(
        tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                executing: false,
                results: data,
                error: null, // Clear any previous errors
                rowCount: data.rows?.length || 0,
                executionTime,
                fetchTime,
                executedAt,
              }
            : t
        )
      );
      toast.success('Query executed successfully');
    } catch (err: any) {
      console.error('Unexpected error executing query:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        context: err.context,
      });
      
      let errorMessage = 'Failed to execute query';
      
      // Try to extract meaningful error information
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.context?.body) {
        try {
          const bodyError = typeof err.context.body === 'string' 
            ? JSON.parse(err.context.body) 
            : err.context.body;
          if (bodyError?.error?.message) {
            errorMessage = bodyError.error.message;
            if (bodyError.error.code) {
              errorMessage = `[${bodyError.error.code}] ${errorMessage}`;
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse error body:', parseErr);
        }
      }
      
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
                <div className="border-b px-4 pt-4">
                  <TabsList className="h-auto p-0 bg-transparent flex items-center gap-0">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="relative rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2"
                      >
                        {editingTabId === tab.id ? (
                          <Input
                            value={editingTabName}
                            onChange={(e) => setEditingTabName(e.target.value)}
                            onBlur={() => saveTabName(tab.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveTabName(tab.id);
                              } else if (e.key === 'Escape') {
                                cancelEditingTab();
                              }
                            }}
                            className="h-6 w-24 px-1 py-0 text-sm"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="mr-2"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditingTab(tab.id, tab.name);
                            }}
                          >
                            {tab.name}
                          </span>
                        )}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addNewTab}
                      className="h-8 w-8 p-0 ml-1"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TabsList>
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
                        <AlertDescription className="font-mono text-sm whitespace-pre-wrap">
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
