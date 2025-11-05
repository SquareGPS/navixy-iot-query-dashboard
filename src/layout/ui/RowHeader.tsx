/**
 * RowHeader component - renders a row header with controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, GripVertical, MoreVertical, ArrowUp, ArrowDown, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDraggable } from '@dnd-kit/core';
import type { GrafanaPanel } from '@/types/grafana-dashboard';
import { isRowPanel } from '../geometry/rows';
import { cmdToggleRowCollapsed, cmdPackRow, cmdDeleteRow } from '../state/commands';

interface RowHeaderProps {
  row: GrafanaPanel;
  containerWidth: number;
  isSelected?: boolean;
  onSelect?: (rowId: number) => void;
  onReorder?: (direction: 'up' | 'down') => void;
  enableDrag?: boolean;
  enableEditControls?: boolean;
}

export const RowHeader: React.FC<RowHeaderProps> = ({
  row,
  containerWidth,
  isSelected = false,
  onSelect,
  onReorder,
  enableDrag = true,
  enableEditControls = true,
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
  const menuRef = useRef<HTMLDivElement>(null);
  const isCollapsed = row.collapsed === true;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  const handleMoveUp = () => {
    onReorder?.('up');
  };

  const handleMoveDown = () => {
    onReorder?.('down');
  };

  const panelWidth = (row.gridPos.w / 24) * containerWidth;
  const panelHeight = row.gridPos.h * 30; // GRID_UNIT_HEIGHT

  return (
    <>
      <div
        ref={setNodeRef}
        className={`relative flex items-center gap-2 px-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md transition-all ${
          enableDrag ? 'cursor-move' : 'cursor-default'
        } ${
          isSelected 
            ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)] shadow-sm' 
            : 'hover:bg-[var(--surface-3)]'
        } ${isDragging ? 'opacity-50' : ''}`}
        style={{
          width: `${panelWidth}px`,
          height: `${panelHeight}px`,
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        }}
        onClick={() => onSelect?.(row.id!)}
        {...(enableDrag ? { ...listeners, ...attributes } : {})}
      >
        {enableDrag && <GripVertical className="h-4 w-4 text-[var(--text-muted)] flex-shrink-0" />}
        
        <button
          onClick={handleToggleCollapse}
          className="p-1 hover:bg-[var(--surface-3)] rounded flex-shrink-0 transition-colors"
          aria-label={isCollapsed ? 'Expand row' : 'Collapse row'}
          title={isCollapsed ? 'Expand row to show panels' : 'Collapse row to hide panels'}
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMoveUp();
              }}
              className="h-6 w-6 p-0 flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-sm transition-colors"
              title="Move row up"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMoveDown();
              }}
              className="h-6 w-6 p-0 flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-sm transition-colors"
              title="Move row down"
            >
              <ArrowDown className="h-3 w-3" />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                className="h-6 w-6 p-0 flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-sm transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-[var(--surface-1)] border border-[var(--border)] rounded-md shadow-lg z-50 min-w-[180px]">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] flex items-center gap-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePackRow();
                    }}
                    title="Pack panels in this row by removing gaps"
                  >
                    <Package className="h-4 w-4 text-[var(--text-secondary)]" />
                    <span>Pack Row</span>
                    <span className="text-xs text-[var(--text-muted)] ml-auto">Remove gaps</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] flex items-center gap-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCollapse(e);
                    }}
                    title={isCollapsed ? 'Expand row to show panels' : 'Collapse row to hide panels'}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
                    )}
                    <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-auto">
                      {isCollapsed ? 'Show panels' : 'Hide panels'}
                    </span>
                  </button>
                  <div className="border-t border-[var(--border)] my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--surface-3)] flex items-center gap-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Delete button clicked, setting showDeleteDialog to true');
                      setShowDeleteDialog(true);
                      setShowMenu(false);
                    }}
                    title="Delete this row"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Row</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

