import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { Loader2, Database, CheckCircle2, XCircle, Settings as SettingsIcon, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Settings = () => {
  const { user, loading } = useAuth();
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
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Check if current form data differs from saved settings
  const checkForChanges = () => {
    if (!currentSettings) return false;
    
    const currentData = {
      external_db_url: formData.external_db_url,
      external_db_host: formData.external_db_host,
      external_db_port: formData.external_db_port,
      external_db_name: formData.external_db_name,
      external_db_user: formData.external_db_user,
      external_db_password: formData.external_db_password,
      external_db_ssl: formData.external_db_ssl,
    };

    const savedData = {
      external_db_url: currentSettings.external_db_url || '',
      external_db_host: currentSettings.external_db_host || '',
      external_db_port: currentSettings.external_db_port || 5432,
      external_db_name: currentSettings.external_db_name || '',
      external_db_user: currentSettings.external_db_user || '',
      external_db_password: currentSettings.external_db_password || '',
      external_db_ssl: currentSettings.external_db_ssl ?? true,
    };

    return JSON.stringify(currentData) !== JSON.stringify(savedData);
  };

  // Update change detection when form data changes
  useEffect(() => {
    setHasUnsavedChanges(checkForChanges());
  }, [formData, currentSettings]);

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
    if (!loading && user?.role !== 'admin') {
      navigate('/app');
      toast.error('You do not have permission to access settings');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSettings();
    }
  }, [user?.role]);

  const fetchSettings = async () => {
    try {
      const response = await apiService.getAppSettings();
      
      if (response.error) {
        console.error('Error fetching settings:', response.error);
        toast.error('Failed to load settings');
        return;
      }

      if (response.data && response.data.settings) {
        const data = response.data.settings;
        setCurrentSettings(data);
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
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);

    try {
      const settingsData = {
        organization_name: currentSettings?.organization_name || 'Reports MVP',
        timezone: currentSettings?.timezone || 'UTC',
        external_db_url: connectionMethod === 'url' ? formData.external_db_url : null,
        external_db_host: connectionMethod === 'host' ? formData.external_db_host : null,
        external_db_port: connectionMethod === 'host' ? formData.external_db_port : null,
        external_db_name: connectionMethod === 'host' ? formData.external_db_name : null,
        external_db_user: connectionMethod === 'host' ? formData.external_db_user : null,
        external_db_password: connectionMethod === 'host' ? formData.external_db_password : null,
        external_db_ssl: connectionMethod === 'host' ? formData.external_db_ssl : null,
      };

      const response = await apiService.updateAppSettings(settingsData);

      if (response.error) {
        console.error('Error saving settings:', response.error);
        toast.error('Failed to save settings');
      } else {
        toast.success('Settings saved successfully');
        setHasUnsavedChanges(false);
        // Refresh settings to update currentSettings
        await fetchSettings();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }

    setSaving(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const testData = connectionMethod === 'url' ? {
        external_db_url: formData.external_db_url,
      } : {
        external_db_host: formData.external_db_host,
        external_db_port: formData.external_db_port,
        external_db_name: formData.external_db_name,
        external_db_user: formData.external_db_user,
        external_db_password: formData.external_db_password,
        external_db_ssl: formData.external_db_ssl,
      };

      const response = await apiService.testDatabaseConnection(testData);

      if (response.error) {
        setTestResult({
          success: false,
          message: response.error.message || 'Failed to test connection',
        });
        toast.error(response.error.message || 'Failed to test connection');
      } else {
        setTestResult({
          success: true,
          message: response.data.message || 'Connection successful',
        });
        toast.success(response.data.message || 'Connection successful');
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

  if (loading || user?.role !== 'admin') {
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
              Configure application settings and preferences
            </p>
          </div>

          <Tabs defaultValue="database" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Preferences
              </TabsTrigger>
            </TabsList>

            <TabsContent value="database" className="mt-6">
              <Card>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Navixy DataHub Configuration
                    </h2>
                    <p className="text-sm text-text-muted">
                      Connect to your private telematics data lakehouse (PostgreSQL-compatible)
                    </p>
                  </div>

                  {/* Connection Method Radio Buttons */}
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

                  {/* Connection URL Section */}
                  {connectionMethod === 'url' && (
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-sm font-medium">Connection URL</Label>
                  <Input
                    id="url"
                    placeholder="postgresql://user:password@host:port/database?sslmode=require"
                    value={formData.external_db_url}
                    onChange={(e) => updateUrl(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include sslmode=require in the URL for SSL connections
                  </p>
                  </div>
                  )}

                  {/* Individual Parameters Section */}
                  {connectionMethod === 'host' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="host" className="text-sm font-medium">Host</Label>
                          <Input
                            id="host"
                            placeholder="e.g., localhost or db.example.com"
                            value={formData.external_db_host}
                            onChange={(e) => updateIndividualParams({ external_db_host: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="port" className="text-sm font-medium">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            placeholder="5432"
                            value={formData.external_db_port}
                            onChange={(e) => updateIndividualParams({ external_db_port: parseInt(e.target.value) || 5432 })}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="database" className="text-sm font-medium">Database Name</Label>
                        <Input
                          id="database"
                          placeholder="e.g., myapp_production"
                          value={formData.external_db_name}
                          onChange={(e) => updateIndividualParams({ external_db_name: e.target.value })}
                          className="text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="user" className="text-sm font-medium">Username</Label>
                          <Input
                            id="user"
                            placeholder="Database user"
                            value={formData.external_db_user}
                            onChange={(e) => updateIndividualParams({ external_db_user: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Database password"
                            value={formData.external_db_password}
                            onChange={(e) => updateIndividualParams({ external_db_password: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="ssl"
                          checked={formData.external_db_ssl}
                          onChange={(e) => updateIndividualParams({ external_db_ssl: e.target.checked })}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="ssl" className="text-sm font-normal">
                          Require SSL/TLS connection
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Auto-populated fields display when URL is selected */}
                  {connectionMethod === 'url' && (formData.external_db_host || formData.external_db_name) && (
                    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                        <span className="text-xs font-medium text-muted-foreground">Auto-populated from URL</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Host:</span>
                          <span className="ml-2 font-mono">{formData.external_db_host || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Port:</span>
                          <span className="ml-2 font-mono">{formData.external_db_port || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Database:</span>
                          <span className="ml-2 font-mono">{formData.external_db_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">User:</span>
                          <span className="ml-2 font-mono">{formData.external_db_user || '—'}</span>
                        </div>
                      </div>
                    </div>
                  )}

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

                  <div className="flex items-center justify-between pt-6 border-t">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">
                        {connectionMethod === 'url' 
                          ? 'Enter a complete PostgreSQL connection URL' 
                          : 'Fill in the individual connection parameters'}
                      </div>
                      {hasUnsavedChanges && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                          You have unsaved changes
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleTestConnection}
                        disabled={testing || (connectionMethod === 'url' ? !formData.external_db_url : (!formData.external_db_host || !formData.external_db_name || !formData.external_db_user))}
                        variant="outline"
                        size="sm"
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
                        size="sm"
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
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="mt-6">
              <Card>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Preferences
                    </h2>
                    <p className="text-sm text-text-muted">
                      Configure your personal preferences and display settings
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
                      <Input
                        id="timezone"
                        placeholder="UTC"
                        value="UTC"
                        disabled
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Timezone configuration coming soon
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateFormat" className="text-sm font-medium">Date Format</Label>
                      <Input
                        id="dateFormat"
                        placeholder="YYYY-MM-DD"
                        value="YYYY-MM-DD"
                        disabled
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Date format preferences coming soon
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t">
                    <div className="text-sm text-muted-foreground">
                      More preference options will be available soon
                    </div>
                    <Button disabled size="sm">
                      Save Preferences
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
