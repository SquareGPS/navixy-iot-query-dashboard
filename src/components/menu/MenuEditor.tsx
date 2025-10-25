import React, { useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Search, FolderOpen, FileText, ChevronDown, ChevronRight, MoreHorizontal, Database, Trash2, GripVertical, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import {
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
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  useDroppable,
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
import { useMenuTree, useReorderMenuMutation } from '@/hooks/use-menu-mutations';
import { RenameModal, DeleteModal, CreateSectionModal, CreateReportModal } from './MenuModals';
import type { MenuTree, DragItem, DropResult } from '@/types/menu-editor';

// Sortable Section Item Component
interface SortableSectionItemProps {
  section: { id: string; name: string; sortOrder: number; version: number };
  isEditMode: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

function SortableSectionItem({ section, isEditMode, onRename, onDelete }: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: section.id,
    disabled: !isEditMode,
    data: {
      type: 'section',
      id: section.id,
    } as DragItem,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 mr-1 rounded hover:bg-muted/50"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      
      <div className="flex-1 px-2 py-1">
        <div className="text-sm font-medium text-foreground uppercase tracking-wider">
          {section.name}
        </div>
      </div>

      {isEditMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(section.id, section.name)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(section.id, section.name)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// Sortable Report Item Component
interface SortableReportItemProps {
  report: { id: string; name: string; sortOrder: number; version: number };
  parentSectionId: string | null; // Add this to know the parent section
  isEditMode: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

function SortableReportItem({ report, parentSectionId, isEditMode, onRename, onDelete }: SortableReportItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: report.id,
    disabled: !isEditMode,
    data: {
      type: 'report',
      id: report.id,
      parentSectionId: parentSectionId,
    } as DragItem,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = location.pathname === `/app/report/${report.id}`;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 mr-1 rounded hover:bg-muted/50"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      
      <SidebarMenuItem className="flex-1">
        <SidebarMenuButton 
          className={`w-full justify-start ${isActive ? 'bg-accent' : ''}`}
          onClick={() => navigate(`/app/report/${report.id}`)}
        >
          <FileText className="h-4 w-4" />
          <span className="truncate">{report.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {isEditMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(report.id, report.name)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(report.id, report.name)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// Droppable Drop Zone Component
interface DroppableDropZoneProps {
  id: string;
  type: 'root' | 'section';
  sectionId?: string;
  children: React.ReactNode;
}

function DroppableDropZone({ id, type, sectionId, children }: DroppableDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'drop-zone',
      dropZoneType: type,
      sectionId: sectionId || null,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[40px] p-1 rounded border-2 border-dashed transition-colors ${
        isOver 
          ? 'border-primary bg-primary/5' 
          : 'border-transparent hover:border-muted-foreground/20'
      }`}
    >
      {children}
    </div>
  );
}

// Main MenuEditor Component
export function MenuEditor() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [isEditMode, setIsEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [renameItem, setRenameItem] = useState<{ id: string; type: 'section' | 'report'; name: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string; type: 'section' | 'report'; name: string } | null>(null);
  const [deleteStrategy, setDeleteStrategy] = useState<'move_children_to_root' | 'delete_children' | null>(null);
  const [isCreateSectionModalOpen, setIsCreateSectionModalOpen] = useState(false);
  const [isCreateReportModalOpen, setIsCreateReportModalOpen] = useState(false);

  // Queries and mutations
  const { data: menuTree, isLoading, error } = useMenuTree();
  const reorderMutation = useReorderMenuMutation();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const item = active.data.current as DragItem;
    if (item) {
      setDraggedItem(item);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over || !menuTree) return;
    
    console.log('Drag end event:', { active: active.id, over: over.id, overData: over.data.current });

    const activeItem = active.data.current as DragItem;
    const overItem = over.data.current as DragItem;

    // Determine drop target
    let dropResult: DropResult;
    
    if (overItem && overItem.type !== 'drop-zone') {
      // Dropped on another item (not a drop zone)
      dropResult = {
        activeId: active.id as string,
        overId: over.id as string,
        activeType: activeItem.type as 'section' | 'report',
        overType: overItem.type as 'section' | 'report',
        overParentSectionId: overItem.parentSectionId,
      };
    } else {
      // Dropped on empty space or drop zone
      const overElement = over.id as string;
      const overData = over.data.current;
      
      console.log('Processing drop zone:', { overElement, overData });
      
      // Check if dropped on a drop zone
      if (overData?.type === 'drop-zone') {
        const dropZoneType = overData.dropZoneType;
        
        if (dropZoneType === 'root') {
          dropResult = {
            activeId: active.id as string,
            overId: 'root',
            activeType: activeItem.type as 'section' | 'report',
            overType: 'root' as const,
            overParentSectionId: null,
          };
        } else if (dropZoneType === 'section') {
          const sectionId = overData.sectionId;
          console.log('Dropping on section drop zone:', { sectionId });
          dropResult = {
            activeId: active.id as string,
            overId: `drop-zone-section-${sectionId}`,
            activeType: activeItem.type as 'section' | 'report',
            overType: 'drop-zone' as const,
            overParentSectionId: sectionId,
            overItem: overData,
          };
        } else {
          console.log('Invalid drop zone type:', dropZoneType);
          return; // Invalid drop zone
        }
      } else {
        // Fallback to old logic
        if (overElement === 'root') {
          dropResult = {
            activeId: active.id as string,
            overId: 'root',
            activeType: activeItem.type as 'section' | 'report',
            overType: 'root' as const,
            overParentSectionId: null,
            overItem: overData,
          };
        } else {
          // Assume it's a section
          dropResult = {
            activeId: active.id as string,
            overId: overElement,
            activeType: activeItem.type as 'section' | 'report',
            overType: 'section' as const,
            overParentSectionId: overElement,
            overItem: overData,
          };
        }
      }
    }

    console.log('Final drop result:', dropResult);
    // Process the drop
    processDrop(dropResult);
  }, [menuTree]);

  const processDrop = useCallback((dropResult: DropResult) => {
    if (!menuTree) return;

    const { activeId, overId, activeType, overType, overParentSectionId, overItem } = dropResult;
    
    console.log('Processing drop:', { activeId, overId, activeType, overType, overParentSectionId, overItem });

    // Build the reorder payload
    const sections: Array<{ id: string; sortOrder: number; version: number }> = [];
    const reports: Array<{ id: string; parentSectionId: string | null; sortOrder: number; version: number }> = [];

    // Handle section reordering
    if (activeType === 'section' && overType === 'section') {
      const activeIndex = menuTree.sections.findIndex(s => s.id === activeId);
      const overIndex = menuTree.sections.findIndex(s => s.id === overId);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        const reorderedSections = arrayMove(menuTree.sections, activeIndex, overIndex);
        reorderedSections.forEach((section: any, index) => {
          sections.push({
            id: section.id,
            sortOrder: (index + 1) * 1000,
            version: section.version,
          });
        });
      }
    }

    // Handle report reordering/moving
    if (activeType === 'report') {
      // Find the active report and determine its current parent
      let activeReport = menuTree.rootReports.find(r => r.id === activeId);
      let currentParentSectionId: string | null = null;
      
      if (!activeReport) {
        // Look in section reports
        for (const [sectionId, sectionReports] of Object.entries(menuTree.sectionReports || {})) {
          activeReport = (sectionReports as any[]).find((r: any) => r.id === activeId);
          if (activeReport) {
            currentParentSectionId = sectionId;
            break;
          }
        }
      }
      
      if (activeReport) {
        let newParentSectionId: string | null = null;
        let newSortOrder = 1000;

        if (overType === 'root') {
          newParentSectionId = null;
          // Add to end of root reports
          newSortOrder = (menuTree.rootReports.length + 1) * 1000;
        } else if (overType === 'section') {
          newParentSectionId = overParentSectionId || overId;
          // Add to end of section reports
          const sectionReports = menuTree.sectionReports?.[newParentSectionId] || [];
          newSortOrder = (sectionReports.length + 1) * 1000;
        } else if (overType === 'drop-zone' && overItem?.dropZoneType === 'section') {
          // Handle dropping on section drop zone
          newParentSectionId = overParentSectionId || overItem.sectionId;
          console.log('Processing section drop zone:', { newParentSectionId, overParentSectionId, overItem });
          // Add to end of section reports
          const sectionReports = menuTree.sectionReports?.[newParentSectionId] || [];
          newSortOrder = (sectionReports.length + 1) * 1000;
        } else if (overType === 'report') {
          // Find the target report's parent
          let targetReport = menuTree.rootReports.find(r => r.id === overId);
          let targetParentSectionId: string | null = null;
          
          if (!targetReport) {
            // Look in section reports
            for (const [sectionId, sectionReports] of Object.entries(menuTree.sectionReports || {})) {
              targetReport = (sectionReports as any[]).find((r: any) => r.id === overId);
              if (targetReport) {
                targetParentSectionId = sectionId;
                break;
              }
            }
          }
          
          if (targetReport) {
            newParentSectionId = targetParentSectionId;
            newSortOrder = targetReport.sortOrder + 500; // Insert after target
          }
        }

        reports.push({
          id: activeReport.id,
          parentSectionId: newParentSectionId,
          sortOrder: newSortOrder,
          version: activeReport.version,
        });
      }
    }

    // Send the reorder request
    if (sections.length > 0 || reports.length > 0) {
      console.log('Sending reorder request:', { sections, reports });
      reorderMutation.mutate({ sections, reports });
    } else {
      console.log('No changes to send');
    }
  }, [menuTree, reorderMutation]);


  const handleRename = (id: string, name: string) => {
    // Determine if it's a section or report
    const isSection = menuTree?.sections.some(s => s.id === id);
    setRenameItem({ id, type: isSection ? 'section' : 'report', name });
  };

  const handleDelete = (id: string, name: string) => {
    // Determine if it's a section or report
    const isSection = menuTree?.sections.some(s => s.id === id);
    setDeleteItem({ id, type: isSection ? 'section' : 'report', name });
    if (isSection) {
      setDeleteStrategy('move_children_to_root'); // Default strategy
    }
  };

  // Filter data based on search
  const filteredSections = (menuTree?.sections as any[])?.filter((section: any) =>
    section.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredRootReports = (menuTree?.rootReports as any[])?.filter((report: any) =>
    report.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredSectionReports = Object.fromEntries(
    Object.entries(menuTree?.sectionReports || {}).map(([sectionId, reports]) => [
      sectionId,
      (reports as any[])?.filter((report: any) => report.name.toLowerCase().includes(search.toLowerCase())) || []
    ])
  );

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="p-4 text-center text-muted-foreground">
            Loading menu...
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (error) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="p-4 text-center text-destructive">
            Failed to load menu
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarContent>
          {/* Header */}
          <SidebarGroup>
            <SidebarGroupLabel>Reports</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex items-center gap-2 p-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reports..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {user?.role === 'admin' || user?.role === 'editor' ? (
                  <div className="flex gap-2">
                    {isEditMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary">
                            <Plus className="h-4 w-4 mr-1" />
                            Add new
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setIsCreateSectionModalOpen(true)}>
                            <FolderOpen className="h-4 w-4 mr-2" />
                            New section
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsCreateReportModalOpen(true)}>
                            <FileText className="h-4 w-4 mr-2" />
                            New report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant={isEditMode ? "primary" : "secondary"}
                      onClick={() => setIsEditMode(!isEditMode)}
                    >
                      {isEditMode ? 'Done' : 'Edit'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Menu Content */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* All sortable items in one context */}
                  <SortableContext 
                    items={[
                      ...filteredSections.map(s => s.id),
                      ...filteredRootReports.map(r => r.id),
                      ...Object.values(filteredSectionReports).flat().map(r => r.id),
                      // Add drop zones
                      'drop-zone-root',
                      ...filteredSections.map(s => `drop-zone-section-${s.id}`)
                    ]} 
                    strategy={verticalListSortingStrategy}
                  >
                    {/* Sections */}
                    {filteredSections.map((section) => (
                      <div key={section.id} className="mb-4">
                        <SortableSectionItem
                          section={section}
                          isEditMode={isEditMode}
                          onRename={handleRename}
                          onDelete={handleDelete}
                        />
                        
                        <div className="ml-6 mt-1">
                          {/* Section Reports Drop Zone */}
                          <DroppableDropZone id={`drop-zone-section-${section.id}`} type="section" sectionId={section.id}>
                            {filteredSectionReports[section.id]?.map((report) => (
                              <SortableReportItem
                                key={report.id}
                                report={report}
                                parentSectionId={section.id}
                                isEditMode={isEditMode}
                                onRename={handleRename}
                                onDelete={handleDelete}
                              />
                            ))}
                            {(!filteredSectionReports[section.id] || filteredSectionReports[section.id].length === 0) && (
                              <div className="text-xs text-muted-foreground p-2 text-center">
                                Drop reports here
                              </div>
                            )}
                          </DroppableDropZone>
                        </div>
                      </div>
                    ))}

                    {/* Root Reports */}
                    <div className="px-2 py-1 mt-4">
                      <div className="text-sm font-medium text-foreground uppercase tracking-wider">
                        Root Reports
                      </div>
                    </div>
                    {/* Root Reports Drop Zone */}
                    <DroppableDropZone id="drop-zone-root" type="root">
                      {filteredRootReports.map((report) => (
                        <SortableReportItem
                          key={report.id}
                          report={report}
                          parentSectionId={null}
                          isEditMode={isEditMode}
                          onRename={handleRename}
                          onDelete={handleDelete}
                        />
                      ))}
                      {filteredRootReports.length === 0 && (
                        <div className="text-xs text-muted-foreground p-2 text-center">
                          Drop reports here
                        </div>
                      )}
                    </DroppableDropZone>
                  </SortableContext>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </DndContext>
        </SidebarContent>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedItem ? (
          <div className="bg-background border rounded p-2 shadow-lg">
            {draggedItem.type === 'section' ? (
              <>
                <FolderOpen className="h-4 w-4 inline mr-2" />
                {(menuTree?.sections as any[])?.find((s: any) => s.id === draggedItem.id)?.name}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 inline mr-2" />
                {(menuTree?.rootReports as any[])?.find((r: any) => r.id === draggedItem.id)?.name ||
                 (Object.values(menuTree?.sectionReports || {}).flat() as any[]).find((r: any) => r.id === draggedItem.id)?.name}
              </>
            )}
          </div>
        ) : null}
      </DragOverlay>

      {/* Modals */}
      <RenameModal 
        item={renameItem} 
        onClose={() => setRenameItem(null)} 
      />
      
      <DeleteModal 
        item={deleteItem} 
        strategy={deleteStrategy}
        onClose={() => {
          setDeleteItem(null);
          setDeleteStrategy(null);
        }}
        onStrategyChange={setDeleteStrategy}
      />

      <CreateSectionModal 
        isOpen={isCreateSectionModalOpen}
        onClose={() => setIsCreateSectionModalOpen(false)}
      />

      <CreateReportModal 
        isOpen={isCreateReportModalOpen}
        onClose={() => setIsCreateReportModalOpen(false)}
      />
    </>
  );
}
