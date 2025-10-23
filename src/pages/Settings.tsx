import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Database, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Settings = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [connectionMethod, setConnectionMethod] = useState<'host' | 'url'>('url');
  const [formData, setFormData] = useState({
    external_db_url: '',
    external_db_host: '',
    external_db_port: 5432,
    external_db_name: '',
    external_db_user: '',
    external_db_password: '',
    external_db_ssl: true,
  });

  // Parse URL to individual parameters
  const parseUrl = (url: string) => {
    if (!url) return;
    try {
      const urlObj = new URL(url);
      const sslmode = urlObj.searchParams.get('sslmode');
      
      setFormData(prev => ({
        ...prev,
        external_db_host: urlObj.hostname,
        external_db_port: parseInt(urlObj.port) || 5432,
        external_db_name: urlObj.pathname.slice(1),
        external_db_user: decodeURIComponent(urlObj.username),
        external_db_password: decodeURIComponent(urlObj.password),
        external_db_ssl: sslmode === 'require',
      }));
    } catch (e) {
      console.error('Invalid URL format', e);
    }
  };

  // Construct URL from individual parameters
  const constructUrl = (data: typeof formData) => {
    if (!data.external_db_host || !data.external_db_name || !data.external_db_user) return '';
    
    const password = encodeURIComponent(data.external_db_password);
    const user = encodeURIComponent(data.external_db_user);
    const sslParam = data.external_db_ssl ? '?sslmode=require' : '';
    
    return `postgresql://${user}:${password}@${data.external_db_host}:${data.external_db_port}/${data.external_db_name}${sslParam}`;
  };

  // Update URL when individual parameters change
  const updateIndividualParams = (updates: Partial<typeof formData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    
    if (connectionMethod === 'host') {
      const url = constructUrl(newData);
      if (url) {
        setFormData(prev => ({ ...prev, external_db_url: url }));
      }
    }
  };

  // Update individual params when URL changes
  const updateUrl = (url: string) => {
    setFormData(prev => ({ ...prev, external_db_url: url }));
    
    if (connectionMethod === 'url') {
      parseUrl(url);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
    if (!loading && userRole !== 'admin') {
      navigate('/app');
      toast.error('You do not have permission to access settings');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchSettings();
    }
  }, [userRole]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('external_db_url, external_db_host, external_db_port, external_db_name, external_db_user, external_db_password, external_db_ssl')
      .single();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      const hasUrl = !!data.external_db_url;
      setConnectionMethod(hasUrl ? 'url' : 'host');
      
      const loadedData = {
        external_db_url: data.external_db_url || '',
        external_db_host: data.external_db_host || '',
        external_db_port: data.external_db_port || 5432,
        external_db_name: data.external_db_name || '',
        external_db_user: data.external_db_user || '',
        external_db_password: data.external_db_password || '',
        external_db_ssl: data.external_db_ssl ?? true,
      };
      
      setFormData(loadedData);
      
      // Sync the opposite method
      if (hasUrl && data.external_db_url) {
        parseUrl(data.external_db_url);
      } else if (!hasUrl && loadedData.external_db_host) {
        const url = constructUrl(loadedData);
        if (url) {
          setFormData(prev => ({ ...prev, external_db_url: url }));
        }
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);

    const { error } = await supabase
      .from('app_settings')
      .update({
        external_db_url: connectionMethod === 'url' ? formData.external_db_url : null,
        external_db_host: connectionMethod === 'host' ? formData.external_db_host : null,
        external_db_port: connectionMethod === 'host' ? formData.external_db_port : null,
        external_db_name: connectionMethod === 'host' ? formData.external_db_name : null,
        external_db_user: connectionMethod === 'host' ? formData.external_db_user : null,
        external_db_password: connectionMethod === 'host' ? formData.external_db_password : null,
        external_db_ssl: connectionMethod === 'host' ? formData.external_db_ssl : null,
      })
      .eq('id', 1);

    if (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } else {
      toast.success('Settings saved successfully');
    }

    setSaving(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-external-db-connection', {
        body: connectionMethod === 'url' ? {
          url: formData.external_db_url,
        } : {
          host: formData.external_db_host,
          port: formData.external_db_port,
          database: formData.external_db_name,
          user: formData.external_db_user,
          password: formData.external_db_password,
          ssl: formData.external_db_ssl,
        },
      });

      if (error) throw error;

      setTestResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to test connection',
      });
      toast.error('Failed to test connection');
    }

    setTesting(false);
  };

  if (loading || userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure the external database connection for reporting
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                External Database Configuration
              </CardTitle>
              <CardDescription>
                Configure the PostgreSQL database that will be used for all report queries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Connect by:</Label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="connectionMethod"
                      value="url"
                      checked={connectionMethod === 'url'}
                      onChange={(e) => setConnectionMethod(e.target.value as 'url')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">URL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="connectionMethod"
                      value="host"
                      checked={connectionMethod === 'host'}
                      onChange={(e) => setConnectionMethod(e.target.value as 'host')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Host</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="url">Connection URL</Label>
                <Input
                  id="url"
                  placeholder="postgresql://user:password@host:port/database?sslmode=require"
                  value={formData.external_db_url}
                  onChange={(e) => updateUrl(e.target.value)}
                  readOnly={connectionMethod === 'host'}
                  className={connectionMethod === 'host' ? 'bg-muted' : ''}
                />
                <p className="text-sm text-muted-foreground">
                  {connectionMethod === 'url' 
                    ? 'Include sslmode=require in the URL for SSL connections' 
                    : 'Auto-generated from individual parameters'}
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      placeholder="e.g., localhost or db.example.com"
                      value={formData.external_db_host}
                      onChange={(e) => updateIndividualParams({ external_db_host: e.target.value })}
                      readOnly={connectionMethod === 'url'}
                      className={connectionMethod === 'url' ? 'bg-muted' : ''}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="5432"
                      value={formData.external_db_port}
                      onChange={(e) => updateIndividualParams({ external_db_port: parseInt(e.target.value) || 5432 })}
                      readOnly={connectionMethod === 'url'}
                      className={connectionMethod === 'url' ? 'bg-muted' : ''}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="database">Database Name</Label>
                    <Input
                      id="database"
                      placeholder="e.g., myapp_production"
                      value={formData.external_db_name}
                      onChange={(e) => updateIndividualParams({ external_db_name: e.target.value })}
                      readOnly={connectionMethod === 'url'}
                      className={connectionMethod === 'url' ? 'bg-muted' : ''}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="user">Username</Label>
                    <Input
                      id="user"
                      placeholder="Database user"
                      value={formData.external_db_user}
                      onChange={(e) => updateIndividualParams({ external_db_user: e.target.value })}
                      readOnly={connectionMethod === 'url'}
                      className={connectionMethod === 'url' ? 'bg-muted' : ''}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Database password"
                      value={formData.external_db_password}
                      onChange={(e) => updateIndividualParams({ external_db_password: e.target.value })}
                      readOnly={connectionMethod === 'url'}
                      className={connectionMethod === 'url' ? 'bg-muted' : ''}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="ssl"
                      checked={formData.external_db_ssl}
                      onChange={(e) => updateIndividualParams({ external_db_ssl: e.target.checked })}
                      disabled={connectionMethod === 'url'}
                      className="h-4 w-4 rounded border-input disabled:opacity-50"
                    />
                    <Label htmlFor="ssl" className="text-sm font-normal">
                      Require SSL/TLS connection
                    </Label>
                  </div>
                </div>
              </div>

              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || (connectionMethod === 'url' ? !formData.external_db_url : (!formData.external_db_host || !formData.external_db_name || !formData.external_db_user))}
                  variant="outline"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || (connectionMethod === 'url' ? !formData.external_db_url : (!formData.external_db_host || !formData.external_db_name || !formData.external_db_user))}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
