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
    cmdDeleteRow(row.id!);
    setShowDeleteDialog(false);
    setShowMenu(false);
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
        className={`relative flex items-center gap-2 px-4 py-2 bg-gray-100 border-2 border-gray-300 rounded transition-colors ${
          enableDrag ? 'cursor-move' : 'cursor-default'
        } ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-200'
        } ${isDragging ? 'opacity-50' : ''}`}
        style={{
          width: `${panelWidth}px`,
          height: `${panelHeight}px`,
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        }}
        onClick={() => onSelect?.(row.id!)}
        {...(enableDrag ? { ...listeners, ...attributes } : {})}
      >
        {enableDrag && <GripVertical className="h-4 w-4 text-gray-500 flex-shrink-0" />}
        
        <button
          onClick={handleToggleCollapse}
          className="p-1 hover:bg-gray-300 rounded flex-shrink-0"
          aria-label={isCollapsed ? 'Expand row' : 'Collapse row'}
          title={isCollapsed ? 'Expand row to show panels' : 'Collapse row to hide panels'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-700" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-700" />
          )}
        </button>

        <span className="flex-1 font-semibold text-sm">{row.title}</span>

        {enableEditControls && (
          <div className="flex items-center gap-1 relative">
            <Button
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveUp();
              }}
              className="h-6 w-6 p-0"
              title="Move row up"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveDown();
              }}
              className="h-6 w-6 p-0"
              title="Move row down"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>

            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[180px]">
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePackRow();
                    }}
                    title="Pack panels in this row by removing gaps"
                  >
                    <Package className="h-4 w-4" />
                    <span>Pack Row</span>
                    <span className="text-xs text-gray-500 ml-auto">Remove gaps</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCollapse(e);
                    }}
                    title={isCollapsed ? 'Expand row to show panels' : 'Collapse row to hide panels'}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {isCollapsed ? 'Show panels' : 'Hide panels'}
                    </span>
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
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
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the row &quot;{row.title}&quot;?
              {isCollapsed && row.panels && row.panels.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  This row contains {row.panels.length} panel{row.panels.length !== 1 ? 's' : ''} that will be moved to the top level.
                </span>
              )}
              {!isCollapsed && (
                <span className="block mt-2 text-amber-600">
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
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

