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
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [editingReport, setEditingReport] = useState<string | null>(null);
  const [editingReportTitle, setEditingReportTitle] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);
  const [showNewReport, setShowNewReport] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportSection, setNewReportSection] = useState<string>('');
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
    if (!newSectionName.trim()) {
      toast.error('Section name is required');
      return;
    }

    setCreating(true);
    const { data, error } = await supabase
      .from('sections')
      .insert({ name: newSectionName, sort_index: sections.length })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create section');
      console.error(error);
    } else {
      toast.success('Section created successfully');
      setNewSectionName('');
      setShowNewSection(false);
      fetchSectionsAndReports();
    }
    setCreating(false);
  };

  const handleCreateReport = async () => {
    if (!newReportTitle.trim()) {
      toast.error('Report title is required');
      return;
    }

    setCreating(true);
    
    // Create report
    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .insert({
        title: newReportTitle,
        section_id: newReportSection || null,
        slug: newReportTitle.toLowerCase().replace(/\s+/g, '-'),
        sort_index: reports.length,
      })
      .select()
      .single();

    if (reportError) {
      toast.error('Failed to create report');
      console.error(reportError);
      setCreating(false);
      return;
    }

    // Create 3 default tiles
    const tiles = [
      { report_id: reportData.id, position: 1, title: 'Metric 1', sql: 'SELECT 0' },
      { report_id: reportData.id, position: 2, title: 'Metric 2', sql: 'SELECT 0' },
      { report_id: reportData.id, position: 3, title: 'Metric 3', sql: 'SELECT 0' },
    ];

    const { error: tilesError } = await supabase.from('report_tiles').insert(tiles);

    // Create default table
    const { error: tableError } = await supabase
      .from('report_tables')
      .insert({
        report_id: reportData.id,
        sql: 'SELECT 1 as id, \'Example\' as name',
      });

    if (tilesError || tableError) {
      toast.error('Report created but failed to add default content');
      console.error(tilesError || tableError);
    } else {
      toast.success('Report created successfully');
      navigate(`/app/report/${reportData.id}`);
    }

    setNewReportTitle('');
    setNewReportSection('');
    setShowNewReport(false);
    setCreating(false);
    fetchSectionsAndReports();
  };

  const handleUpdateSectionName = async (sectionId: string, newName: string) => {
    if (!newName.trim()) {
      toast.error('Section name cannot be empty');
      return;
    }

    const { error } = await supabase
      .from('sections')
      .update({ name: newName })
      .eq('id', sectionId);

    if (error) {
      toast.error('Failed to update section name');
      console.error(error);
    } else {
      toast.success('Section renamed');
      fetchSectionsAndReports();
    }
    setEditingSection(null);
  };

  const handleUpdateReportTitle = async (reportId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      toast.error('Report title cannot be empty');
      return;
    }

    const { error } = await supabase
      .from('reports')
      .update({ title: newTitle })
      .eq('id', reportId);

    if (error) {
      toast.error('Failed to update report title');
      console.error(error);
    } else {
      toast.success('Report renamed');
      fetchSectionsAndReports();
    }
    setEditingReport(null);
  };

  const startEditingSection = (sectionId: string, currentName: string) => {
    setEditingSection(sectionId);
    setEditingSectionName(currentName);
  };

  const startEditingReport = (reportId: string, currentTitle: string) => {
    setEditingReport(reportId);
    setEditingReportTitle(currentTitle);
  };

  return (
    <>
      <Dialog open={showNewSection} onOpenChange={setShowNewSection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Section</DialogTitle>
            <DialogDescription>
              Organize your reports by creating a new section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="section-name">Section Name</Label>
              <Input
                id="section-name"
                placeholder="e.g., Sales Reports"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSection(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSection} disabled={creating}>
              {creating ? 'Creating...' : 'Create Section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewReport} onOpenChange={setShowNewReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Report</DialogTitle>
            <DialogDescription>
              Create a new report with 3 metric tiles and a data table
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-title">Report Title</Label>
              <Input
                id="report-title"
                placeholder="e.g., Monthly Sales Overview"
                value={newReportTitle}
                onChange={(e) => setNewReportTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-section">Section (Optional)</Label>
              <select
                id="report-section"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newReportSection}
                onChange={(e) => setNewReportSection(e.target.value)}
              >
                <option value="">No section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewReport(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReport} disabled={creating}>
              {creating ? 'Creating...' : 'Create Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <Sidebar className={state === 'collapsed' ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 px-2 py-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            {state !== 'collapsed' && <span className="font-semibold">Reports MVP</span>}
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
              {groupedReports.map(({ section, reports }) => (
                <Collapsible
                  key={section.id}
                  open={expandedSections.has(section.id)}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <SidebarMenuItem>
                    <div
                      className="relative group"
                      onMouseEnter={() => setHoveredSection(section.id)}
                      onMouseLeave={() => setHoveredSection(null)}
                    >
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="w-full">
                          {expandedSections.has(section.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <FolderOpen className="h-4 w-4" />
                          {state !== 'collapsed' && (
                            editingSection === section.id ? (
                              <Input
                                value={editingSectionName}
                                onChange={(e) => setEditingSectionName(e.target.value)}
                                onBlur={() => handleUpdateSectionName(section.id, editingSectionName)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateSectionName(section.id, editingSectionName);
                                  } else if (e.key === 'Escape') {
                                    setEditingSection(null);
                                  }
                                }}
                                className="h-6 px-1 py-0 text-sm"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (canEdit) startEditingSection(section.id, section.name);
                                }}
                              >
                                {section.name}
                              </span>
                            )
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      {state !== 'collapsed' && canEdit && hoveredSection === section.id && editingSection !== section.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewReportSection(section.id);
                                setShowNewReport(true);
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              New Report
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowNewSection(true);
                              }}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              New Section
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <CollapsibleContent>
                      {reports.map((report) => (
                        <SidebarMenuItem key={report.id}>
                          <SidebarMenuButton
                            onClick={() => !editingReport && navigate(`/app/report/${report.id}`)}
                            isActive={params.reportId === report.id}
                            className="pl-8"
                          >
                            <FileText className="h-4 w-4" />
                            {state !== 'collapsed' && (
                              editingReport === report.id ? (
                                <Input
                                  value={editingReportTitle}
                                  onChange={(e) => setEditingReportTitle(e.target.value)}
                                  onBlur={() => handleUpdateReportTitle(report.id, editingReportTitle)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateReportTitle(report.id, editingReportTitle);
                                    } else if (e.key === 'Escape') {
                                      setEditingReport(null);
                                    }
                                  }}
                                  className="h-6 px-1 py-0 text-sm"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className="truncate"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (canEdit) startEditingReport(report.id, report.title);
                                  }}
                                >
                                  {report.title}
                                </span>
                              )
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}

              {ungroupedReports.length > 0 && (
                <>
                  {ungroupedReports.map((report) => (
                    <SidebarMenuItem key={report.id}>
                      <SidebarMenuButton
                        onClick={() => !editingReport && navigate(`/app/report/${report.id}`)}
                        isActive={params.reportId === report.id}
                      >
                        <FileText className="h-4 w-4" />
                        {state !== 'collapsed' && (
                          editingReport === report.id ? (
                            <Input
                              value={editingReportTitle}
                              onChange={(e) => setEditingReportTitle(e.target.value)}
                              onBlur={() => handleUpdateReportTitle(report.id, editingReportTitle)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateReportTitle(report.id, editingReportTitle);
                                } else if (e.key === 'Escape') {
                                  setEditingReport(null);
                                }
                              }}
                              className="h-6 px-1 py-0 text-sm"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="truncate"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (canEdit) startEditingReport(report.id, report.title);
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
