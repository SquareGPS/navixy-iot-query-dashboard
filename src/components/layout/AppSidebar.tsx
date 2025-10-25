import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Search, FolderOpen, FileText, ChevronDown, ChevronRight, MoreHorizontal, Database, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Report {
  id: string;
  title: string;
  section_id: string | null;
  sort_index: number;
}

interface Section {
  id: string;
  name: string;
  sort_index: number;
}

// Sortable Section Component
function SortableSection({ 
  section, 
  reports, 
  expandedSections, 
  toggleSection, 
  editingItem, 
  setEditingItem, 
  handleEditKeyDown, 
  handleUpdateItem, 
  startEditing, 
  canEdit, 
  editMode,
  state, 
  params, 
  navigate,
  onDeleteSection,
  onDeleteReport
}: {
  section: Section;
  reports: Report[];
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  editingItem: { id: string; type: 'section' | 'report'; value: string } | null;
  setEditingItem: (item: { id: string; type: 'section' | 'report'; value: string } | null) => void;
  handleEditKeyDown: (e: React.KeyboardEvent, isNew: boolean, sectionId?: string | null) => void;
  handleUpdateItem: () => void;
  startEditing: (id: string, type: 'section' | 'report', currentValue: string) => void;
  canEdit: boolean;
  editMode: boolean;
  state: string;
  params: any;
  navigate: (path: string) => void;
  onDeleteSection: (id: string) => void;
  onDeleteReport: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Collapsible
        open={expandedSections.has(section.id)}
        onOpenChange={() => toggleSection(section.id)}
      >
        <SidebarMenuItem>
          <div className="group relative">
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="w-full pr-8 hover:bg-surface-3">
                <div className="flex items-center gap-2 flex-1">
                  {canEdit && editMode && (
                    <div
                      {...listeners}
                      className="cursor-grab active:cursor-grabbing opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <span className="text-text-muted text-xs font-bold">⋮⋮</span>
                    </div>
                  )}
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  {state !== 'collapsed' && (
                    editingItem?.id === section.id ? (
                      <Input
                        value={editingItem.value}
                        onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        onBlur={() => handleUpdateItem()}
                        onKeyDown={(e) => handleEditKeyDown(e, false)}
                        className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="flex-1 truncate text-text-primary"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (canEdit && editMode) startEditing(section.id, 'section', section.name);
                        }}
                      >
                        {section.name}
                      </span>
                    )
                  )}
                </div>
                {canEdit && editMode && state !== 'collapsed' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => startEditing(section.id, 'section', section.name)}>
                        Rename Section
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDeleteSection(section.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Section
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent>
            <SortableContext items={reports.map(r => r.id)} strategy={verticalListSortingStrategy}>
              {reports.map((report) => (
                <SortableReport
                  key={report.id}
                  report={report}
                  editingItem={editingItem}
                  setEditingItem={setEditingItem}
                  handleEditKeyDown={handleEditKeyDown}
                  handleUpdateItem={handleUpdateItem}
                  startEditing={startEditing}
                  canEdit={canEdit}
                  editMode={editMode}
                  state={state}
                  params={params}
                  navigate={navigate}
                  onDeleteReport={onDeleteReport}
                />
              ))}
            </SortableContext>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </div>
  );
}

