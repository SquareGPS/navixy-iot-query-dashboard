/**
 * New ReportView Component
 * Uses the Grafana-based renderer instead of legacy RowRenderer
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, Save, X, Download, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { DashboardProvider, DashboardRenderer, ErrorBoundary } from '@/renderer-adapters/react';
import { ReportMigration } from '@/renderer-core/utils/migration';
import type { ReportSchema } from '@/types/report-schema';

const ReportView = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [legacyReport, setLegacyReport] = useState<any>(null);
  const [dashboardJson, setDashboardJson] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingSchema, setDownloadingSchema] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [timeRange, setTimeRange] = useState({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    to: new Date()
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Load report data
  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiService.getReportById(reportId);
        
        if (response.error) {
          throw new Error(response.error.message || 'Failed to fetch report');
        }
        
        const report = response.data.report;
        setLegacyReport(report);
        
        if (!report.report_schema || 
            (typeof report.report_schema === 'object' && Object.keys(report.report_schema).length === 0)) {
          throw new Error('Report schema is missing');
        }

        const reportSchema = report.report_schema as unknown as ReportSchema;
        
        // Check if this is already a Grafana dashboard
        if (reportSchema.dashboard) {
          // Already in Grafana format
          setDashboardJson(JSON.stringify(reportSchema, null, 2));
        } else {
          // Migrate from legacy format
          const grafanaDashboard = ReportMigration.migrateToGrafana(reportSchema);
          setDashboardJson(JSON.stringify(grafanaDashboard, null, 2));
        }
        
        setEditorValue(JSON.stringify(reportSchema, null, 2));
      } catch (err: any) {
        console.error('Error fetching report:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  const handleSaveSchema = async () => {
    if (!reportId) return;

    setSaving(true);
    try {
      const parsedSchema = JSON.parse(editorValue);
      
      const response = await apiService.updateReportSchema(reportId, parsedSchema);
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to save report');
      }

      toast({
        title: 'Success',
        description: 'Report schema updated successfully',
      });

      setIsEditing(false);
      
      // Reload report data to reflect schema changes
      const fetchReport = async () => {
        if (!reportId) return;
        
        try {
          const response = await apiService.getReportById(reportId);
          
          if (response.error) {
            throw new Error(response.error.message || 'Failed to fetch report');
          }
          
          const report = response.data.report;
          setLegacyReport(report);
          
          if (!report.report_schema || 
              (typeof report.report_schema === 'object' && Object.keys(report.report_schema).length === 0)) {
            throw new Error('Report schema is missing');
          }

          const reportSchema = report.report_schema as unknown as ReportSchema;
          
          // Check if this is already a Grafana dashboard
          if (reportSchema.dashboard) {
            // Already in Grafana format
            setDashboardJson(JSON.stringify(reportSchema, null, 2));
          } else {
            // Migrate from legacy format
            const grafanaDashboard = ReportMigration.migrateToGrafana(reportSchema);
            setDashboardJson(JSON.stringify(grafanaDashboard, null, 2));
          }
          
          setEditorValue(JSON.stringify(reportSchema, null, 2));
        } catch (err: any) {
          console.error('Error reloading report:', err);
          setError(err.message || 'Failed to reload report');
        }
      };
      
      fetchReport();
    } catch (err: any) {
      console.error('Error saving schema:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save report schema',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSchema = async () => {
    if (!legacyReport) return;

    setDownloadingSchema(true);
    try {
      const schemaData = {
        report_id: legacyReport.id,
        title: legacyReport.title,
        schema: JSON.parse(dashboardJson)
      };

      const blob = new Blob([JSON.stringify(schemaData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${legacyReport.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_schema.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Schema downloaded successfully',
      });
    } catch (err: any) {
      console.error('Error downloading schema:', err);
      toast({
        title: 'Error',
        description: 'Failed to download schema',
        variant: 'destructive',
      });
    } finally {
      setDownloadingSchema(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportId) return;

    setDeleting(true);
    try {
      const response = await apiService.deleteReport(reportId);
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete report');
      }

      toast({
        title: 'Success',
        description: 'Report deleted successfully',
      });

      // Redirect to reports list
      window.location.href = '/';
    } catch (err: any) {
      console.error('Error deleting report:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete report',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleTimeRangeChange = (from: Date, to: Date) => {
    setTimeRange({ from, to });
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!dashboardJson) {
    return (
      <AppLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No dashboard data available</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {editingTitle ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="text-2xl font-bold border rounded px-2 py-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => {
                    // Handle title save
                    setEditingTitle(false);
                  }}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTitle(false);
                    setTempTitle(legacyReport?.title || '');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h1 
                className="text-2xl font-bold cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                onClick={() => {
                  setTempTitle(legacyReport?.title || '');
                  setEditingTitle(true);
                }}
              >
                {legacyReport?.title || 'Untitled Report'}
              </h1>
            )}
            {/* Remove subtitle display as it doesn't conform to Grafana model */}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSchema}
              disabled={downloadingSchema}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Schema
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel Edit' : 'Edit Schema'}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Time Range Selector */}
        <Card className="p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Time Range:</label>
            <input
              type="datetime-local"
              value={timeRange.from.toISOString().slice(0, 16)}
              onChange={(e) => setTimeRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
              className="border rounded px-2 py-1"
            />
            <span>to</span>
            <input
              type="datetime-local"
              value={timeRange.to.toISOString().slice(0, 16)}
              onChange={(e) => setTimeRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
              className="border rounded px-2 py-1"
            />
            <Button
              size="sm"
              onClick={() => setTimeRange({
                from: new Date(Date.now() - 24 * 60 * 60 * 1000),
                to: new Date()
              })}
            >
              Last 24h
            </Button>
          </div>
        </Card>

        {/* Schema Editor */}
        {isEditing && (
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Dashboard Schema Editor</h3>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleSaveSchema}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              
              <textarea
                value={editorValue}
                onChange={(e) => setEditorValue(e.target.value)}
                className="w-full h-96 font-mono text-sm border rounded p-4"
                placeholder="Dashboard JSON schema..."
              />
            </div>
          </Card>
        )}

        {/* Dashboard Renderer */}
        <ErrorBoundary>
          <DashboardProvider
            dashboardJson={dashboardJson}
            timeRange={timeRange}
            userContext={{
              userId: user?.userId,
              email: user?.email
            }}
          >
            <DashboardRenderer className="space-y-4" />
          </DashboardProvider>
        </ErrorBoundary>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Report</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{legacyReport?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteReport}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ReportView;
