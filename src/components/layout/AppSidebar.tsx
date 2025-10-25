import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Search, FolderOpen, FileText, ChevronDown, ChevronRight, MoreHorizontal, Database } from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';

interface Report {
  id: string;
  title: string;
  section_id: string | null;
}

interface Section {
  id: string;
  name: string;
  sort_index: number;
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

  const canEdit = user?.role === 'admin' || user?.role === 'editor';


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

  const handleCreateReport = async (sectionId: string) => {
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

  const startCreatingReport = (sectionId: string) => {
    setEditingItem({ id: `new-report-${sectionId}`, type: 'report', value: '' });
  };

  const startCreatingSection = () => {
    setEditingItem({ id: 'new-section', type: 'section', value: '' });
  };

  const startEditing = (id: string, type: 'section' | 'report', currentValue: string) => {
    setEditingItem({ id, type, value: currentValue });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, isNew: boolean, sectionId?: string) => {
    if (e.key === 'Enter') {
      if (isNew) {
        if (editingItem?.type === 'section') {
          handleCreateSection();
        } else if (sectionId) {
          handleCreateReport(sectionId);
        }
      } else {
        handleUpdateItem();
      }
    } else if (e.key === 'Escape') {
      setEditingItem(null);
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search reports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9 bg-[var(--surface-3)]/80 border-[var(--border)] focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
          )}

          <SidebarGroupContent>
            <SidebarMenu>
              {groupedReports.map(({ section, reports: sectionReports }) => (
                <Collapsible
                  key={section.id}
                  open={expandedSections.has(section.id)}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <SidebarMenuItem>
                    <div className="group relative">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="w-full pr-8 hover:bg-surface-3">
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
                                  if (canEdit) startEditing(section.id, 'section', section.name);
                                }}
                              >
                                {section.name}
                              </span>
                            )
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      
                      {state !== 'collapsed' && canEdit && !editingItem && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-3"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-surface-2 border-border">
                            <DropdownMenuItem
                              onClick={() => {
                                setExpandedSections(new Set([...expandedSections, section.id]));
                                startCreatingReport(section.id);
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              New Report
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={startCreatingSection}>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              New Section
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    
                    <CollapsibleContent>
                      {sectionReports.map((report) => (
                        <SidebarMenuItem key={report.id}>
                          <SidebarMenuButton
                            onClick={() => {
                              if (!editingItem) navigate(`/app/report/${report.id}`);
                            }}
                            isActive={params.reportId === report.id}
                            className={`pl-8 hover:bg-[var(--surface-3)] ${
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
                                    if (canEdit) startEditing(report.id, 'report', report.title);
                                  }}
                                >
                                  {report.title}
                                </span>
                              )
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                      
                      {editingItem?.id === `new-report-${section.id}` && state !== 'collapsed' && (
                        <SidebarMenuItem>
                          <SidebarMenuButton className="pl-8" disabled>
                            <FileText className="h-4 w-4 shrink-0" />
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              onBlur={() => {
                                if (editingItem.value.trim()) {
                                  handleCreateReport(section.id);
                                } else {
                                  setEditingItem(null);
                                }
                              }}
                              onKeyDown={(e) => handleEditKeyDown(e, true, section.id)}
                              placeholder="Report title..."
                              className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                              autoFocus
                              disabled={creating}
                            />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
              
              {editingItem?.id === 'new-section' && state !== 'collapsed' && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
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
                      onKeyDown={(e) => handleEditKeyDown(e, true)}
                      placeholder="Section name..."
                      className="h-6 px-1 py-0 text-sm flex-1 bg-surface-2 border-border"
                      autoFocus
                      disabled={creating}
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
                                if (canEdit) startEditing(report.id, 'report', report.title);
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
            </SidebarMenu>
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
    </>
  );
}
