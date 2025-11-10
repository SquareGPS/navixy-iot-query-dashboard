import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { BarChart3, Settings, ChevronDown, ChevronUp, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface DatabaseConnection {
  connectionType: 'url' | 'host';
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? '' : '/api');

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMetabaseSettings, setShowMetabaseSettings] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'url' | 'host'>('url');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dbConnection, setDbConnection] = useState<DatabaseConnection>({
    connectionType: 'url',
    url: import.meta.env.VITE_DEFAULT_DB_CONNECTION_URL || '',
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: '',
    ssl: false,
  });
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  // Parse URL to individual parameters
  const parseUrl = (url: string) => {
    if (!url) return;
    try {
      const urlObj = new URL(url);
      const sslmode = urlObj.searchParams.get('sslmode');
      
      setDbConnection(prev => ({
        ...prev,
        host: urlObj.hostname,
        port: parseInt(urlObj.port) || 5432,
        database: urlObj.pathname.slice(1),
        user: decodeURIComponent(urlObj.username || ''),
        password: decodeURIComponent(urlObj.password || ''),
        ssl: sslmode === 'require',
      }));
    } catch (e) {
      console.error('Invalid URL format', e);
    }
  };

  // Construct URL from individual parameters
  const constructUrl = (data: DatabaseConnection) => {
    if (!data.host || !data.database || !data.user) return '';
    
    const password = encodeURIComponent(data.password || '');
    const user = encodeURIComponent(data.user);
    const sslParam = data.ssl ? '?sslmode=require' : '';
    
    return `postgresql://${user}:${password}@${data.host}:${data.port || 5432}/${data.database}${sslParam}`;
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);

    let testSettings: any;
    
    if (connectionMethod === 'url') {
      if (!dbConnection.url || !dbConnection.url.trim()) {
        toast.error('Please provide a database connection URL');
        setIsTestingConnection(false);
        return;
      }
      testSettings = {
        external_db_url: dbConnection.url.trim(),
      };
    } else {
      if (!dbConnection.host || !dbConnection.database || !dbConnection.user) {
        toast.error('Please provide host, database, and user for database connection');
        setIsTestingConnection(false);
        return;
      }
      testSettings = {
        external_db_host: dbConnection.host.trim(),
        external_db_port: dbConnection.port || 5432,
        external_db_name: dbConnection.database.trim(),
        external_db_user: dbConnection.user.trim(),
        external_db_password: dbConnection.password || '',
        external_db_ssl: dbConnection.ssl || false,
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/test-metadata-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testSettings),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionTestResult({ success: true, message: data.message || 'Connection successful!' });
        toast.success('Database connection successful!');
      } else {
        const errorMessage = data.error?.message || data.message || data.error || 'Connection failed';
        setConnectionTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setConnectionTestResult({ success: false, message: `Network error: ${errorMessage}` });
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md">
        <div className="space-y-6 p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-accent rounded-xl">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Navixy Reports</h1>
              <p className="text-text-muted">Design and view analytics reports</p>
            </div>
          </div>
          
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-secondary">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-surface-3 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-secondary">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-surface-3 border-border"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="p-3 bg-surface-3 rounded-lg text-sm text-text-muted">
            <p className="font-semibold mb-1 text-text-secondary">Demo Account:</p>
            <p>Email: admin@example.com</p>
            <p>Password: admin123</p>
          </div>

          {/* Metabase Database Configuration */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowMetabaseSettings(!showMetabaseSettings)}
              className="w-full flex items-center justify-between p-2 hover:bg-surface-3 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-text-muted" />
                <span className="text-sm font-medium text-text-secondary">Metabase Database</span>
              </div>
              {showMetabaseSettings ? (
                <ChevronUp className="h-4 w-4 text-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-text-muted" />
              )}
            </button>

            {showMetabaseSettings && (
              <div className="mt-4 space-y-4 p-4 bg-surface-3 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-text-secondary font-semibold flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Connection Method
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="connectionMethod"
                        value="url"
                        checked={connectionMethod === 'url'}
                        onChange={(e) => {
                          setConnectionMethod('url');
                          setConnectionTestResult(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-text-secondary">URL</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="connectionMethod"
                        value="host"
                        checked={connectionMethod === 'host'}
                        onChange={(e) => {
                          setConnectionMethod('host');
                          setConnectionTestResult(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-text-secondary">Connection Parameters</span>
                    </label>
                  </div>
                </div>

                {connectionMethod === 'url' ? (
                  <div className="space-y-2">
                    <Label htmlFor="db-url" className="text-text-secondary">Connection URL</Label>
                    <Input
                      id="db-url"
                      type="text"
                      placeholder="postgresql://user:password@host:port/database"
                      value={dbConnection.url || ''}
                      onChange={(e) => {
                        setDbConnection({ ...dbConnection, url: e.target.value });
                        setConnectionTestResult(null);
                        parseUrl(e.target.value);
                      }}
                      className="bg-surface-2 border-border text-sm font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="db-host" className="text-text-secondary text-sm">Host</Label>
                        <Input
                          id="db-host"
                          type="text"
                          placeholder="localhost"
                          value={dbConnection.host || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, host: e.target.value });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-port" className="text-text-secondary text-sm">Port</Label>
                        <Input
                          id="db-port"
                          type="number"
                          placeholder="5432"
                          value={dbConnection.port || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, port: parseInt(e.target.value) || 5432 });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="db-database" className="text-text-secondary text-sm">Database</Label>
                      <Input
                        id="db-database"
                        type="text"
                        placeholder="reports_app_db"
                        value={dbConnection.database || ''}
                        onChange={(e) => {
                          setDbConnection({ ...dbConnection, database: e.target.value });
                          setConnectionTestResult(null);
                        }}
                        className="bg-surface-2 border-border text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="db-user" className="text-text-secondary text-sm">User</Label>
                        <Input
                          id="db-user"
                          type="text"
                          placeholder="postgres"
                          value={dbConnection.user || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, user: e.target.value });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-password" className="text-text-secondary text-sm">Password</Label>
                        <Input
                          id="db-password"
                          type="password"
                          placeholder="password"
                          value={dbConnection.password || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, password: e.target.value });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="db-ssl"
                        checked={dbConnection.ssl || false}
                        onChange={(e) => {
                          setDbConnection({ ...dbConnection, ssl: e.target.checked });
                          setConnectionTestResult(null);
                        }}
                        className="rounded border-border"
                      />
                      <Label htmlFor="db-ssl" className="text-text-secondary text-sm cursor-pointer">Use SSL</Label>
                    </div>
                  </div>
                )}

                {connectionTestResult && (
                  <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                    connectionTestResult.success 
                      ? 'bg-green-500/10 border border-green-500/20' 
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    {connectionTestResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <p className={`text-sm ${
                      connectionTestResult.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {connectionTestResult.message}
                    </p>
                  </div>
                )}

                <Button 
                  type="button" 
                  onClick={testConnection} 
                  className="w-full" 
                  disabled={isTestingConnection}
                  variant="outline"
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
