/**
 * Unified DropZone component - consistent drop zones for all drop targets
 * Used for: above top row, below bottom row, and inside rows
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';

export type DropZoneType = 'canvas-top' | 'canvas-bottom' | 'row-pocket';

interface DropZoneProps {
  zoneId: string; // e.g., "canvas-top", "canvas-bottom", "row-pocket-{rowId}"
  type: DropZoneType;
  label: string;
  visible: boolean;
  containerWidth: number;
  top: number; // Top position in pixels
  height?: number; // Optional explicit height
  isDragActive?: boolean; // Whether a drag operation is currently active
}

const DEFAULT_HEIGHT = 48; // Default height when not hovering
const EXPANDED_HEIGHT = 64; // Height when hovering
const HITBOX_HEIGHT = 12; // Invisible hitbox height when not hovering

export const DropZone: React.FC<DropZoneProps> = ({
  zoneId,
  type,
  label,
  visible,
  containerWidth,
  top,
  height,
  isDragActive = false,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
    data: {
      type: type === 'row-pocket' ? 'row-pocket' : 'canvas-zone',
      zoneId,
      dropZoneType: type,
    },
  });

  if (!visible) {
    return null;
  }

  // Show visual indicator only when dragging or hovering
  const showVisual = isDragActive || isOver;
  const visualHeight = height || (isOver ? EXPANDED_HEIGHT : DEFAULT_HEIGHT);
  // Keep hitbox active even when not dragging - always use minimal height when not hovering
  const hitboxHeight = isOver ? EXPANDED_HEIGHT : HITBOX_HEIGHT;

  return (
    <>
      {/* Invisible hitbox for droppable - always present for drag detection */}
      <div
        ref={setNodeRef}
        className="absolute left-0"
        style={{
          top: `${top}px`,
          width: `${containerWidth}px`,
          height: `${hitboxHeight}px`,
          zIndex: 7, // Higher than row headers and panels
          pointerEvents: 'auto',
        }}
      />
      
      {/* Visual zone - only shown when dragging or hovering */}
      {showVisual && (
        <div
          className={`absolute left-0 transition-all duration-150 ease-out pointer-events-none select-none ${
            isOver ? 'opacity-100' : 'opacity-70'
          }`}
          style={{
            top: `${top}px`,
            width: `${containerWidth}px`,
            height: `${visualHeight}px`,
            zIndex: 7,
          }}
          aria-label={label}
          role="region"
          data-state={isOver ? 'active' : 'idle'}
        >
          <div
            className={`h-full rounded-lg border-2 border-dashed transition-all duration-150 ease-out ${
              isOver
                ? 'border-blue-500 bg-blue-500/15 shadow-md'
                : 'border-gray-300 bg-gray-100/50'
            }`}
          >
            {/* Content */}
            <div className="flex items-center justify-center h-full gap-2">
              {isOver ? (
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  <Plus className="h-4 w-4 text-blue-500" />
                  <span>{label}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-1 h-1 rounded-full bg-gray-400" />
                  <span className="opacity-60">{label}</span>
                </div>
              )}
            </div>
            
            {/* Subtle indicator line */}
            {!isOver && (
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-gray-300 opacity-40" />
            )}
          </div>
        </div>
      )}
    </>
  );
};

