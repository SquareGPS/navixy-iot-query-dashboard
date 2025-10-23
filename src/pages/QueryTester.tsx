import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Play, Database } from 'lucide-react';
import { SqlEditor } from '@/components/reports/SqlEditor';
import { DataTable } from '@/components/reports/DataTable';
import { Alert, AlertDescription } from '@/components/ui/alert';

const QueryTester = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [sql, setSql] = useState('SELECT * FROM vehicles LIMIT 10');
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not admin
  if (!loading && (!user || userRole !== 'admin')) {
    navigate('/app');
    toast.error('Access denied. Admin role required.');
    return null;
  }

  const handleExecuteQuery = async () => {
    if (!sql.trim()) {
      toast.error('Please enter a SQL query');
      return;
    }

    setExecuting(true);
    setError(null);
    setResults(null);

    try {
      const { data, error: queryError } = await supabase.functions.invoke('run-sql-table', {
        body: { sql: sql.trim() },
      });

      if (queryError) throw queryError;

      if (data.error) {
        setError(data.error.message || 'Query execution failed');
        toast.error(data.error.message || 'Query execution failed');
      } else {
        setResults(data);
        toast.success('Query executed successfully');
      }
    } catch (err: any) {
      console.error('Error executing query:', err);
      const errorMessage = err.message || 'Failed to execute query';
      setError(errorMessage);
      toast.error(errorMessage);
    }

    setExecuting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">SQL Query Tester</h1>
            <p className="text-muted-foreground mt-2">
              Test SQL queries against your configured external database
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                SQL Editor
              </CardTitle>
              <CardDescription>
                Write and execute SELECT queries to test your database connection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <SqlEditor
                  value={sql}
                  onChange={setSql}
                  height="300px"
                />
                <p className="text-sm text-muted-foreground">
                  Only SELECT queries are allowed for security reasons
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleExecuteQuery}
                  disabled={executing || !sql.trim()}
                >
                  {executing ? (
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
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {results && (
            <Card>
              <CardHeader>
                <CardTitle>Query Results</CardTitle>
                <CardDescription>
                  {results.rows?.length || 0} row(s) returned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results.rows && results.rows.length > 0 ? (
                  <DataTable
                    data={results.rows}
                    columns={results.columns || []}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No results returned
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default QueryTester;
