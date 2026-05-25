import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimezoneCombobox } from '@/components/ui/timezone-combobox';
import { toast } from 'sonner';
import { apiService, type DateFormat, type TimeFormat } from '@/services/api';
import { detectInitialTimeFormat } from '@/utils/datetime';
import { useDatetimePrefs } from '@/contexts/DatetimePrefsContext';
import { Loader2, Settings as SettingsIcon, User, Plus, Trash2, Edit2, Save, X, Variable, FlaskConical, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const Settings = () => {
  const { user, loading, demoMode, reseedDemoData } = useAuth();
  const { setPrefs: setDatetimePrefs } = useDatetimePrefs();
  const navigate = useNavigate();
  
  // Global Variables state
  const [globalVariables, setGlobalVariables] = useState<any[]>([]);
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, { label: string; description: string; value: string }>>({});
  const [newVariable, setNewVariable] = useState({ label: '', description: '', value: '' });
  const [showNewVariable, setShowNewVariable] = useState(false);

  // User Preferences state
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [userDateFormat, setUserDateFormat] = useState<DateFormat>('default');
  // Seed from the browser's locale so first-time users see their conventional
  // clock pre-selected. The server value (loaded by fetchUserPreferences)
  // overrides this on mount when the user has saved a preference.
  const [userTimeFormat, setUserTimeFormat] = useState<TimeFormat>(() =>
    detectInitialTimeFormat(),
  );
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [browserTimezone] = useState<string | null>(() => {
    // Detect browser timezone immediately on component mount
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return null;
    }
  });
  
  // Demo mode state
  const [resettingDemo, setResettingDemo] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchGlobalVariables();
    }
    // Fetch user preferences for all authenticated users
    if (user) {
      fetchUserPreferences();
    }
  }, [user?.role, user]);

  // Global Variables functions
  const fetchGlobalVariables = async () => {
    setLoadingVariables(true);
    try {
      const response = await apiService.getGlobalVariables();
      if (response.error) {
        console.error('Error fetching global variables:', response.error);
        toast.error('Failed to load global variables');
      } else {
        setGlobalVariables(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching global variables:', error);
      toast.error('Failed to load global variables');
    } finally {
      setLoadingVariables(false);
    }
  };

  const handleStartEdit = (variable: any) => {
    setEditingId(variable.id);
    setEditingValues({
      [variable.id]: {
        label: variable.label,
        description: variable.description || '',
        value: variable.value || '',
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleSaveEdit = async (id: string) => {
    const editData = editingValues[id];
    if (!editData) return;

    try {
      const variable = globalVariables.find(v => v.id === id);
      if (!variable) return;

      const updateData: any = {};
      if (editData.label !== variable.label) updateData.label = editData.label;
      if (editData.description !== (variable.description || '')) updateData.description = editData.description;
      if (editData.value !== (variable.value || '')) updateData.value = editData.value;

      if (Object.keys(updateData).length === 0) {
        handleCancelEdit();
        return;
      }

      const response = await apiService.updateGlobalVariable(id, updateData);
      if (response.error) {
        toast.error(response.error.message || 'Failed to update variable');
      } else {
        toast.success('Variable updated successfully');
        await fetchGlobalVariables();
        handleCancelEdit();
      }
    } catch (error: any) {
      console.error('Error updating variable:', error);
      toast.error(error.message || 'Failed to update variable');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this variable?')) return;

    try {
      const response = await apiService.deleteGlobalVariable(id);
      if (response.error) {
        toast.error(response.error.message || 'Failed to delete variable');
      } else {
        toast.success('Variable deleted successfully');
        await fetchGlobalVariables();
      }
    } catch (error: any) {
      console.error('Error deleting variable:', error);
      toast.error(error.message || 'Failed to delete variable');
    }
  };

  const handleCreateVariable = async () => {
    if (!newVariable.label.trim()) {
      toast.error('Label is required');
      return;
    }

    try {
      const response = await apiService.createGlobalVariable({
        label: newVariable.label.trim(),
        description: newVariable.description.trim() || undefined,
        value: newVariable.value.trim() || undefined,
      });

      if (response.error) {
        toast.error(response.error.message || 'Failed to create variable');
      } else {
        toast.success('Variable created successfully');
        setNewVariable({ label: '', description: '', value: '' });
        setShowNewVariable(false);
        await fetchGlobalVariables();
      }
    } catch (error: any) {
      console.error('Error creating variable:', error);
      toast.error(error.message || 'Failed to create variable');
    }
  };

  // User Preferences functions
  const fetchUserPreferences = async () => {
    setLoadingPreferences(true);
    try {
      const response = await apiService.getUserPreferences();
      if (response.error) {
        console.error('Error fetching user preferences:', response.error);
        // Use browser timezone as default if available, otherwise UTC
        if (browserTimezone) {
          setUserTimezone(browserTimezone);
        }
      } else {
        const savedTimezone = response.data?.timezone;
        if (savedTimezone) {
          setUserTimezone(savedTimezone);
        } else {
          // No saved preference - use browser timezone as default
          setUserTimezone(browserTimezone || 'UTC');
        }
        if (response.data?.dateFormat) {
          setUserDateFormat(response.data.dateFormat);
        }
        if (response.data?.timeFormat) {
          setUserTimeFormat(response.data.timeFormat);
        }
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      // Use browser timezone as default if available, otherwise UTC
      if (browserTimezone) {
        setUserTimezone(browserTimezone);
      }
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      const response = await apiService.updateUserPreferences({
        timezone: userTimezone,
        dateFormat: userDateFormat,
        timeFormat: userTimeFormat,
      });
      if (response.error) {
        toast.error(response.error.message || 'Failed to save preferences');
      } else {
        // PUT returns the saved preferences via RETURNING; trust them as the
        // source of truth and skip the otherwise redundant GET.
        const savedTimezone = response.data?.timezone ?? userTimezone;
        const savedDateFormat = response.data?.dateFormat ?? userDateFormat;
        const savedTimeFormat = response.data?.timeFormat ?? userTimeFormat;
        setUserTimezone(savedTimezone);
        setUserDateFormat(savedDateFormat);
        setUserTimeFormat(savedTimeFormat);
        setDatetimePrefs({
          timeZone: savedTimezone,
          dateFormat: savedDateFormat,
          timeFormat: savedTimeFormat,
        });
        toast.success('Preferences saved successfully');
      }
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast.error(error.message || 'Failed to save preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Demo mode handlers
  const handleResetDemoData = async () => {
    if (!confirm('This will discard all your local changes and reload the original report templates from the database. Are you sure?')) {
      return;
    }

    setResettingDemo(true);
    try {
      const { error } = await reseedDemoData();
      if (error) {
        toast.error(error.message || 'Failed to reset demo data');
      } else {
        toast.success('Demo data has been reset to original templates');
        // Reload the page to reflect changes
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error resetting demo data:', error);
      toast.error(error.message || 'Failed to reset demo data');
    } finally {
      setResettingDemo(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show configuration tab only for admins
  const showConfigurationTab = user?.role === 'admin';

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

          <Tabs defaultValue="preferences" className="w-full">
            <TabsList className={`grid w-full ${showConfigurationTab ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Preferences
              </TabsTrigger>
              {showConfigurationTab && (
                <TabsTrigger value="configuration" className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Configuration
                </TabsTrigger>
              )}
            </TabsList>

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
                      <TimezoneCombobox
                        value={userTimezone}
                        onValueChange={setUserTimezone}
                        disabled={loadingPreferences || savingPreferences}
                        browserTimezone={browserTimezone}
                      />
                      <p className="text-xs text-muted-foreground">
                        All date and time values in reports will be displayed in your selected timezone
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateFormat" className="text-sm font-medium">Date format</Label>
                      <Select
                        value={userDateFormat}
                        onValueChange={(value) => setUserDateFormat(value as DateFormat)}
                        disabled={loadingPreferences || savingPreferences}
                      >
                        <SelectTrigger id="dateFormat">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">01/12/2021 (DD/MM/YYYY) — Default</SelectItem>
                          <SelectItem value="dd.mm.yyyy">01.12.2021 (DD.MM.YYYY)</SelectItem>
                          <SelectItem value="mm-dd-yyyy">12-01-2021 (MM-DD-YYYY)</SelectItem>
                          <SelectItem value="yyyy-mm-dd">2021-12-01 (YYYY-MM-DD)</SelectItem>
                          <SelectItem value="dd-mmm-yyyy">1 Dec 2021 (DD MMM YYYY)</SelectItem>
                          <SelectItem value="dd-mmmm-yyyy">1 December 2021 (DD MMMM YYYY)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeFormat" className="text-sm font-medium">Time format</Label>
                      <Select
                        value={userTimeFormat}
                        onValueChange={(value) => setUserTimeFormat(value as TimeFormat)}
                        disabled={loadingPreferences || savingPreferences}
                      >
                        <SelectTrigger id="timeFormat">
                          <SelectValue placeholder="Select time format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="h12">12:13 PM (12-hour clock)</SelectItem>
                          <SelectItem value="h24">12:13 (24-hour clock)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-6 border-t">
                    <Button 
                      onClick={handleSavePreferences}
                      disabled={savingPreferences || loadingPreferences}
                      size="sm"
                    >
                      {savingPreferences ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Preferences'
                      )}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Demo Mode Section - Only visible in demo mode */}
              {demoMode && (
                <Card className="mt-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-amber-500" />
                        Demo Mode
                      </h2>
                      <p className="text-sm text-text-muted">
                        You are currently in Demo Mode. All changes are stored locally in your browser and will not affect the original database.
                      </p>
                    </div>

                    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                      <FlaskConical className="h-4 w-4 text-amber-600" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="text-sm text-amber-900 dark:text-amber-100">
                            <strong>Demo Mode Active:</strong> Your changes are saved locally and persist across browser sessions.
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            To discard all local changes and restore the original templates from the database, click the button below.
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-text-primary">Reset Demo Data</p>
                        <p className="text-xs text-text-muted">
                          Discard all local changes and reload original templates
                        </p>
                      </div>
                      <Button 
                        onClick={handleResetDemoData}
                        disabled={resettingDemo}
                        variant="secondary"
                        size="sm"
                        className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900"
                      >
                        {resettingDemo ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reset to Original
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="configuration" className="mt-6">
              {showConfigurationTab ? (
                <Card>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                        <Variable className="h-5 w-5" />
                        Global Variables
                      </h2>
                      <p className="text-sm text-text-muted">
                        Define global variables that can be used in SQL queries using <code className="text-xs bg-muted px-1 py-0.5 rounded">${'{variable_name}'}</code> syntax.
                      </p>
                    </div>

                    {loadingVariables ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[200px]">Label</TableHead>
                                <TableHead className="w-[250px]">Description</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {globalVariables.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                    No global variables defined
                                  </TableCell>
                                </TableRow>
                              ) : (
                                globalVariables.map((variable) => {
                                  const isEditing = editingId === variable.id;
                                  const editData = editingValues[variable.id] || {
                                    label: variable.label,
                                    description: variable.description || '',
                                    value: variable.value || '',
                                  };

                                  return (
                                    <TableRow key={variable.id}>
                                      <TableCell>
                                        {isEditing ? (
                                          <Input
                                            value={editData.label}
                                            onChange={(e) =>
                                              setEditingValues({
                                                ...editingValues,
                                                [variable.id]: { ...editData, label: e.target.value },
                                              })
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Variable name"
                                          />
                                        ) : (
                                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                            ${'{'}{variable.label}{'}'}
                                          </code>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isEditing ? (
                                          <Input
                                            value={editData.description}
                                            onChange={(e) =>
                                              setEditingValues({
                                                ...editingValues,
                                                [variable.id]: { ...editData, description: e.target.value },
                                              })
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Description (optional)"
                                          />
                                        ) : (
                                          <span className="text-sm text-muted-foreground">
                                            {variable.description || '—'}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isEditing ? (
                                          <Input
                                            value={editData.value}
                                            onChange={(e) =>
                                              setEditingValues({
                                                ...editingValues,
                                                [variable.id]: { ...editData, value: e.target.value },
                                              })
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Value (optional)"
                                          />
                                        ) : (
                                          <span className="text-sm font-mono">
                                            {variable.value || <span className="text-muted-foreground">—</span>}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isEditing ? (
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              variant="default"
                                              onClick={() => handleSaveEdit(variable.id)}
                                              className="h-8 px-2"
                                              title="Save changes"
                                            >
                                              <Save className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={handleCancelEdit}
                                              className="h-8 px-2"
                                              title="Cancel"
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleStartEdit(variable)}
                                              className="h-8 px-2"
                                              title="Edit variable"
                                            >
                                              <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleDelete(variable.id)}
                                              className="h-8 px-2 text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
                                              title="Delete variable"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        {showNewVariable ? (
                          <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium">Add New Variable</h3>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setShowNewVariable(false);
                                  setNewVariable({ label: '', description: '', value: '' });
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Label *</Label>
                                <Input
                                  value={newVariable.label}
                                  onChange={(e) => setNewVariable({ ...newVariable, label: e.target.value })}
                                  placeholder="variable_name"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Description</Label>
                                <Input
                                  value={newVariable.description}
                                  onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                                  placeholder="Optional description"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Value</Label>
                                <Input
                                  value={newVariable.value}
                                  onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                                  placeholder="Optional value"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <Button size="sm" onClick={handleCreateVariable}>
                                Create Variable
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowNewVariable(true)}
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Variable
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
