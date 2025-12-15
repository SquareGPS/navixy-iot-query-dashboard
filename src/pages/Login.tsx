import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BarChart3, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const Login = () => {
  const [email, setEmail] = useState(import.meta.env.VITE_DEFAULT_USER_EMAIL || '');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  
  // IoT DB connection
  const [connectionMethod, setConnectionMethod] = useState<'url' | 'host'>('url');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connection, setConnection] = useState<DatabaseConnection>({
    connectionType: 'url',
    url: import.meta.env.VITE_DEFAULT_IOT_DB_URL || '',
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
      
      setConnection(prev => ({
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
    setTestResult(null);

    let testSettings: any;
    
    if (connectionMethod === 'url') {
      if (!connection.url || !connection.url.trim()) {
        toast.error('Please provide a database connection URL');
        setIsTestingConnection(false);
        return;
      }
      testSettings = {
        db_url: connection.url.trim(),
      };
    } else {
      if (!connection.host || !connection.database || !connection.user) {
        toast.error('Please provide host, database, and user for database connection');
        setIsTestingConnection(false);
        return;
      }
      testSettings = {
        db_host: connection.host.trim(),
        db_port: connection.port || 5432,
        db_name: connection.database.trim(),
        db_user: connection.user.trim(),
        db_password: connection.password || '',
        db_ssl: connection.ssl || false,
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/test-iot-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testSettings),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Connection failed';
        try {
          const data = JSON.parse(text);
          errorMessage = data.error?.message || data.message || errorMessage;
        } catch {
          errorMessage = text || `HTTP ${response.status}`;
        }
        setTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: data.message || 'Database connection successful!' });
        toast.success('Database connection successful!');
      } else {
        const errorMessage = data.error?.message || data.message || data.error || 'Connection failed';
        setTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setTestResult({ success: false, message: `Network error: ${errorMessage}` });
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Get URL from connection
    const iotUrl = connectionMethod === 'url'
      ? connection.url || ''
      : constructUrl(connection);

    if (!iotUrl) {
      toast.error('Please provide a database connection URL');
      setIsLoading(false);
      return;
    }
    
    const { error } = await signIn(email, role, iotUrl);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-lg">
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
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-surface-3 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-text-secondary">Role</Label>
              <Select value={role} onValueChange={(value: 'admin' | 'editor' | 'viewer') => setRole(value)}>
                <SelectTrigger className="bg-surface-3 border-border">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Database Connection */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-text-secondary font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database Connection
                </Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="connectionMethod"
                      value="url"
                      checked={connectionMethod === 'url'}
                      onChange={() => {
                        setConnectionMethod('url');
                        setTestResult(null);
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
                      onChange={() => {
                        setConnectionMethod('host');
                        setTestResult(null);
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
                    value={connection.url || ''}
                    onChange={(e) => {
                      setConnection({ ...connection, url: e.target.value });
                      setTestResult(null);
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
                        value={connection.host || ''}
                        onChange={(e) => {
                          setConnection({ ...connection, host: e.target.value });
                          setTestResult(null);
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
                        value={connection.port || ''}
                        onChange={(e) => {
                          setConnection({ ...connection, port: parseInt(e.target.value) || 5432 });
                          setTestResult(null);
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
                      placeholder="client_398286"
                      value={connection.database || ''}
                      onChange={(e) => {
                        setConnection({ ...connection, database: e.target.value });
                        setTestResult(null);
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
                        placeholder="client_398286_user"
                        value={connection.user || ''}
                        onChange={(e) => {
                          setConnection({ ...connection, user: e.target.value });
                          setTestResult(null);
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
                        value={connection.password || ''}
                        onChange={(e) => {
                          setConnection({ ...connection, password: e.target.value });
                          setTestResult(null);
                        }}
                        className="bg-surface-2 border-border text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="db-ssl"
                      checked={connection.ssl || false}
                      onChange={(e) => {
                        setConnection({ ...connection, ssl: e.target.checked });
                        setTestResult(null);
                      }}
                      className="rounded border-border"
                    />
                    <Label htmlFor="db-ssl" className="text-text-secondary text-sm cursor-pointer">Use SSL</Label>
                  </div>
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                  testResult.success 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
              )}

              <Button 
                type="button" 
                onClick={testConnection} 
                className="w-full" 
                disabled={isTestingConnection}
                variant="secondary"
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default Login;
