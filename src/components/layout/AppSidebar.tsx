import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, FolderOpen, FileText, ChevronDown, ChevronRight } from 'lucide-react';
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
  const { userRole } = useAuth();
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const canEdit = userRole === 'admin' || userRole === 'editor';

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

  return (
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
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full">
                        {expandedSections.has(section.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <FolderOpen className="h-4 w-4" />
                        {state !== 'collapsed' && <span>{section.name}</span>}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {reports.map((report) => (
                        <SidebarMenuItem key={report.id}>
                          <SidebarMenuButton
                            onClick={() => navigate(`/app/report/${report.id}`)}
                            isActive={params.reportId === report.id}
                            className="pl-8"
                          >
                            <FileText className="h-4 w-4" />
                            {state !== 'collapsed' && <span className="truncate">{report.title}</span>}
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
                        onClick={() => navigate(`/app/report/${report.id}`)}
                        isActive={params.reportId === report.id}
                      >
                        <FileText className="h-4 w-4" />
                        {state !== 'collapsed' && <span className="truncate">{report.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>

          {state !== 'collapsed' && canEdit && (
            <div className="px-2 pt-2 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                New Section
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                New Report
              </Button>
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