// Sortable Report Component
function SortableReport({
  report,
  editingItem,
  setEditingItem,
  handleEditKeyDown,
  handleUpdateItem,
  startEditing,
  canEdit,
  editMode,
  state,
  params,
  navigate,
  onDeleteReport
}: {
  report: Report;
  editingItem: { id: string; type: 'section' | 'report'; value: string } | null;
  setEditingItem: (item: { id: string; type: 'section' | 'report'; value: string } | null) => void;
  handleEditKeyDown: (e: React.KeyboardEvent, isNew: boolean, sectionId?: string | null) => void;
  handleUpdateItem: () => void;
  startEditing: (id: string, type: 'section' | 'report', currentValue: string) => void;
  canEdit: boolean;
  editMode: boolean;
  state: string;
  params: any;
  navigate: (path: string) => void;
  onDeleteReport: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: report.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => {
            if (!editingItem) navigate(`/app/report/${report.id}`);
          }}
          isActive={params.reportId === report.id}
          className={`pl-8 hover:bg-[var(--surface-3)] group ${
            params.reportId === report.id 
              ? 'bg-[var(--accent-soft)]/30 text-[var(--text-primary)] relative' 
              : 'text-[var(--text-secondary)]'
          }`}
        >
          {params.reportId === report.id && (
            <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--accent)] rounded-r"></span>
          )}
          <div className="flex items-center gap-2 flex-1">
            {canEdit && editMode && (
              <div
                {...listeners}
                className="cursor-grab active:cursor-grabbing opacity-60 hover:opacity-100 transition-opacity"
              >
                <span className="text-text-muted text-xs font-bold">⋮⋮</span>
              </div>
            )}
            <FileText className="h-4 w-4 shrink-0" />
            {state !== 'collapsed' && (
              editingItem?.id === report.id ? (
                <Input
                  value={editingItem.value}
                  onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                  onBlur={() => handleUpdateItem()}
                  onKeyDown={(e) => handleEditKeyDown(e, false)}
                  className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-1 truncate text-text-primary"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (canEdit && editMode) startEditing(report.id, 'report', report.title);
                  }}
                >
                  {report.title}
                </span>
              )
            )}
          </div>
          {canEdit && editMode && state !== 'collapsed' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => startEditing(report.id, 'report', report.title)}>
                  Rename Report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDeleteReport(report.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ id: string; type: 'section' | 'report'; value: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ type: 'section' | 'report'; id: string; name: string } | null>(null);
  const [editMode, setEditMode] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'editor';
  

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  useEffect(() => {
    fetchSectionsAndReports();
  }, []);

  // Listen for refresh events from ReportView
  useEffect(() => {
    const handleRefreshSidebar = () => {
      fetchSectionsAndReports();
    };

    window.addEventListener('refreshSidebar', handleRefreshSidebar);
    
    return () => {
      window.removeEventListener('refreshSidebar', handleRefreshSidebar);
    };
  }, []);

  const fetchSectionsAndReports = async () => {
    try {
      const [sectionsRes, reportsRes] = await Promise.all([
        apiService.getSections(),
        apiService.getReports()
      ]);

      if (sectionsRes.data) setSections(Array.isArray(sectionsRes.data) ? sectionsRes.data : []);
      if (reportsRes.data) setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    } catch (error) {
      console.error('Failed to fetch sections and reports:', error);
      toast.error('Failed to load reports');
      // Set empty arrays on error to prevent crashes
      setSections([]);
      setReports([]);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const filteredReports = (reports || []).filter((report) =>
    report.title.toLowerCase().includes(search.toLowerCase())
  );

  const groupedReports = sections.map((section) => ({
    section,
    reports: filteredReports.filter((r) => r.section_id === section.id),
  }));

  const ungroupedReports = filteredReports.filter((r) => !r.section_id);

  const handleCreateSection = async () => {
    if (!editingItem?.value.trim()) {
      toast.error('Section name is required');
      setEditingItem(null);
      return;
    }

    setCreating(true);
    try {
      const response = await apiService.createSection(editingItem.value, sections.length);
      
      if (response.error) {
        toast.error('Failed to create section');
        console.error(response.error);
      } else {
        toast.success('Section created');
        setEditingItem(null);
        await fetchSectionsAndReports();
        setExpandedSections(new Set([...expandedSections, response.data.id]));
      }
    } catch (error) {
      toast.error('Failed to create section');
      console.error(error);
    }
    setCreating(false);
  };

  const handleCreateReport = async (sectionId: string | null) => {
    if (!editingItem?.value.trim()) {
      toast.error('Report title is required');
      setEditingItem(null);
      return;
    }

    setCreating(true);
    
    // Create report schema
    const reportSchema = {
      title: editingItem.value,
      meta: {
        schema_version: '1.0.0',
        last_updated: new Date().toISOString(),
        updated_by: {
          id: 'system',
          name: 'System'
        }
      },
      rows: [
        {
          type: 'tiles',
          title: 'Key Metrics',
          visuals: [
            {
              kind: 'tile',
              label: 'Metric 1',
              query: { sql: 'SELECT 0 as value' },
              options: { precision: 0 }
            },
            {
              kind: 'tile',
              label: 'Metric 2',
              query: { sql: 'SELECT 0 as value' },
              options: { precision: 0 }
            },
            {
              kind: 'tile',
              label: 'Metric 3',
              query: { sql: 'SELECT 0 as value' },
              options: { precision: 0 }
            }
          ]
        },
        {
          type: 'table',
          visuals: [
            {
              kind: 'table',
              label: 'Data Table',
              query: { sql: "SELECT 1 as id, 'Example' as name" },
              options: {
                paginate: true,
                page_size: 25
              }
            }
          ]
        }
      ]
    };

    try {
      const response = await apiService.createReport({
        title: editingItem.value,
        section_id: sectionId,
        slug: editingItem.value.toLowerCase().replace(/\s+/g, '-'),
        sort_index: (reports || []).filter((r: any) => r.section_id === sectionId).length || 0,
        report_schema: reportSchema,
      });

      if (response.error) {
        toast.error('Failed to create report');
        console.error(response.error);
        setCreating(false);
        return;
      }

      toast.success('Report created');
      setEditingItem(null);
      setCreating(false);
      await fetchSectionsAndReports();
      navigate(`/app/report/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create report');
      console.error(error);
      setCreating(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem?.value.trim()) {
      toast.error('Name cannot be empty');
      setEditingItem(null);
      return;
    }

    try {
      let response;
      if (editingItem.type === 'section') {
        response = await apiService.updateSection(editingItem.id, editingItem.value);
      } else {
        response = await apiService.updateReport(editingItem.id, { title: editingItem.value });
      }

      if (response.error) {
        toast.error(`Failed to update ${editingItem.type}`);
        console.error(response.error);
      } else {
        toast.success(`${editingItem.type === 'section' ? 'Section' : 'Report'} renamed`);
        fetchSectionsAndReports();
      }
    } catch (error) {
      toast.error(`Failed to update ${editingItem.type}`);
      console.error(error);
    }
    setEditingItem(null);
  };

  const startCreatingReport = (sectionId: string | null) => {
    setCreating(false); // Reset creating state
    setEditingItem({ id: `new-report-${sectionId || 'root'}`, type: 'report', value: '' });
  };

  const startCreatingSection = () => {
    setCreating(false); // Reset creating state
    setEditingItem({ id: 'new-section', type: 'section', value: '' });
  };

  const startEditing = (id: string, type: 'section' | 'report', currentValue: string) => {
    setEditingItem({ id, type, value: currentValue });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, isNew: boolean, sectionId?: string | null) => {
    if (e.key === 'Enter') {
      if (isNew) {
        if (editingItem?.type === 'section') {
          handleCreateSection();
        } else {
          handleCreateReport(sectionId || null);
        }
      } else {
        handleUpdateItem();
      }
    } else if (e.key === 'Escape') {
      setEditingItem(null);
    }
  };

  // Drag and drop handlers
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !editMode) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dragging sections
    const activeSection = sections.find(s => s.id === activeId);
    const overSection = sections.find(s => s.id === overId);

    if (activeSection && overSection) {
      // Reordering sections
      const oldIndex = sections.findIndex(s => s.id === activeId);
      const newIndex = sections.findIndex(s => s.id === overId);
      
      const newSections = arrayMove(sections, oldIndex, newIndex);
      setSections(newSections);

      // Update sort indices
      const sectionsToUpdate = newSections.map((section, index) => ({
        id: section.id,
        sort_index: index
      }));

      try {
        await apiService.reorderSections(sectionsToUpdate);
        toast.success('Sections reordered');
      } catch (error) {
        console.error('Failed to reorder sections:', error);
        toast.error('Failed to reorder sections');
        // Revert on error
        fetchSectionsAndReports();
      }
      return;
    }

    // Check if we're dragging reports
    const activeReport = reports.find(r => r.id === activeId);
    const overReport = reports.find(r => r.id === overId);

    if (activeReport && overReport) {
      // Check if reports are in the same section
      if (activeReport.section_id === overReport.section_id) {
        // Reordering within the same section
        const sectionReports = reports.filter(r => r.section_id === activeReport.section_id);
        const oldIndex = sectionReports.findIndex(r => r.id === activeId);
        const newIndex = sectionReports.findIndex(r => r.id === overId);
        
        const newSectionReports = arrayMove(sectionReports, oldIndex, newIndex);
        
        // Update the reports array
        const updatedReports = reports.map(report => {
          const newReport = newSectionReports.find(r => r.id === report.id);
          return newReport ? { ...report, sort_index: newReport.sort_index } : report;
        });
        
        setReports(updatedReports);

        // Update sort indices
        const reportsToUpdate = newSectionReports.map((report, index) => ({
          id: report.id,
          sort_index: index,
          section_id: report.section_id
        }));

        try {
          await apiService.reorderReports(reportsToUpdate);
          toast.success('Reports reordered');
        } catch (error) {
          console.error('Failed to reorder reports:', error);
          toast.error('Failed to reorder reports');
          // Revert on error
          fetchSectionsAndReports();
        }
      } else {
        // Moving report to different section
        const updatedReports = reports.map(report => {
          if (report.id === activeId) {
            return { ...report, section_id: overReport.section_id };
          }
          return report;
        });
        
        setReports(updatedReports);

        // Update the report's section
        try {
          await apiService.reorderReports([{
            id: activeId,
            sort_index: 0, // Will be updated by backend
            section_id: overReport.section_id
          }]);
          toast.success('Report moved to section');
          fetchSectionsAndReports(); // Refresh to get updated sort indices
        } catch (error) {
          console.error('Failed to move report:', error);
          toast.error('Failed to move report');
          // Revert on error
          fetchSectionsAndReports();
        }
      }
    }
  };

  // Delete handlers
  const handleDeleteSection = (id: string) => {
    const section = sections.find(s => s.id === id);
    if (section) {
      setShowDeleteDialog({ type: 'section', id, name: section.name });
    }
  };

  const handleDeleteReport = (id: string) => {
    const report = reports.find(r => r.id === id);
    if (report) {
      setShowDeleteDialog({ type: 'report', id, name: report.title });
    }
  };

  const confirmDelete = async () => {
    if (!showDeleteDialog) return;

    try {
      if (showDeleteDialog.type === 'section') {
        const response = await apiService.deleteSection(showDeleteDialog.id);
        if (response.error) {
          throw new Error(response.error.message || 'Failed to delete section');
        }
        toast.success(`Section "${showDeleteDialog.name}" deleted`);
      } else {
        const response = await apiService.deleteReport(showDeleteDialog.id);
        if (response.error) {
          throw new Error(response.error.message || 'Failed to delete report');
        }
        toast.success(`Report "${showDeleteDialog.name}" deleted`);
      }
      
      setShowDeleteDialog(null);
      await fetchSectionsAndReports();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete item');
    }
  };

  return (
    <>
    <Sidebar className={state === 'collapsed' ? 'w-14' : 'w-[248px]'} collapsible="icon">
      <SidebarContent className="bg-[var(--surface-1)] border-r border-[var(--border-subtle)]">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-3 px-3 py-6">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            {state !== 'collapsed' && (
              <div>
                <span className="font-bold text-lg text-text-primary">Navixy</span>
                <p className="text-xs text-text-muted">Reports</p>
              </div>
            )}
          </SidebarGroupLabel>

          {state !== 'collapsed' && (
            <div className="px-3 pb-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    placeholder="Search reports..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-9 bg-[var(--surface-3)]/80 border-[var(--border)] focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {editMode ? (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => setEditMode(false)}
                          className="h-8 w-8 p-0 flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors"
                        >
                          <span className="text-green-600 font-bold text-sm">✓</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors"
                            >
                              <span className="text-[var(--accent)] font-bold text-lg">+</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-surface-2 border-border">
                            <DropdownMenuItem onClick={startCreatingSection}>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              New Section
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => startCreatingReport(null)}>
                              <FileText className="mr-2 h-4 w-4" />
                              New Report
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => setEditMode(true)}
                        className="h-8 w-8 p-0 flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors"
                      >
                        <span className="text-[var(--accent)] font-bold text-sm">✏</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SidebarMenu>
                <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {groupedReports.map(({ section, reports: sectionReports }) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      reports={sectionReports}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      editingItem={editingItem}
                      setEditingItem={setEditingItem}
                      handleEditKeyDown={handleEditKeyDown}
                      handleUpdateItem={handleUpdateItem}
                      startEditing={startEditing}
                      canEdit={canEdit}
                      editMode={editMode}
                      state={state}
                      params={params}
                      navigate={navigate}
                      onDeleteSection={handleDeleteSection}
                      onDeleteReport={handleDeleteReport}
                    />
                  ))}
                </SortableContext>
              
              {editingItem?.id === 'new-section' && state !== 'collapsed' && (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <Input
                      value={editingItem.value}
                      onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                      onBlur={() => {
                        if (editingItem.value.trim()) {
                          handleCreateSection();
                        } else {
                          setEditingItem(null);
                        }
                      }}
                      onKeyDown={(e) => handleEditKeyDown(e, true, null)}
                      placeholder="Section name..."
                      className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                      autoFocus
                      disabled={false}
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {ungroupedReports.length > 0 && (
                <>
                  {ungroupedReports.map((report) => (
                    <SidebarMenuItem key={report.id}>
                      <SidebarMenuButton
                        onClick={() => {
                          if (!editingItem) navigate(`/app/report/${report.id}`);
                        }}
                        isActive={params.reportId === report.id}
                        className={`hover:bg-[var(--surface-3)] ${
                          params.reportId === report.id 
                            ? 'bg-[var(--accent-soft)]/30 text-[var(--text-primary)] relative' 
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {params.reportId === report.id && (
                          <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--accent)] rounded-r"></span>
                        )}
                        <FileText className="h-4 w-4 shrink-0" />
                        {state !== 'collapsed' && (
                          editingItem?.id === report.id ? (
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              onBlur={() => handleUpdateItem()}
                              onKeyDown={(e) => handleEditKeyDown(e, false)}
                              className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="flex-1 truncate text-text-primary"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (canEdit && editMode) startEditing(report.id, 'report', report.title);
                              }}
                            >
                              {report.title}
                            </span>
                          )
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}

              {/* New Report Input (Root Level) */}
              {editingItem?.id === 'new-report-root' && state !== 'collapsed' && (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <FileText className="h-4 w-4 shrink-0" />
                    <Input
                      value={editingItem.value}
                      onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                      onBlur={() => {
                        if (editingItem.value.trim()) {
                          handleCreateReport(null);
                        } else {
                          setEditingItem(null);
                        }
                      }}
                      onKeyDown={(e) => handleEditKeyDown(e, true, null)}
                      placeholder="Report title..."
                      className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                      autoFocus
                      disabled={false}
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Section */}
        {['admin', 'editor'].includes(user?.role || '') && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/app/sql-editor')}
                    className={`w-full ${
                      location.pathname === '/app/sql-editor' 
                        ? 'bg-accent-soft text-accent' 
                        : 'hover:bg-surface-3'
                    }`}
                  >
                    <Database className="h-4 w-4 shrink-0" />
                    {state !== 'collapsed' && (
                      <span className="flex-1 truncate text-text-primary">SQL Editor</span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>

    {/* Delete Confirmation Dialog */}
    <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {showDeleteDialog?.type === 'section' ? 'Section' : 'Report'}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{showDeleteDialog?.name}"?
            {showDeleteDialog?.type === 'section' && (
              <span className="block mt-2 text-sm text-orange-600">
                This will move all reports in this section to the root level.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowDeleteDialog(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
