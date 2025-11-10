import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Play, Database, Plus, X, Download } from 'lucide-react';
import { SqlEditor as SqlEditorComponent } from '@/components/reports/SqlEditor';
import { DataTable } from '@/components/reports/DataTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '@/components/ui/icon';
import { useSqlExecution } from '@/hooks/use-sql-execution';

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
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  } | null;
}

const SqlEditor = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Use the shared SQL execution hook - this ensures consistent behavior
  const { executing, results, error, executeQuery } = useSqlExecution();
  
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: '1',
      name: 'Query 1',
      sql: `SELECT * 
FROM raw_telematics_data.tracking_data_core 
LIMIT 10;`,
      results: null,
      error: null,
      executing: false,
      executionTime: null,
      fetchTime: null,
      rowCount: 0,
      executedAt: null,
      pagination: null,
    },
  ]);
  const [activeTab, setActiveTab] = useState('1');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  
  // Track which tab is currently executing
  const [executingTabId, setExecutingTabId] = useState<string | null>(null);

  // Redirect if not admin or editor
  if (!loading && (!user || !['admin', 'editor'].includes(user?.role || ''))) {
    navigate('/app');
    toast.error('Access denied. Admin or Editor role required.');
    return null;
  }

  const addNewTab = () => {
    const newId = String(Date.now());
    const newTab: QueryTab = {
      id: newId,
      name: `Query ${tabs.length + 1}`,
      sql: `SELECT * 
FROM raw_telematics_data.tracking_data_core 
LIMIT 10;`,
      results: null,
      error: null,
      executing: false,
      executionTime: null,
      fetchTime: null,
      rowCount: 0,
      executedAt: null,
      pagination: null,
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

    // Get pagination state from tab (default to page 1, pageSize 50)
    const currentPage = tab.pagination?.page || 1;
    const currentPageSize = tab.pagination?.pageSize || 50;

    // Mark this tab as executing
    setExecutingTabId(tabId);
    setTabs(
      tabs.map((t) =>
        t.id === tabId
          ? { ...t, executing: true, error: null, results: null, executionTime: null, fetchTime: null, executedAt: null }
          : t
      )
    );

    // Use the shared hook's executeQuery function with pagination
    const executionResult = await executeQuery({
      sql: tab.sql.trim(),
      params: {},
      timeout_ms: 30000,
      row_limit: 10000, // Max rows limit (pagination handles the rest)
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
      },
      showSuccessToast: false, // We'll handle the toast ourselves
      showErrorToast: false, // We'll handle the toast ourselves
    });

    // Update the tab with the results from the hook
    if (executionResult) {
      // Success case
      const transformedData = {
        columns: executionResult.columns,
        rows: executionResult.rows,
        columnTypes: executionResult.columnTypes,
        total: executionResult.pagination?.total || executionResult.rowCount,
        page: executionResult.pagination?.page || 1,
        pageSize: executionResult.pagination?.pageSize || currentPageSize,
      };

      setTabs(
        tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                executing: false,
                results: transformedData,
                error: null,
                rowCount: executionResult.pagination?.total || executionResult.rowCount,
                executionTime: executionResult.executionTime,
                fetchTime: executionResult.fetchTime,
                executedAt: executionResult.executedAt,
                pagination: executionResult.pagination || null,
              }
            : t
        )
      );
      toast.success('Query executed successfully');
    } else {
      // Error case - error is already set in the hook state
      setTabs(
        tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                executing: false,
                error: error || 'Failed to execute query',
                executionTime: null,
                fetchTime: null,
                executedAt: new Date(),
              }
            : t
        )
      );
      if (error) {
        toast.error(error);
      }
    }
    
    setExecutingTabId(null);
  };

  const handlePageChange = (tabId: string, page: number) => {
    setTabs(
      tabs.map((t) =>
        t.id === tabId && t.pagination
          ? { ...t, pagination: { ...t.pagination, page } }
          : t
      )
    );
    // Re-execute query with new page
    handleExecuteQuery(tabId);
  };

  const handlePageSizeChange = (tabId: string, pageSize: number) => {
    setTabs(
      tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              pagination: t.pagination
                ? { ...t.pagination, pageSize, page: 1 } // Reset to page 1 when changing page size
                : { page: 1, pageSize, total: t.rowCount || 0 },
            }
          : t
      )
    );
    // Re-execute query with new page size
    handleExecuteQuery(tabId);
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
      <div className="container max-w-7xl py-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Database className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">SQL Editor</h1>
              <p className="text-sm text-muted-foreground">
                You can safely explore your data with SELECT queries — your data remains protected from accidental changes
              </p>
            </div>
          </div>

          <div className="border border-border rounded-lg bg-background">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b border-border px-3 pt-3">
                <TabsList className="h-auto p-0 bg-transparent flex items-center justify-start gap-0">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="relative rounded-t-md rounded-b-none data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2 text-sm"
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
                  <button
                    onClick={addNewTab}
                    className="h-8 w-8 p-0 ml-1 flex items-center justify-center hover:bg-muted rounded"
                    title="Add new tab"
                  >
                    <Icon icon={Plus} size={4} />
                  </button>
                </TabsList>
              </div>

              {tabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="m-0 p-3 space-y-3">
                  <div className="space-y-2">
                    <SqlEditorComponent
                      value={tab.sql}
                      onChange={(val) => updateTabSql(tab.id, val)}
                      onExecute={() => handleExecuteQuery(tab.id)}
                      height="280px"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {tab.executionTime !== null && (
                          <span>Query time: {tab.executionTime.toFixed(2)}ms</span>
                        )}
                        {tab.fetchTime !== null && (
                          <span>Fetch time: {tab.fetchTime.toFixed(2)}ms</span>
                        )}
                        {tab.results && (
                          <span>
                            {tab.pagination
                              ? `Showing ${((tab.pagination.page - 1) * tab.pagination.pageSize) + 1}-${Math.min(tab.pagination.page * tab.pagination.pageSize, tab.pagination.total)} of ${tab.pagination.total} row${tab.pagination.total !== 1 ? 's' : ''}`
                              : `${tab.rowCount} row${tab.rowCount !== 1 ? 's' : ''} returned`}
                          </span>
                        )}
                        {tab.executedAt && (
                          <span>Executed: {tab.executedAt.toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleExecuteQuery(tab.id)}
                      disabled={(executingTabId === tab.id || tab.executing) || !tab.sql.trim()}
                      size="sm"
                    >
                      {(executingTabId === tab.id || tab.executing) ? (
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
                        size="sm"
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
                    <div className="border border-border rounded-md bg-background">
                      <div className="p-3">
                        {tab.results.rows && tab.results.rows.length > 0 ? (
                          <DataTable
                            data={tab.results.rows}
                            columns={(tab.results.columns || []).map((col: string) => ({
                              id: col,
                              accessorKey: col,
                              header: col,
                            }))}
                            columnTypes={tab.results.columnTypes}
                            pagination={
                              tab.pagination
                                ? {
                                    page: tab.pagination.page,
                                    pageSize: tab.pagination.pageSize,
                                    total: tab.pagination.total,
                                    onPageChange: (page: number) => handlePageChange(tab.id, page),
                                    onPageSizeChange: (pageSize: number) => handlePageSizeChange(tab.id, pageSize),
                                  }
                                : undefined
                            }
                            loading={executingTabId === tab.id || tab.executing}
                          />
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            No results returned
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SqlEditor;
