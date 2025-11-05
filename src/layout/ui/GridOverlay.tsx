/**
 * GridOverlay component - visual grid showing 24 columns
 */

import React from 'react';
import { GRID_COLUMNS } from '../../layout/geometry/grid';

interface GridOverlayProps {
  containerWidth: number;
  containerHeight: number;
  gridUnitHeight: number;
  visible?: boolean;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({
  containerWidth,
  containerHeight,
  gridUnitHeight,
  visible = true,
}) => {
  if (!visible) {
    return null;
  }

  const columnWidth = containerWidth / GRID_COLUMNS;
  const numRows = Math.ceil(containerHeight / gridUnitHeight);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent ${columnWidth - 1}px,
            rgba(156, 163, 175, 0.1) ${columnWidth - 1}px,
            rgba(156, 163, 175, 0.1) ${columnWidth}px
          ),
          repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent ${gridUnitHeight - 1}px,
            rgba(156, 163, 175, 0.1) ${gridUnitHeight - 1}px,
            rgba(156, 163, 175, 0.1) ${gridUnitHeight}px
          )
        `,
      }}
    />
  );
};

