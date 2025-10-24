import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Search, FolderOpen, FileText, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  const { userRole } = useAuth();
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ id: string; type: 'section' | 'report'; value: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const canEdit = userRole === 'admin' || userRole === 'editor';

  useEffect(() => {
    console.log('Sidebar - User role:', userRole, 'Can edit:', canEdit);
  }, [userRole, canEdit]);

  useEffect(() => {
    fetchSectionsAndReports();
  }, []);

  const fetchSectionsAndReports = async () => {
    const [sectionsRes, reportsRes] = await Promise.all([
      supabase.from('sections').select('*').order('sort_index'),
      supabase.from('reports').select('id, title, section_id').order('sort_index')
    ]);

    if (sectionsRes.data) setSections(sectionsRes.data);
    if (reportsRes.data) setReports(reportsRes.data);
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

  const filteredReports = reports.filter((report) =>
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
    const { data, error } = await supabase
      .from('sections')
      .insert({ name: editingItem.value, sort_index: sections.length })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create section');
      console.error(error);
    } else {
      toast.success('Section created');
      setEditingItem(null);
      await fetchSectionsAndReports();
      setExpandedSections(new Set([...expandedSections, data.id]));
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

    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .insert({
        title: editingItem.value,
        section_id: sectionId,
        slug: editingItem.value.toLowerCase().replace(/\s+/g, '-'),
        sort_index: reports?.filter((r: any) => r.section_id === sectionId).length || 0,
        report_schema: reportSchema,
      })
      .select()
      .single();

    if (reportError) {
      toast.error('Failed to create report');
      console.error(reportError);
      setCreating(false);
      return;
    }

    toast.success('Report created');
    setEditingItem(null);
    setCreating(false);
    await fetchSectionsAndReports();
    navigate(`/app/report/${reportData.id}`);
  };

  const handleUpdateItem = async () => {
    if (!editingItem?.value.trim()) {
      toast.error('Name cannot be empty');
      setEditingItem(null);
      return;
    }

    const { error } = await supabase
      .from(editingItem.type === 'section' ? 'sections' : 'reports')
      .update(editingItem.type === 'section' ? { name: editingItem.value } : { title: editingItem.value })
      .eq('id', editingItem.id);

    if (error) {
      toast.error(`Failed to update ${editingItem.type}`);
      console.error(error);
    } else {
      toast.success(`${editingItem.type === 'section' ? 'Section' : 'Report'} renamed`);
      fetchSectionsAndReports();
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
    <Sidebar className={state === 'collapsed' ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 px-2 py-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            {state !== 'collapsed' && <span className="font-semibold">Reports Flex</span>}
          </SidebarGroupLabel>

          {state !== 'collapsed' && (
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
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
                        <SidebarMenuButton className="w-full pr-8">
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
                                className="h-6 px-1 py-0 text-sm flex-1"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="flex-1 truncate"
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
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
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
                            className="pl-8"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            {state !== 'collapsed' && (
                              editingItem?.id === report.id ? (
                                <Input
                                  value={editingItem.value}
                                  onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                  onBlur={() => handleUpdateItem()}
                                  onKeyDown={(e) => handleEditKeyDown(e, false)}
                                  className="h-6 px-1 py-0 text-sm flex-1"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className="flex-1 truncate"
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
                              className="h-6 px-1 py-0 text-sm flex-1"
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
                      className="h-6 px-1 py-0 text-sm flex-1"
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
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        {state !== 'collapsed' && (
                          editingItem?.id === report.id ? (
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              onBlur={() => handleUpdateItem()}
                              onKeyDown={(e) => handleEditKeyDown(e, false)}
                              className="h-6 px-1 py-0 text-sm flex-1"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="flex-1 truncate"
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
      </SidebarContent>
    </Sidebar>
    </>
  );
}
