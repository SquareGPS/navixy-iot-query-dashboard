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
  
  const [formData, setFormData] = useState({
    external_db_host: '',
    external_db_port: 5432,
    external_db_name: '',
    external_db_user: '',
    external_db_password: '',
  });

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
      .select('external_db_host, external_db_port, external_db_name, external_db_user, external_db_password')
      .single();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      setFormData({
        external_db_host: data.external_db_host || '',
        external_db_port: data.external_db_port || 5432,
        external_db_name: data.external_db_name || '',
        external_db_user: data.external_db_user || '',
        external_db_password: data.external_db_password || '',
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);

    const { error } = await supabase
      .from('app_settings')
      .update({
        external_db_host: formData.external_db_host,
        external_db_port: formData.external_db_port,
        external_db_name: formData.external_db_name,
        external_db_user: formData.external_db_user,
        external_db_password: formData.external_db_password,
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
        body: {
          host: formData.external_db_host,
          port: formData.external_db_port,
          database: formData.external_db_name,
          user: formData.external_db_user,
          password: formData.external_db_password,
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
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    placeholder="e.g., localhost or db.example.com"
                    value={formData.external_db_host}
                    onChange={(e) => setFormData({ ...formData, external_db_host: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="5432"
                    value={formData.external_db_port}
                    onChange={(e) => setFormData({ ...formData, external_db_port: parseInt(e.target.value) || 5432 })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="database">Database Name</Label>
                  <Input
                    id="database"
                    placeholder="e.g., myapp_production"
                    value={formData.external_db_name}
                    onChange={(e) => setFormData({ ...formData, external_db_name: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="user">Username</Label>
                  <Input
                    id="user"
                    placeholder="Database user"
                    value={formData.external_db_user}
                    onChange={(e) => setFormData({ ...formData, external_db_user: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Database password"
                    value={formData.external_db_password}
                    onChange={(e) => setFormData({ ...formData, external_db_password: e.target.value })}
                  />
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
                  disabled={testing || !formData.external_db_host || !formData.external_db_name || !formData.external_db_user}
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
                  disabled={saving || !formData.external_db_host || !formData.external_db_name || !formData.external_db_user}
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
