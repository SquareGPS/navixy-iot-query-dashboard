import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { BarChart3, Database, CheckCircle2, XCircle } from 'lucide-react';

interface DatabaseConnection {
  connectionType: 'url' | 'direct';
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? '' : 'http://ec2-44-247-98-167.us-west-2.compute.amazonaws.com:3001');

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connectionType, setConnectionType] = useState<'url' | 'direct'>('url');
  const [dbConnection, setDbConnection] = useState<DatabaseConnection>({
    connectionType: 'url',
    url: '',
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: '',
    ssl: false,
  });
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // Pre-populate database connection in dev mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      const devDbUrl = import.meta.env.VITE_DEV_DATABASE_URL || 'postgresql://danilnezhdanov@127.0.0.1:5432/reports_app_db';
      setDbConnection({
        connectionType: 'url',
        url: devDbUrl,
        host: '127.0.0.1',
        port: 5432,
        database: 'reports_app_db',
        user: 'danilnezhdanov',
        password: '',
        ssl: false,
      });
    }
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);

    // Validate database connection
    if (connectionType === 'url') {
      if (!dbConnection.url || !dbConnection.url.trim()) {
        toast.error('Please provide a database connection URL');
        setIsTestingConnection(false);
        return;
      }
    } else {
      if (!dbConnection.host || !dbConnection.database || !dbConnection.user) {
        toast.error('Please provide host, database, and user for database connection');
        setIsTestingConnection(false);
        return;
      }
    }

    // Build database connection object
    const dbConfig: DatabaseConnection = {
      connectionType,
      ...(connectionType === 'url' 
        ? { url: dbConnection.url?.trim() }
        : {
            host: dbConnection.host?.trim(),
            port: dbConnection.port || 5432,
            database: dbConnection.database?.trim(),
            user: dbConnection.user?.trim(),
            password: dbConnection.password || '',
            ssl: dbConnection.ssl || false,
          }
      ),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/test-metadata-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dbConnection: dbConfig }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionTestResult({ success: true, message: data.message || 'Connection successful!' });
        toast.success('Database connection successful!');
      } else {
        // Extract error message from response
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
    
    // Validate database connection
    if (connectionType === 'url') {
      if (!dbConnection.url || !dbConnection.url.trim()) {
        toast.error('Please provide a database connection URL');
        setIsLoading(false);
        return;
      }
    } else {
      if (!dbConnection.host || !dbConnection.database || !dbConnection.user) {
        toast.error('Please provide host, database, and user for database connection');
        setIsLoading(false);
        return;
      }
    }
    
    // Build database connection object
    const dbConfig: DatabaseConnection = {
      connectionType,
      ...(connectionType === 'url' 
        ? { url: dbConnection.url?.trim() }
        : {
            host: dbConnection.host?.trim(),
            port: dbConnection.port || 5432,
            database: dbConnection.database?.trim(),
            user: dbConnection.user?.trim(),
            password: dbConnection.password || '',
            ssl: dbConnection.ssl || false,
          }
      ),
    };
    
    const { error } = await signIn(email, password, dbConfig);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md">
        <div className="space-y-6">
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
          
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-surface-3">
              <TabsTrigger value="signin" className="data-[state=active]:bg-surface-2">Sign In</TabsTrigger>
              <TabsTrigger value="database" className="data-[state=active]:bg-surface-2">
                <Database className="h-4 w-4 mr-2" />
                Metabase DB
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
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
            </TabsContent>
            
            <TabsContent value="database" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-text-secondary font-semibold">Metadata Database Connection</Label>
                  <p className="text-sm text-text-muted">Configure your organization's metadata database connection</p>
                </div>
                
                <RadioGroup value={connectionType} onValueChange={(value) => {
                  setConnectionType(value as 'url' | 'direct');
                  setConnectionTestResult(null);
                }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="url" id="connection-url" />
                    <Label htmlFor="connection-url" className="cursor-pointer">Connection URL</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direct" id="connection-direct" />
                    <Label htmlFor="connection-direct" className="cursor-pointer">Direct Settings</Label>
                  </div>
                </RadioGroup>

                {connectionType === 'url' ? (
                  <div className="space-y-2">
                    <Label htmlFor="db-url" className="text-text-secondary">Database URL</Label>
                    <Input
                      id="db-url"
                      type="text"
                      placeholder="postgresql://user:password@host:port/database"
                      value={dbConnection.url || ''}
                      onChange={(e) => {
                        setDbConnection({ ...dbConnection, url: e.target.value });
                        setConnectionTestResult(null);
                      }}
                      className="bg-surface-2 border-border"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="db-host" className="text-text-secondary">Host</Label>
                        <Input
                          id="db-host"
                          type="text"
                          placeholder="localhost"
                          value={dbConnection.host || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, host: e.target.value });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-port" className="text-text-secondary">Port</Label>
                        <Input
                          id="db-port"
                          type="number"
                          placeholder="5432"
                          value={dbConnection.port || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, port: parseInt(e.target.value) || 5432 });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="db-database" className="text-text-secondary">Database</Label>
                      <Input
                        id="db-database"
                        type="text"
                        placeholder="reports_app_db"
                        value={dbConnection.database || ''}
                        onChange={(e) => {
                          setDbConnection({ ...dbConnection, database: e.target.value });
                          setConnectionTestResult(null);
                        }}
                        className="bg-surface-2 border-border"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="db-user" className="text-text-secondary">User</Label>
                        <Input
                          id="db-user"
                          type="text"
                          placeholder="postgres"
                          value={dbConnection.user || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, user: e.target.value });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-password" className="text-text-secondary">Password</Label>
                        <Input
                          id="db-password"
                          type="password"
                          placeholder="password"
                          value={dbConnection.password || ''}
                          onChange={(e) => {
                            setDbConnection({ ...dbConnection, password: e.target.value });
                            setConnectionTestResult(null);
                          }}
                          className="bg-surface-2 border-border"
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
                      <Label htmlFor="db-ssl" className="text-text-secondary cursor-pointer">Use SSL</Label>
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
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
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
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
};

export default Login;
