import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SqlEditor } from '@/components/reports/SqlEditor';
import { ElementEditor } from '@/components/reports/ElementEditor';
import { AnnotationEditor } from '@/components/reports/AnnotationEditor';
import { RowRenderer } from '@/components/reports/visualizations/RowRenderer';
import { FloatingEditMenu } from '@/components/reports/FloatingEditMenu';
import { AddRowButton } from '@/components/reports/AddRowButton';
import { NewRowEditor } from '@/components/reports/NewRowEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Save, X, Download, Upload, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { ReportSchema } from '@/types/report-schema';

const ReportView = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [schema, setSchema] = useState<ReportSchema | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add logging for state changes
  useEffect(() => {
    console.log('📊 State changed - schema:', schema ? `${schema.title} (${schema.rows?.length} rows)` : 'null');
    if (!schema) {
      console.log('🚨 SCHEMA SET TO NULL! Stack trace:', new Error().stack);
    }
  }, [schema]);

  useEffect(() => {
    console.log('📊 State changed - error:', error);
    if (error) {
      console.log('🚨 ERROR SET! Stack trace:', new Error().stack);
    }
  }, [error]);

  useEffect(() => {
    console.log('📊 State changed - loading:', loading);
  }, [loading]);
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'full' | 'inline'>('inline');
  const [editorValue, setEditorValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingSchema, setDownloadingSchema] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customSchemaUrl, setCustomSchemaUrl] = useState('');
  const [defaultSchemaUrl, setDefaultSchemaUrl] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingElement, setEditingElement] = useState<{
    rowIndex: number;
    visualIndex: number;
    label: string;
    sql: string;
    params?: Record<string, any>;
  } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<{
    rowIndex: number;
    visualIndex: number;
    annotation: {
      section_name?: string;
      subtitle?: string;
      text?: string;
      markdown?: boolean;
    };
  } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempSubtitle, setTempSubtitle] = useState('');
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [isSubtitleHovered, setIsSubtitleHovered] = useState(false);
  const [editingRowTitle, setEditingRowTitle] = useState<number | null>(null);
  const [tempRowTitle, setTempRowTitle] = useState('');
  const [editingBreadcrumb, setEditingBreadcrumb] = useState<'section' | 'report' | null>(null);
  const [tempSectionName, setTempSectionName] = useState('');
  const [tempReportName, setTempReportName] = useState('');
  const [showNewRowEditor, setShowNewRowEditor] = useState(false);
  const [newRowType, setNewRowType] = useState<'tiles' | 'table' | 'charts' | 'annotation' | null>(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | undefined>(undefined);

  const canEdit = (user?.role === 'admin' || user?.role === 'editor') && !authLoading;

  useEffect(() => {
    const fetchDefaultUrl = async () => {
      try {
        const response = await apiService.getSchemaConfig();
        if (response.data?.defaultUrl) {
          setDefaultSchemaUrl(response.data.defaultUrl);
        }
      } catch (error) {
        console.error('Failed to fetch default schema URL:', error);
      }
    };
    
    fetchDefaultUrl();
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      console.log('🔄 Main fetchReport called...', { reportId });
      if (!reportId) return;

      setLoading(true);
      setError(null);

      try {
        console.log('📡 Fetching report from API...', { reportId });
        const response = await apiService.getReportById(reportId);
        console.log('📡 API response:', response);
        
        if (response.error) {
          console.error('❌ API error:', response.error);
          throw new Error(response.error.message || 'Failed to fetch report');
        }
        
        const report = response.data.report;
        console.log('📡 Report data:', report);
        console.log('📡 Report schema:', report.report_schema);
        console.log('📡 Schema type:', typeof report.report_schema);
        console.log('📡 Schema keys:', report.report_schema ? Object.keys(report.report_schema) : 'null');
        console.log('📡 Schema length:', report.report_schema ? Object.keys(report.report_schema).length : 'null');
        
        setReport(report);
        
        if (!report.report_schema || 
            (typeof report.report_schema === 'object' && Object.keys(report.report_schema).length === 0)) {
          console.log('❌ Schema is missing or empty, throwing error');
          throw new Error('Report schema is missing');
        }

        const reportSchema = report.report_schema as unknown as ReportSchema;
        console.log('✅ Setting schema:', reportSchema);
        setSchema(reportSchema);
        setEditorValue(JSON.stringify(reportSchema, null, 2));
        console.log('✅ Report loaded successfully');
      } catch (err: any) {
        console.error('❌ Error fetching report:', err);
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
      
      const response = await apiService.updateReport(reportId, { 
        title: parsedSchema.title || report?.title,
        subtitle: parsedSchema.subtitle,
        report_schema: parsedSchema 
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update report');
      }

      setSchema(parsedSchema);
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'Report schema updated successfully',
      });
    } catch (err: any) {
      console.error('Error saving schema:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save schema',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveElement = async (sql: string, params?: Record<string, any>) => {
    console.log('=== handleSaveElement called ===');
    console.log('Editing element:', editingElement);
    console.log('New SQL:', sql);
    console.log('New params:', params);
    
    if (!editingElement || !schema) {
      console.log('Early return - no editing element or schema');
      return;
    }

    const updatedSchema = { ...schema };
    const row = updatedSchema.rows[editingElement.rowIndex];
    
    console.log('Row type:', row.type);
    console.log('Row before update:', JSON.stringify(row, null, 2));
    
    if (row.type === 'tiles' || row.type === 'table' || row.type === 'charts') {
      const visual = row.visuals[editingElement.visualIndex];
      console.log('Visual before update:', JSON.stringify(visual, null, 2));
      
      visual.query.sql = sql;
      if (params) {
        visual.query.params = params;
      }
      
      console.log('Visual after update:', JSON.stringify(visual, null, 2));
    } else if (row.type === 'annotation') {
      // For annotations, we don't update SQL but we need to handle the case
      console.log('Annotation row detected - no SQL update needed');
    }

    console.log('Updated schema to save:', JSON.stringify(updatedSchema, null, 2));

    try {
      console.log('Saving to database with reportId:', reportId);
      
      const response = await apiService.updateReport(reportId!, { 
        title: updatedSchema.title || report?.title,
        subtitle: updatedSchema.subtitle,
        report_schema: updatedSchema 
      });

      console.log('Database update response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update report');
      }

      console.log('Setting local state with updated schema');
      
      // Add timestamp to force React to detect change
      updatedSchema.meta = {
        ...updatedSchema.meta,
        last_updated: new Date().toISOString()
      };
      
      setSchema(updatedSchema);
      setEditorValue(JSON.stringify(updatedSchema, null, 2));
      setEditingElement(null);
      
      toast({
        title: 'Success',
        description: 'Element updated successfully',
      });
      
      console.log('=== handleSaveElement completed successfully ===');
    } catch (err: any) {
      console.error('=== Error saving element ===', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save element',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAnnotation = async (annotation: {
    section_name?: string;
    subtitle?: string;
    text?: string;
    markdown?: boolean;
  }) => {
    console.log('=== handleSaveAnnotation called ===');
    console.log('Editing annotation:', editingAnnotation);
    console.log('New annotation:', annotation);
    
    if (!editingAnnotation || !schema) {
      console.log('Early return - no editing annotation or schema');
      return;
    }

    const updatedSchema = { ...schema };
    const row = updatedSchema.rows[editingAnnotation.rowIndex];
    
    console.log('Row type:', row.type);
    console.log('Row before update:', JSON.stringify(row, null, 2));
    
    if (row.type === 'annotation') {
      const visual = row.visuals[editingAnnotation.visualIndex];
      console.log('Visual before update:', JSON.stringify(visual, null, 2));
      
      // Update the annotation options
      visual.options = {
        ...visual.options,
        section_name: annotation.section_name,
        subtitle: annotation.subtitle,
        text: annotation.text,
        markdown: annotation.markdown,
      };
      
      console.log('Visual after update:', JSON.stringify(visual, null, 2));
    }

    console.log('Updated schema to save:', JSON.stringify(updatedSchema, null, 2));

    try {
      console.log('Saving to database with reportId:', reportId);
      
      const response = await apiService.updateReport(reportId!, { 
        title: updatedSchema.title || report?.title,
        subtitle: updatedSchema.subtitle,
        report_schema: updatedSchema 
      });

      console.log('Database update response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update report');
      }

      console.log('Setting local state with updated schema');
      
      // Add timestamp to force React to detect change
      updatedSchema.meta = {
        ...updatedSchema.meta,
        last_updated: new Date().toISOString()
      };
      
      setSchema(updatedSchema);
      setEditorValue(JSON.stringify(updatedSchema, null, 2));
      setEditingAnnotation(null);
      
      toast({
        title: 'Success',
        description: 'Annotation updated successfully',
      });
      
      console.log('=== handleSaveAnnotation completed successfully ===');
    } catch (err: any) {
      console.error('=== Error saving annotation ===', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save annotation',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteElement = async () => {
    if (!editingElement || !schema) return;
    
    const updatedSchema = { ...schema };
    const row = updatedSchema.rows[editingElement.rowIndex];
    
    if (row.type === 'tiles' || row.type === 'charts') {
      // Remove the visual from the row
      row.visuals.splice(editingElement.visualIndex, 1);
      
      // If no visuals left, remove the entire row
      if (row.visuals.length === 0) {
        updatedSchema.rows.splice(editingElement.rowIndex, 1);
      }
    } else if (row.type === 'table') {
      // For table rows, remove the entire row since there's only one visual
      updatedSchema.rows.splice(editingElement.rowIndex, 1);
    }

    try {
      const response = await apiService.updateReport(reportId!, { 
        title: updatedSchema.title || report?.title,
        subtitle: updatedSchema.subtitle,
        report_schema: updatedSchema
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete element');
      }
      
      setSchema(updatedSchema);
      setEditingElement(null);
      
      toast({
        title: 'Success',
        description: 'Element deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting element:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete element',
        variant: 'destructive',
      });
      throw error; // Re-throw to let the editor handle the error
    }
  };

  const handleDeleteAnnotation = async () => {
    if (!editingAnnotation || !schema) return;
    
    const updatedSchema = { ...schema };
    // Remove the entire annotation row
    updatedSchema.rows.splice(editingAnnotation.rowIndex, 1);

    try {
      const response = await apiService.updateReport(reportId!, { 
        title: updatedSchema.title || report?.title,
        subtitle: updatedSchema.subtitle,
        report_schema: updatedSchema
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete annotation');
      }
      
      setSchema(updatedSchema);
      setEditingAnnotation(null);
      
      toast({
        title: 'Success',
        description: 'Annotation deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting annotation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete annotation',
        variant: 'destructive',
      });
      throw error; // Re-throw to let the editor handle the error
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
      
      // Navigate back to the reports list
      window.location.href = '/app';
    } catch (error: any) {
      console.error('Error deleting report:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete report',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleStartEditTitle = () => {
    setTempTitle(schema?.title || '');
    setEditingTitle(true);
  };

  const handleStartEditSubtitle = () => {
    setTempSubtitle(schema?.subtitle || '');
    setEditingSubtitle(true);
  };

  const handleStartEditRowTitle = useCallback((rowIndex: number) => {
    if (!canEdit) return;
    const row = schema?.rows[rowIndex];
    if (row) {
      setTempRowTitle(row.title || '');
      setEditingRowTitle(rowIndex);
    }
  }, [canEdit, schema]);

  const handleSaveRowTitle = useCallback(async () => {
    if (!schema || editingRowTitle === null || !reportId) return;
    
    try {
      setSaving(true);
      const updatedSchema = { ...schema };
      updatedSchema.rows[editingRowTitle] = {
        ...updatedSchema.rows[editingRowTitle],
        title: tempRowTitle.trim() || undefined
      };
      
      const response = await apiService.updateReport(reportId, {
        title: schema.title,
        subtitle: schema.subtitle,
        report_schema: updatedSchema
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to update row title');
      }

      setSchema(updatedSchema);
      setEditingRowTitle(null);
      setTempRowTitle('');
      toast({
        title: 'Success',
        description: 'Row title updated successfully',
      });
    } catch (error) {
      console.error('Error updating row title:', error);
      toast({
        title: 'Error',
        description: 'Failed to update row title',
      });
    } finally {
      setSaving(false);
    }
  }, [schema, editingRowTitle, tempRowTitle, reportId]);

  const handleCancelEditRowTitle = useCallback(() => {
    setEditingRowTitle(null);
    setTempRowTitle('');
  }, []);

  const handleSaveTitle = async () => {
    if (!reportId || !tempTitle.trim()) return;
    
    try {
      // Update both database columns and JSON schema
      const updatedSchema = schema ? { ...schema, title: tempTitle.trim() } : null;
      
      const response = await apiService.updateReport(reportId, {
        title: tempTitle.trim(),
        subtitle: schema?.subtitle,
        report_schema: updatedSchema
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update title');
      }

      setSchema(updatedSchema);
      setEditorValue(JSON.stringify(updatedSchema, null, 2));
      setEditingTitle(false);
      
      toast({
        title: 'Success',
        description: 'Title updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating title:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update title',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSubtitle = async () => {
    if (!reportId) return;
    
    try {
      // Update both database columns and JSON schema
      const updatedSchema = schema ? { 
        ...schema, 
        subtitle: tempSubtitle.trim() || undefined 
      } : null;
      
      const response = await apiService.updateReport(reportId, {
        title: schema?.title || '',
        subtitle: tempSubtitle.trim() || null,
        report_schema: updatedSchema
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update subtitle');
      }

      setSchema(updatedSchema);
      setEditorValue(JSON.stringify(updatedSchema, null, 2));
      setEditingSubtitle(false);
      
      toast({
        title: 'Success',
        description: 'Subtitle updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating subtitle:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subtitle',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEditTitle = () => {
    setEditingTitle(false);
    setTempTitle('');
  };

  const handleCancelEditSubtitle = () => {
    setEditingSubtitle(false);
    setTempSubtitle('');
  };

  const handleStartEditBreadcrumb = (type: 'section' | 'report') => {
    if (type === 'section') {
      setTempSectionName(report?.section_name || '');
    } else {
      setTempReportName(report?.title || '');
    }
    setEditingBreadcrumb(type);
  };

  const handleSaveBreadcrumb = async () => {
    if (!reportId || !editingBreadcrumb) return;
    
    try {
      if (editingBreadcrumb === 'section') {
        // Update section name
        const response = await apiService.updateSection(report.section_id, tempSectionName.trim());
        if (response.error) {
          throw new Error(response.error.message || 'Failed to update section');
        }
        setReport(prev => prev ? { ...prev, section_name: tempSectionName.trim() } : null);
      } else {
        // Update report title (database column)
        const response = await apiService.updateReport(reportId, {
          title: tempReportName.trim(),
          subtitle: report?.subtitle,
          report_schema: schema
        });
        if (response.error) {
          throw new Error(response.error.message || 'Failed to update report');
        }
        setReport(prev => prev ? { ...prev, title: tempReportName.trim() } : null);
      }
      
      setEditingBreadcrumb(null);
      
      // Dispatch event to refresh sidebar data
      window.dispatchEvent(new CustomEvent('refreshSidebar'));
      
      toast({
        title: 'Success',
        description: `${editingBreadcrumb === 'section' ? 'Section' : 'Report'} updated successfully`,
      });
    } catch (error: any) {
      console.error(`Error updating ${editingBreadcrumb}:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to update ${editingBreadcrumb}`,
        variant: 'destructive',
      });
    }
  };

  const handleCancelEditBreadcrumb = () => {
    setEditingBreadcrumb(null);
    setTempSectionName('');
    setTempReportName('');
  };

  const handleAddRow = (rowType: 'tiles' | 'table' | 'charts' | 'annotation', insertAfterIndex?: number) => {
    setNewRowType(rowType);
    setInsertAfterIndex(insertAfterIndex);
    setShowNewRowEditor(true);
  };

  const handleSaveNewRow = async (newRow: any) => {
    if (!schema || !reportId) return;

    try {
      const updatedSchema = { ...schema };
      
      // Insert the new row at the specified position
      if (insertAfterIndex !== undefined) {
        updatedSchema.rows.splice(insertAfterIndex + 1, 0, newRow);
      } else {
        updatedSchema.rows.push(newRow);
      }

      // Update timestamp
      updatedSchema.meta = {
        ...updatedSchema.meta,
        last_updated: new Date().toISOString()
      };

      const response = await apiService.updateReport(reportId, {
        title: updatedSchema.title || report?.title,
        subtitle: updatedSchema.subtitle,
        report_schema: updatedSchema
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to add row');
      }

      setSchema(updatedSchema);
      setEditorValue(JSON.stringify(updatedSchema, null, 2));
      setShowNewRowEditor(false);
      setNewRowType(null);
      setInsertAfterIndex(undefined);

      toast({
        title: 'Success',
        description: 'Row added successfully',
      });
    } catch (error: any) {
      console.error('Error adding row:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add row',
        variant: 'destructive',
      });
    }
  };

  const handleExportSchema = () => {
    const blob = new Blob([editorValue], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema?.title || 'report'}-schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: 'Schema exported successfully',
    });
  };

  const handleImportSchema = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            JSON.parse(content); // Validate JSON
            setEditorValue(content);
            toast({
              title: 'Success',
              description: 'Schema imported successfully',
            });
          } catch (err) {
            toast({
              title: 'Error',
              description: 'Invalid JSON file',
              variant: 'destructive',
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDownloadExampleSchema = async () => {
    console.log('🚀 Starting schema download...', { reportId });
    setDownloadingSchema(true);
    try {
      let schemaUrl = '';
      
      // Use custom URL if provided, otherwise use default
      if (customSchemaUrl.trim()) {
        schemaUrl = customSchemaUrl.trim();
        console.log('📝 Using custom URL:', schemaUrl);
      } else {
        console.log('📥 Fetching example schema from API...');
        // Use the default endpoint
        const response = await apiService.getExampleSchema();
        console.log('📥 API response:', response);
        
        if (response.error) {
          console.error('❌ API error:', response.error);
          throw new Error(response.error.message || 'Failed to fetch example schema');
        }
        
        const exampleSchema = response.data.schema;
        console.log('📥 Downloaded schema:', exampleSchema);
        console.log('📥 Schema title:', exampleSchema?.title);
        console.log('📥 Schema rows count:', exampleSchema?.rows?.length);
        
        console.log('💾 Updating report in database...', { reportId, title: report?.title });
        // Update the report with the example schema
        const updateResponse = await apiService.updateReport(reportId!, {
          title: report?.title || 'New Report', // Keep the original title
          report_schema: exampleSchema
        });
        console.log('💾 Update response:', updateResponse);

        if (updateResponse.error) {
          console.error('❌ Update error:', updateResponse.error);
          throw new Error(updateResponse.error.message || 'Failed to update report');
        }

        console.log('✅ Report updated successfully');
        console.log('🔄 Starting report refresh...');
        
        // Clear current state to prevent immediate SQL execution
        setSchema(null);
        setEditorValue('');
        setError(null);
        
        // Force a refresh of the report data
        const fetchReport = async () => {
          console.log('🔄 Fetching fresh report data...', { reportId });
          if (!reportId) return;
          setLoading(true);
          setError(null);
          try {
            const response = await apiService.getReportById(reportId);
            console.log('🔄 Fresh report response:', response);
            
            if (response.error) {
              console.error('❌ Fresh report error:', response.error);
              throw new Error(response.error.message || 'Failed to fetch report');
            }
            const reportData = response.data.report;
            console.log('🔄 Fresh report data:', reportData);
            console.log('🔄 Fresh report schema:', reportData.report_schema);
            console.log('🔄 Fresh schema title:', reportData.report_schema?.title);
            console.log('🔄 Fresh schema rows:', reportData.report_schema?.rows?.length);
            
            if (!reportData.report_schema || 
                (typeof reportData.report_schema === 'object' && Object.keys(reportData.report_schema).length === 0)) {
              console.error('❌ Fresh report has empty schema!');
              throw new Error('Report schema is missing');
            }
            setReport(reportData);
            setSchema(reportData.report_schema);
            setEditorValue(JSON.stringify(reportData.report_schema, null, 2));
            console.log('✅ Fresh report data loaded successfully');
          } catch (err: any) {
            console.error('❌ Error fetching fresh report:', err);
            setError(err.message);
          } finally {
            setLoading(false);
          }
        };
        
        // Add a small delay to ensure database transaction is committed
        console.log('⏳ Waiting 500ms for database commit...');
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchReport();
        
        console.log('🎉 Schema download completed successfully');
        toast({
          title: 'Success',
          description: 'Example schema downloaded and saved successfully',
        });
        return;
      }

      // Handle custom URL
      const response = await fetch(schemaUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch schema from URL: ${response.statusText}`);
      }

      const exampleSchema = await response.json();
      
      // Update the report with the custom schema
      const updateResponse = await apiService.updateReport(reportId!, {
        title: report?.title || 'New Report', // Keep the original title
        report_schema: exampleSchema
      });

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message || 'Failed to update report');
      }

      // Clear current state to prevent immediate SQL execution
      setSchema(null);
      setEditorValue('');
      setError(null);
      
      // Force a refresh of the report data
      const fetchReport = async () => {
        if (!reportId) return;
        setLoading(true);
        setError(null);
        try {
          const response = await apiService.getReportById(reportId);
          if (response.error) {
            throw new Error(response.error.message || 'Failed to fetch report');
          }
          const reportData = response.data;
          if (!reportData.report_schema || 
              (typeof reportData.report_schema === 'object' && Object.keys(reportData.report_schema).length === 0)) {
            throw new Error('Report schema is missing');
          }
          setReport(reportData);
          setSchema(reportData.report_schema);
          setEditorValue(JSON.stringify(reportData.report_schema, null, 2));
        } catch (err: any) {
          console.error('Error fetching report:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      
      // Add a small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchReport();
      
      toast({
        title: 'Success',
        description: 'Schema downloaded and saved successfully',
      });
    } catch (err: any) {
      console.error('Error downloading schema:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to download schema',
        variant: 'destructive',
      });
    } finally {
      setDownloadingSchema(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Modern Loading State */}
          <Card className="p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-[var(--surface-3)] rounded-lg w-1/3 mb-4"></div>
              <div className="h-4 bg-[var(--surface-3)] rounded w-1/2"></div>
            </div>
          </Card>
          
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-[var(--surface-3)] rounded w-1/2 mb-4"></div>
                  <div className="h-12 bg-[var(--surface-3)] rounded-lg"></div>
                </div>
              </Card>
            ))}
          </div>
          
          <Card className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-[var(--surface-3)] rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-[var(--surface-3)] rounded"></div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Only show error state for critical errors, not SQL execution errors
  const isCriticalError = error && error !== 'Report schema is missing';
  const shouldShowError = isCriticalError || (!schema && !loading);
  
  if (shouldShowError) {
    const isSchemaMissing = error === 'Report schema is missing';
    console.log('🚨 Error state triggered:', { error, schema: schema ? 'exists' : 'null', isSchemaMissing, isCriticalError });
    
    
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Modern Error State */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-200 dark:border-red-800/50 rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  {isSchemaMissing ? 'Schema Required' : 'Report Error'}
                </h3>
                <p className="text-red-700 dark:text-red-300 mb-4">
                  {error || 'Report not found'}
                </p>
                {isSchemaMissing && canEdit && (
                  <div className="space-y-3">
                    <Button
                      onClick={() => handleDownloadExampleSchema()}
                      disabled={downloadingSchema}
                      className="bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all duration-200 hover:shadow-md"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadingSchema ? 'Downloading...' : 'Download Example Schema'}
                    </Button>
                    
                    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs">
                          Custom URL
                          {showAdvanced ? (
                            <ChevronDown className="h-3 w-3 ml-1" />
                          ) : (
                            <ChevronRight className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <Input
                          placeholder="Custom schema URL (optional)"
                          value={customSchemaUrl || defaultSchemaUrl || ""}
                          onChange={(e) => setCustomSchemaUrl(e.target.value)}
                          className="text-xs h-8 bg-[var(--surface-2)] border-red-200 dark:border-red-800 focus:border-red-400 dark:focus:border-red-600"
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Help Section */}
          {isSchemaMissing && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Need Help Getting Started?
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This report needs a schema to display data. Click the button above to download a pre-configured example schema that you can customize for your needs. Use the Advanced Options to specify a custom schema URL from GitHub or other sources.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between">
          {/* Breadcrumb Navigation */}
          {report && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              {editingBreadcrumb === 'section' ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempSectionName}
                    onChange={(e) => setTempSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveBreadcrumb();
                      if (e.key === 'Escape') handleCancelEditBreadcrumb();
                    }}
                    className="h-6 px-2 text-sm"
                    placeholder="Section name"
                    autoFocus
                  />
                  <Button onClick={handleSaveBreadcrumb} size="sm" variant="default" className="h-6 px-2">
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button onClick={handleCancelEditBreadcrumb} size="sm" variant="outline" className="h-6 px-2">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span 
                  className={`${isEditing ? 'cursor-pointer hover:text-[var(--text-primary)] transition-all' : ''}`}
                  onClick={() => isEditing && handleStartEditBreadcrumb('section')}
                >
                  {report.section_name || 'No Section'}
                </span>
              )}
              
              <span className="text-[var(--text-muted)]/50">&gt;</span>
              
              {editingBreadcrumb === 'report' ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempReportName}
                    onChange={(e) => setTempReportName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveBreadcrumb();
                      if (e.key === 'Escape') handleCancelEditBreadcrumb();
                    }}
                    className="h-6 px-2 text-sm"
                    placeholder="Report name"
                    autoFocus
                  />
                  <Button onClick={handleSaveBreadcrumb} size="sm" variant="default" className="h-6 px-2">
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button onClick={handleCancelEditBreadcrumb} size="sm" variant="outline" className="h-6 px-2">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span 
                  className={`${isEditing ? 'cursor-pointer hover:text-[var(--text-primary)] transition-all' : ''}`}
                  onClick={() => isEditing && handleStartEditBreadcrumb('report')}
                >
                  {report.title}
                </span>
              )}
            </div>
          )}

          {/* Right Side Controls - Simplified for non-editors */}
          <div className="flex items-center gap-3">
            {!canEdit && (
              <div className="flex items-center">
                <span className="text-sm text-[var(--text-muted)]">View Mode</span>
              </div>
            )}
          </div>
        </div>

        {/* Report Title and Subtitle */}
        <div className="space-y-2">
          {isEditing && editingTitle ? (
            <div>
              <Input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') handleCancelEditTitle();
                }}
                className="text-[24px] font-bold h-10 px-3"
                placeholder="Report title"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={handleSaveTitle} size="sm" variant="default">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button onClick={handleCancelEditTitle} size="sm" variant="outline">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className={`flex items-center gap-3 w-fit transition-all ${
                isEditing ? 'cursor-pointer hover:text-[var(--text-primary)]' : ''
              }`}
              onMouseEnter={() => {
                if (isEditing) setIsTitleHovered(true);
              }}
              onMouseLeave={() => setIsTitleHovered(false)}
              onClick={() => isEditing && handleStartEditTitle()}
            >
              <h1 className="text-[24px] font-bold text-[var(--text-primary)]">{schema?.title || 'Untitled Report'}</h1>
            </div>
          )}
          
          {isEditing && editingSubtitle ? (
            <div>
              <Input
                value={tempSubtitle}
                onChange={(e) => setTempSubtitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSubtitle();
                  if (e.key === 'Escape') handleCancelEditSubtitle();
                }}
                className="text-[var(--text-muted)] h-8 px-3"
                placeholder="Report subtitle (optional)"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={handleSaveSubtitle} size="sm" variant="default">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button onClick={handleCancelEditSubtitle} size="sm" variant="outline">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className={`flex items-center gap-3 w-fit transition-all ${
                isEditing ? 'cursor-pointer hover:text-[var(--text-primary)]' : ''
              }`}
              onMouseEnter={() => {
                if (isEditing) setIsSubtitleHovered(true);
              }}
              onMouseLeave={() => setIsSubtitleHovered(false)}
              onClick={() => isEditing && handleStartEditSubtitle()}
            >
              {schema?.subtitle ? (
                <p className="text-[var(--text-muted)]">{schema.subtitle}</p>
              ) : isEditing ? (
                <p className="text-[var(--text-muted)] italic">No subtitle</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Report Content */}
        <div className="space-y-6">
        {schema && schema.rows && schema.rows.length > 0 ? (
          <>
            {/* Add row button at the top */}
            <AddRowButton 
              onAddRow={handleAddRow} 
              canEdit={canEdit} 
              isEditing={isEditing && editMode === 'inline'} 
            />
            
            {schema.rows.map((row, rowIdx) => {
              const inlineEditActive = isEditing && editMode === 'inline';
              const rowKey = `${rowIdx}-${JSON.stringify(row.visuals.map(v => v.query?.sql || ''))}`;
              
              return (
                <div key={rowKey}>
                  <RowRenderer
                    row={row}
                    rowIndex={rowIdx}
                    editMode={inlineEditActive}
                    onEdit={setEditingElement}
                    onEditAnnotation={setEditingAnnotation}
                    editingRowTitle={editingRowTitle === rowIdx}
                    tempRowTitle={tempRowTitle}
                    onStartEditRowTitle={handleStartEditRowTitle}
                    onSaveRowTitle={handleSaveRowTitle}
                    onCancelEditRowTitle={handleCancelEditRowTitle}
                    onRowTitleChange={setTempRowTitle}
                    canEdit={canEdit}
                  />
                  
                  {/* Add row button after each row */}
                  <AddRowButton 
                    onAddRow={handleAddRow} 
                    insertAfterIndex={rowIdx}
                    canEdit={canEdit} 
                    isEditing={isEditing && editMode === 'inline'} 
                  />
                </div>
              );
            })}
          </>
        ) : (
          /* Empty State - Show example schema download option */
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-8 shadow-sm">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Download className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {schema ? 'Report Schema is Empty' : 'No Report Schema Found'}
                </h3>
                <p className="text-[var(--text-muted)] mb-6">
                  {schema 
                    ? 'This report doesn\'t have any content yet. Download an example schema to get started.'
                    : 'This report needs a schema to display content. Download an example schema to get started.'
                  }
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => handleDownloadExampleSchema()}
                    disabled={downloadingSchema}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {downloadingSchema ? 'Downloading...' : 'Download Example Schema'}
                  </Button>
                </div>
                
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/20 text-xs"
                    >
                      Custom URL
                      {showAdvanced ? (
                        <ChevronDown className="h-3 w-3 ml-1" />
                      ) : (
                        <ChevronRight className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <Input
                      placeholder="Custom schema URL (optional)"
                      value={customSchemaUrl || defaultSchemaUrl || ""}
                      onChange={(e) => setCustomSchemaUrl(e.target.value)}
                      className="text-xs h-8 bg-[var(--surface-2)] border-blue-200 dark:border-blue-800 focus:border-blue-400 dark:focus:border-blue-600"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Full Schema Editor Dialog */}
      <Dialog open={isEditing && editMode === 'full'} onOpenChange={(open) => !open && setIsEditing(false)}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0 bg-[var(--surface-1)] border-[var(--border)] overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--border)] bg-[var(--surface-1)] rounded-t-lg">
            <DialogTitle className="text-[var(--text-primary)]">Edit Report Schema</DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              Modify the complete JSON schema for this report
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-6 overflow-hidden bg-[var(--surface-1)]">
            <SqlEditor
              value={editorValue}
              onChange={setEditorValue}
              height="100%"
              language="json"
            />
          </div>

          <div className="flex justify-between gap-2 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-1)] rounded-b-lg">
            <div className="flex gap-2">
              <Button onClick={handleImportSchema} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={handleExportSchema} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveSchema} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Element Editor Dialog */}
      {editingElement && (
        <ElementEditor
          open={!!editingElement}
          onClose={() => setEditingElement(null)}
          element={editingElement}
          onSave={handleSaveElement}
          onDelete={handleDeleteElement}
        />
      )}

      {/* Annotation Editor Dialog */}
      {editingAnnotation && (
        <AnnotationEditor
          open={!!editingAnnotation}
          onClose={() => setEditingAnnotation(null)}
          annotation={editingAnnotation.annotation}
          onSave={handleSaveAnnotation}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Report
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Report: <span className="font-medium">{report?.title || schema?.title}</span>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteReport}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Row Editor Dialog */}
      {newRowType && (
        <NewRowEditor
          open={showNewRowEditor}
          onClose={() => {
            setShowNewRowEditor(false);
            setNewRowType(null);
            setInsertAfterIndex(undefined);
          }}
          rowType={newRowType}
          onSave={handleSaveNewRow}
        />
      )}

      {/* Floating Edit Menu */}
      <FloatingEditMenu
        isEditing={isEditing}
        editMode={editMode}
        canEdit={canEdit}
        onToggleEdit={() => { 
          setIsEditing(!isEditing); 
          if (!isEditing) setEditMode('inline');
        }}
        onSetEditMode={setEditMode}
        onDeleteReport={() => setShowDeleteDialog(true)}
      />
    </AppLayout>
  );
}

export default ReportView;
