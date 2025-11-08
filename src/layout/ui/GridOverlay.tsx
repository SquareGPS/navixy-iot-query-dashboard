/**
 * GridOverlay component - visual grid showing 24 columns
 */

import React from 'react';
import { useTheme } from 'next-themes';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!visible) {
    return null;
  }

  const columnWidth = containerWidth / GRID_COLUMNS;
  const numRows = Math.ceil(containerHeight / gridUnitHeight);

  // Grid line colors: lighter in dark mode for better visibility
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(156, 163, 175, 0.1)';

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent ${columnWidth - 1}px,
            ${gridColor} ${columnWidth - 1}px,
            ${gridColor} ${columnWidth}px
          ),
          repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent ${gridUnitHeight - 1}px,
            ${gridColor} ${gridUnitHeight - 1}px,
            ${gridColor} ${gridUnitHeight}px
          )
        `,
      }}
    />
  );
};

