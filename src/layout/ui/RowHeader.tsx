/**
 * RowHeader component - renders a row header with controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, GripVertical, MoreVertical, Trash2, Package, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { useDraggable } from '@dnd-kit/core';
import type { GrafanaPanel } from '@/types/grafana-dashboard';
import { isRowPanel } from '../geometry/rows';
import { cmdToggleRowCollapsed, cmdPackRow, cmdDeleteRow, cmdRenameRow } from '../state/commands';

interface RowHeaderProps {
  row: GrafanaPanel;
  containerWidth: number;
  isSelected?: boolean;
  onSelect?: (rowId: number) => void;
  enableDrag?: boolean;
  enableEditControls?: boolean;
  isEditingLayout?: boolean;
}

export const RowHeader: React.FC<RowHeaderProps> = ({
  row,
  containerWidth,
  isSelected = false,
  onSelect,
  enableDrag = true,
  enableEditControls = true,
  isEditingLayout = false,
}) => {
  if (!isRowPanel(row) || !row.id) {
    return null;
  }

  // Always call useDraggable (hooks must be called unconditionally)
  // Use disabled prop to disable drag when not needed
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `row-${row.id}`,
    data: {
      type: 'row',
      rowId: row.id,
      gridPos: row.gridPos,
    },
    disabled: !enableDrag,
  });

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState(row.title || '');
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const isCollapsed = row.collapsed === true;

  // Sync renameValue when row.title changes
  useEffect(() => {
    setRenameValue(row.title || '');
  }, [row.title]);

  // Calculate menu position when menu opens
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4, // 4px gap below button
        left: rect.right - 180, // Align right edge with button (menu width is 180px)
      });
    } else {
      setMenuPosition(null);
    }
  }, [showMenu]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-menu-portal]')
      ) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    cmdToggleRowCollapsed(row.id!, !isCollapsed);
    setShowMenu(false);
  };

  const handlePackRow = () => {
    cmdPackRow(row.id!);
    setShowMenu(false);
  };

  const handleDeleteRow = () => {
    console.log('handleDeleteRow called for row:', row.id);
    try {
      cmdDeleteRow(row.id!);
      setShowDeleteDialog(false);
      setShowMenu(false);
    } catch (error) {
      console.error('Error deleting row:', error);
    }
  };

  const handleRenameRow = () => {
    if (!row.id) return;
    const trimmedTitle = renameValue.trim();
    if (trimmedTitle === row.title) {
      setShowRenameDialog(false);
      setShowMenu(false);
      return;
    }
    cmdRenameRow(row.id, trimmedTitle || 'New row');
    setShowRenameDialog(false);
    setShowMenu(false);
  };

  const handleOpenRenameDialog = () => {
    setRenameValue(row.title || '');
    setShowRenameDialog(true);
    setShowMenu(false);
  };

  const panelWidth = containerWidth; // Use containerWidth directly (already adjusted by parent)
  const panelHeight = row.gridPos.h * 30; // GRID_UNIT_HEIGHT

  return (
    <>
      <div
        ref={setNodeRef}
        className={`relative flex items-center gap-2 px-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md transition-shadow ring-1 ring-inset ring-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${
          enableDrag ? 'cursor-move' : 'cursor-default'
        } ${
          isSelected 
            ? 'ring-2 ring-blue-500 shadow-lg' 
            : ''
        } ${!isSelected ? 'hover:bg-[var(--surface-3)]' : ''} ${isDragging ? 'opacity-50' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        }}
        onClick={() => onSelect?.(row.id!)}
        {...(enableDrag ? { ...listeners, ...attributes } : {})}
      >
        {enableDrag && <GripVertical className="h-4 w-4 text-[var(--text-muted)] flex-shrink-0" />}
        
        <button
          onClick={handleToggleCollapse}
          disabled={isEditingLayout}
          className={`p-1 hover:bg-[var(--surface-3)] rounded flex-shrink-0 transition-colors ${
            isEditingLayout ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label={isCollapsed ? 'Expand row' : 'Collapse row'}
          title={isEditingLayout ? 'Rows are expanded in edit mode' : (isCollapsed ? 'Expand row to show panels' : 'Collapse row to hide panels')}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          )}
        </button>

        <span className="flex-1 font-semibold text-sm text-[var(--text-primary)]">{row.title}</span>

        {enableEditControls && (
          <div className="flex items-center gap-1 relative">
            <div className="relative" ref={menuRef}>
              <button
                ref={buttonRef}
                className="h-6 w-6 p-0 flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-sm transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showMenu && menuPosition && createPortal(
                <div
                  data-menu-portal
                  className="fixed bg-[var(--surface-1)] border border-[var(--border)] rounded-md shadow-lg z-[9999] min-w-[180px]"
                  style={{
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] flex items-start gap-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRenameDialog();
                    }}
                    title="Rename this row"
                  >
                    <Pencil className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span>Rename</span>
                      <span className="text-xs text-[var(--text-muted)] mt-0.5">Change row title</span>
                    </div>
                  </button>
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] flex items-start gap-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePackRow();
                    }}
                    title="Pack panels in this row by removing gaps"
                  >
                    <Package className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span>Pack Row</span>
                      <span className="text-xs text-[var(--text-muted)] mt-0.5">Remove gaps</span>
                    </div>
                  </button>
                  <div className="border-t border-[var(--border)] my-1" />
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-[var(--danger)] hover:bg-[var(--surface-3)] flex items-start gap-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Delete button clicked, setting showDeleteDialog to true');
                      setShowDeleteDialog(true);
                      setShowMenu(false);
                    }}
                    title="Delete this row"
                  >
                    <Trash2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Delete Row</span>
                  </button>
                </div>,
                document.body
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={(open) => {
        setShowRenameDialog(open);
        if (!open) {
          setRenameValue(row.title || '');
        }
      }}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Rename Row</DialogTitle>
            <DialogDescription>
              Enter a new name for this row
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameRow();
                } else if (e.key === 'Escape') {
                  setShowRenameDialog(false);
                  setRenameValue(row.title || '');
                }
              }}
              placeholder="Row title"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowRenameDialog(false);
                setRenameValue(row.title || '');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRenameRow}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        console.log('Dialog onOpenChange called with:', open);
        setShowDeleteDialog(open);
      }}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the row &quot;{row.title}&quot;?
              {isCollapsed && row.panels && row.panels.length > 0 && (
                <span className="block mt-2 text-[var(--warning)]">
                  This row contains {row.panels.length} panel{row.panels.length !== 1 ? 's' : ''} that will be moved to the top level.
                </span>
              )}
              {!isCollapsed && (
                <span className="block mt-2 text-[var(--warning)]">
                  This row contains panels that will be moved to the top level.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteRow}
              className="bg-[var(--danger)] hover:opacity-90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

