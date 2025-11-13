import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [email, setEmail] = useState(import.meta.env.VITE_DEFAULT_USER_EMAIL || 'admin@example.com');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  
  // Metabase DB connection
  const [metabaseConnectionMethod, setMetabaseConnectionMethod] = useState<'url' | 'host'>('url');
  const [isTestingMetabase, setIsTestingMetabase] = useState(false);
  const [metabaseTestResult, setMetabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [metabaseConnection, setMetabaseConnection] = useState<DatabaseConnection>({
    connectionType: 'url',
    url: import.meta.env.VITE_DEFAULT_METABASE_DB_URL || 'postgresql://reports_user:postgres@postgres:5432/reports_app_db',
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: '',
    ssl: false,
  });

  // IoT DB connection
  const [iotConnectionMethod, setIotConnectionMethod] = useState<'url' | 'host'>('url');
  const [isTestingIot, setIsTestingIot] = useState(false);
  const [iotTestResult, setIotTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [iotConnection, setIotConnection] = useState<DatabaseConnection>({
    connectionType: 'url',
    url: import.meta.env.VITE_DEFAULT_IOT_DB_URL || 'postgresql://client_398286_user:npg_6flcV8DXjnge@ep-spring-morning-agp9wdsq.c-2.eu-central-1.aws.neon.tech:5432/client_398286?sslmode=require',
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: '',
    ssl: false,
  });

  const { signInPasswordless, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  // Parse URL to individual parameters
  const parseUrl = (url: string, setter: (prev: DatabaseConnection) => DatabaseConnection) => {
    if (!url) return;
    try {
      const urlObj = new URL(url);
      const sslmode = urlObj.searchParams.get('sslmode');
      
      setter(prev => ({
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

  const testMetabaseConnection = async () => {
    setIsTestingMetabase(true);
    setMetabaseTestResult(null);

    let testSettings: any;
    
    if (metabaseConnectionMethod === 'url') {
      if (!metabaseConnection.url || !metabaseConnection.url.trim()) {
        toast.error('Please provide a Metabase database connection URL');
        setIsTestingMetabase(false);
        return;
      }
      testSettings = {
        db_url: metabaseConnection.url.trim(),
      };
    } else {
      if (!metabaseConnection.host || !metabaseConnection.database || !metabaseConnection.user) {
        toast.error('Please provide host, database, and user for Metabase database connection');
        setIsTestingMetabase(false);
        return;
      }
      testSettings = {
        db_host: metabaseConnection.host.trim(),
        db_port: metabaseConnection.port || 5432,
        db_name: metabaseConnection.database.trim(),
        db_user: metabaseConnection.user.trim(),
        db_password: metabaseConnection.password || '',
        db_ssl: metabaseConnection.ssl || false,
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/test-metabase-connection`, {
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
        setMetabaseTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setMetabaseTestResult({ success: true, message: data.message || 'Metabase database connection successful!' });
        toast.success('Metabase database connection successful!');
      } else {
        const errorMessage = data.error?.message || data.message || data.error || 'Connection failed';
        setMetabaseTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setMetabaseTestResult({ success: false, message: `Network error: ${errorMessage}` });
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setIsTestingMetabase(false);
    }
  };

  const testIotConnection = async () => {
    setIsTestingIot(true);
    setIotTestResult(null);

    let testSettings: any;
    
    if (iotConnectionMethod === 'url') {
      if (!iotConnection.url || !iotConnection.url.trim()) {
        toast.error('Please provide an IoT database connection URL');
        setIsTestingIot(false);
        return;
      }
      testSettings = {
        db_url: iotConnection.url.trim(),
      };
    } else {
      if (!iotConnection.host || !iotConnection.database || !iotConnection.user) {
        toast.error('Please provide host, database, and user for IoT database connection');
        setIsTestingIot(false);
        return;
      }
      testSettings = {
        db_host: iotConnection.host.trim(),
        db_port: iotConnection.port || 5432,
        db_name: iotConnection.database.trim(),
        db_user: iotConnection.user.trim(),
        db_password: iotConnection.password || '',
        db_ssl: iotConnection.ssl || false,
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
        setIotTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setIotTestResult({ success: true, message: data.message || 'IoT database connection successful!' });
        toast.success('IoT database connection successful!');
      } else {
        const errorMessage = data.error?.message || data.message || data.error || 'Connection failed';
        setIotTestResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setIotTestResult({ success: false, message: `Network error: ${errorMessage}` });
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setIsTestingIot(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Get URLs from connections
    const metabaseUrl = metabaseConnectionMethod === 'url' 
      ? metabaseConnection.url || ''
      : constructUrl(metabaseConnection);
    
    const iotUrl = iotConnectionMethod === 'url'
      ? iotConnection.url || ''
      : constructUrl(iotConnection);

    if (!metabaseUrl || !iotUrl) {
      toast.error('Please provide both Metabase and IoT database connection URLs');
      setIsLoading(false);
      return;
    }
    
    const { error } = await signInPasswordless(email, role, metabaseUrl, iotUrl);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-2xl">
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

            {/* Database Connections Tabs */}
            <Tabs defaultValue="metabase" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="metabase">Metabase Database</TabsTrigger>
                <TabsTrigger value="iot">IoT Database</TabsTrigger>
              </TabsList>

              <TabsContent value="metabase" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-text-secondary font-semibold flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Connection Method
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="metabaseConnectionMethod"
                        value="url"
                        checked={metabaseConnectionMethod === 'url'}
                        onChange={(e) => {
                          setMetabaseConnectionMethod('url');
                          setMetabaseTestResult(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-text-secondary">URL</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="metabaseConnectionMethod"
                        value="host"
                        checked={metabaseConnectionMethod === 'host'}
                        onChange={(e) => {
                          setMetabaseConnectionMethod('host');
                          setMetabaseTestResult(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-text-secondary">Connection Parameters</span>
                    </label>
                  </div>
                </div>

                {metabaseConnectionMethod === 'url' ? (
                  <div className="space-y-2">
                    <Label htmlFor="metabase-url" className="text-text-secondary">Connection URL</Label>
                    <Input
                      id="metabase-url"
                      type="text"
                      placeholder="postgresql://user:password@host:port/database"
                      value={metabaseConnection.url || ''}
                      onChange={(e) => {
                        setMetabaseConnection({ ...metabaseConnection, url: e.target.value });
                        setMetabaseTestResult(null);
                        parseUrl(e.target.value, (prev) => ({ ...metabaseConnection, ...prev }));
                      }}
                      className="bg-surface-2 border-border text-sm font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="metabase-host" className="text-text-secondary text-sm">Host</Label>
                        <Input
                          id="metabase-host"
                          type="text"
                          placeholder="localhost"
                          value={metabaseConnection.host || ''}
                          onChange={(e) => {
                            setMetabaseConnection({ ...metabaseConnection, host: e.target.value });
                            setMetabaseTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metabase-port" className="text-text-secondary text-sm">Port</Label>
                        <Input
                          id="metabase-port"
                          type="number"
                          placeholder="5432"
                          value={metabaseConnection.port || ''}
                          onChange={(e) => {
                            setMetabaseConnection({ ...metabaseConnection, port: parseInt(e.target.value) || 5432 });
                            setMetabaseTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metabase-database" className="text-text-secondary text-sm">Database</Label>
                      <Input
                        id="metabase-database"
                        type="text"
                        placeholder="reports_app_db"
                        value={metabaseConnection.database || ''}
                        onChange={(e) => {
                          setMetabaseConnection({ ...metabaseConnection, database: e.target.value });
                          setMetabaseTestResult(null);
                        }}
                        className="bg-surface-2 border-border text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="metabase-user" className="text-text-secondary text-sm">User</Label>
                        <Input
                          id="metabase-user"
                          type="text"
                          placeholder="postgres"
                          value={metabaseConnection.user || ''}
                          onChange={(e) => {
                            setMetabaseConnection({ ...metabaseConnection, user: e.target.value });
                            setMetabaseTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metabase-password" className="text-text-secondary text-sm">Password</Label>
                        <Input
                          id="metabase-password"
                          type="password"
                          placeholder="password"
                          value={metabaseConnection.password || ''}
                          onChange={(e) => {
                            setMetabaseConnection({ ...metabaseConnection, password: e.target.value });
                            setMetabaseTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="metabase-ssl"
                        checked={metabaseConnection.ssl || false}
                        onChange={(e) => {
                          setMetabaseConnection({ ...metabaseConnection, ssl: e.target.checked });
                          setMetabaseTestResult(null);
                        }}
                        className="rounded border-border"
                      />
                      <Label htmlFor="metabase-ssl" className="text-text-secondary text-sm cursor-pointer">Use SSL</Label>
                    </div>
                  </div>
                )}

                {metabaseTestResult && (
                  <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                    metabaseTestResult.success 
                      ? 'bg-green-500/10 border border-green-500/20' 
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    {metabaseTestResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <p className={`text-sm ${
                      metabaseTestResult.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metabaseTestResult.message}
                    </p>
                  </div>
                )}

                <Button 
                  type="button" 
                  onClick={testMetabaseConnection} 
                  className="w-full" 
                  disabled={isTestingMetabase}
                  variant="outline"
                >
                  {isTestingMetabase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Test Metabase Connection
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="iot" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-text-secondary font-semibold flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Connection Method
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="iotConnectionMethod"
                        value="url"
                        checked={iotConnectionMethod === 'url'}
                        onChange={(e) => {
                          setIotConnectionMethod('url');
                          setIotTestResult(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-text-secondary">URL</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="iotConnectionMethod"
                        value="host"
                        checked={iotConnectionMethod === 'host'}
                        onChange={(e) => {
                          setIotConnectionMethod('host');
                          setIotTestResult(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-text-secondary">Connection Parameters</span>
                    </label>
                  </div>
                </div>

                {iotConnectionMethod === 'url' ? (
                  <div className="space-y-2">
                    <Label htmlFor="iot-url" className="text-text-secondary">Connection URL</Label>
                    <Input
                      id="iot-url"
                      type="text"
                      placeholder="postgresql://user:password@host:port/database"
                      value={iotConnection.url || ''}
                      onChange={(e) => {
                        setIotConnection({ ...iotConnection, url: e.target.value });
                        setIotTestResult(null);
                        parseUrl(e.target.value, (prev) => ({ ...iotConnection, ...prev }));
                      }}
                      className="bg-surface-2 border-border text-sm font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="iot-host" className="text-text-secondary text-sm">Host</Label>
                        <Input
                          id="iot-host"
                          type="text"
                          placeholder="localhost"
                          value={iotConnection.host || ''}
                          onChange={(e) => {
                            setIotConnection({ ...iotConnection, host: e.target.value });
                            setIotTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="iot-port" className="text-text-secondary text-sm">Port</Label>
                        <Input
                          id="iot-port"
                          type="number"
                          placeholder="5432"
                          value={iotConnection.port || ''}
                          onChange={(e) => {
                            setIotConnection({ ...iotConnection, port: parseInt(e.target.value) || 5432 });
                            setIotTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iot-database" className="text-text-secondary text-sm">Database</Label>
                      <Input
                        id="iot-database"
                        type="text"
                        placeholder="client_398286"
                        value={iotConnection.database || ''}
                        onChange={(e) => {
                          setIotConnection({ ...iotConnection, database: e.target.value });
                          setIotTestResult(null);
                        }}
                        className="bg-surface-2 border-border text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="iot-user" className="text-text-secondary text-sm">User</Label>
                        <Input
                          id="iot-user"
                          type="text"
                          placeholder="client_398286_user"
                          value={iotConnection.user || ''}
                          onChange={(e) => {
                            setIotConnection({ ...iotConnection, user: e.target.value });
                            setIotTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="iot-password" className="text-text-secondary text-sm">Password</Label>
                        <Input
                          id="iot-password"
                          type="password"
                          placeholder="password"
                          value={iotConnection.password || ''}
                          onChange={(e) => {
                            setIotConnection({ ...iotConnection, password: e.target.value });
                            setIotTestResult(null);
                          }}
                          className="bg-surface-2 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="iot-ssl"
                        checked={iotConnection.ssl || false}
                        onChange={(e) => {
                          setIotConnection({ ...iotConnection, ssl: e.target.checked });
                          setIotTestResult(null);
                        }}
                        className="rounded border-border"
                      />
                      <Label htmlFor="iot-ssl" className="text-text-secondary text-sm cursor-pointer">Use SSL</Label>
                    </div>
                  </div>
                )}

                {iotTestResult && (
                  <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                    iotTestResult.success 
                      ? 'bg-green-500/10 border border-green-500/20' 
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    {iotTestResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <p className={`text-sm ${
                      iotTestResult.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {iotTestResult.message}
                    </p>
                  </div>
                )}

                <Button 
                  type="button" 
                  onClick={testIotConnection} 
                  className="w-full" 
                  disabled={isTestingIot}
                  variant="outline"
                >
                  {isTestingIot ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Test IoT Connection
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>

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
