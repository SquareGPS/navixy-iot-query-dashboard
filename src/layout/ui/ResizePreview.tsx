/**
 * ResizePreview component - shows ghost preview during resize
 */

import React from 'react';
import type { GridPos } from '../geometry/grid';
import { gridToPixels, GRID_UNIT_HEIGHT } from '../geometry/grid';

interface ResizePreviewProps {
  gridPos: GridPos;
  containerWidth: number;
  containerHeight: number;
}

export const ResizePreview: React.FC<ResizePreviewProps> = ({
  gridPos,
  containerWidth,
  containerHeight,
}) => {
  const panelPos = gridToPixels(gridPos.x, gridPos.y, containerWidth, GRID_UNIT_HEIGHT);
  const panelWidth = (gridPos.w / 24) * containerWidth;
  const panelHeight = gridPos.h * GRID_UNIT_HEIGHT;

  return (
    <div
      className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10"
      style={{
        left: `${panelPos.x}px`,
        top: `${panelPos.y}px`,
        width: `${panelWidth}px`,
        height: `${panelHeight}px`,
        zIndex: 999,
      }}
    >
      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-mono">
        {gridPos.w}×{gridPos.h}
      </div>
    </div>
  );
};

