/**
 * DraggablePanel wrapper - makes a panel draggable
 */

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { GridPos } from '../../layout/geometry/grid';

interface DraggablePanelProps {
  panelId: number;
  gridPos: GridPos;
  children: React.ReactNode;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  panelId,
  gridPos,
  children,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `panel-${panelId}`,
    data: {
      type: 'panel',
      panelId,
      gridPos,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : 'auto',
        width: '100%',
        height: '100%',
      } : {
        width: '100%',
        height: '100%',
      }}
      {...listeners}
      {...attributes}
      className={`relative ${isDragging ? 'opacity-50' : ''}`}
    >
      {children}
    </div>
  );
};

