/**
 * RowHeader component - renders a row header with controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, GripVertical, MoreVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDraggable } from '@dnd-kit/core';
import type { GrafanaPanel } from '@/types/grafana-dashboard';
import { isRowPanel } from '../geometry/rows';
import { cmdToggleRowCollapsed, cmdPackRow } from '../state/commands';

interface RowHeaderProps {
  row: GrafanaPanel;
  containerWidth: number;
  isSelected?: boolean;
  onSelect?: (rowId: number) => void;
  onReorder?: (direction: 'up' | 'down') => void;
}

export const RowHeader: React.FC<RowHeaderProps> = ({
  row,
  containerWidth,
  isSelected = false,
  onSelect,
  onReorder,
}) => {
  if (!isRowPanel(row) || !row.id) {
    return null;
  }

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `row-${row.id}`,
    data: {
      type: 'row',
      rowId: row.id,
      gridPos: row.gridPos,
    },
  });

  const [showMenu, setShowMenu] = useState(false);
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
  };

  const handlePackRow = () => {
    cmdPackRow(row.id!);
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
    <div
      ref={setNodeRef}
      className={`relative flex items-center gap-2 px-4 py-2 bg-gray-100 border-2 border-gray-300 rounded cursor-move transition-colors ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{
        width: `${panelWidth}px`,
        height: `${panelHeight}px`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      onClick={() => onSelect?.(row.id!)}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4 text-gray-500" />
      
      <button
        onClick={handleToggleCollapse}
        className="p-1 hover:bg-gray-300 rounded"
        aria-label={isCollapsed ? 'Expand row' : 'Collapse row'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <span className="flex-1 font-semibold text-sm">{row.title}</span>

      <div className="flex items-center gap-1 relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleMoveUp();
          }}
          className="h-6 w-6 p-0"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleMoveDown();
          }}
          className="h-6 w-6 p-0"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>

        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[120px]">
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePackRow();
                }}
              >
                Pack Row
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCollapse(e);
                  setShowMenu(false);
                }}
              >
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

