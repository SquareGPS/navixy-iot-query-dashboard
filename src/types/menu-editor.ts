// Types for the enhanced menu editor system

export interface MenuSection {
  id: string;
  name: string;
  sortOrder: number;
  version: number;
}

export interface MenuReport {
  id: string;
  name: string;
  sortOrder: number;
  version: number;
  parentSectionId: string | null;
}

export interface MenuTree {
  sections: MenuSection[];
  rootReports: MenuReport[];
  sectionReports: Record<string, MenuReport[]>;
}

export interface ReorderPayload {
  sections: Array<{ id: string; sortOrder: number; version: number }>;
  reports: Array<{ id: string; parentSectionId: string | null; sortOrder: number; version: number }>;
}

export interface ReorderResponse {
  ok: boolean;
  newVersions: Record<string, number>;
}

export interface RenameResponse {
  ok: boolean;
  section?: MenuSection;
  report?: MenuReport;
}

export interface DeleteSectionResponse {
  ok: boolean;
  affectedReports: number;
}

export interface DeleteReportResponse {
  ok: boolean;
}

// Drag and drop types
export interface DragItem {
  id: string;
  type: 'section' | 'report' | 'drop-zone';
  parentSectionId?: string | null;
  dropZoneType?: 'section';
  sectionId?: string;
}

// Drop result interface for drag and drop operations
export interface DropResult {
  activeId: string;
  overId: string | null;
  activeType: 'section' | 'report';
  overType?: 'section' | 'report' | 'root' | 'drop-zone';
  overParentSectionId?: string | null;
  overItem?: any;
}

// UI state types
export interface MenuEditorState {
  isEditMode: boolean;
  expandedSections: Set<string>;
  draggedItem: DragItem | null;
  renameItem: { id: string; type: 'section' | 'report'; name: string } | null;
  deleteItem: { id: string; type: 'section' | 'report'; name: string } | null;
  deleteStrategy: 'move_children_to_root' | 'delete_children' | null;
}

// Error types
export interface MenuError {
  code: string;
  message: string;
  details?: any;
}

export interface OptimisticUpdate {
  type: 'reorder' | 'rename' | 'delete';
  payload: any;
  rollback: () => void;
}
