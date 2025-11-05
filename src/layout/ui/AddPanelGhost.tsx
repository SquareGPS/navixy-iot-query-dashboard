/**
 * AddPanelGhost component - shows ghost tile following cursor during panel placement
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { pixelsToGrid, gridToPixels, GRID_COLUMNS, GRID_UNIT_HEIGHT } from '../geometry/grid';
import { clampToBounds } from '../geometry/grid';

interface AddPanelGhostProps {
  containerRef: React.RefObject<HTMLDivElement>;
  containerWidth: number;
  size: { w: number; h: number };
  onPlace: (x: number, y: number) => void;
  onCancel: () => void;
}

export const AddPanelGhost: React.FC<AddPanelGhostProps> = ({
  containerRef,
  containerWidth,
  size,
  onPlace,
  onCancel,
}) => {
  const [gridPos, setGridPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update ghost position based on mouse
  useEffect(() => {
    if (!containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert to grid coordinates
      const grid = pixelsToGrid(mouseX, mouseY, containerWidth, GRID_UNIT_HEIGHT);
      
      // Clamp to valid bounds
      const clamped = clampToBounds({ ...grid, ...size });
      
      setGridPos({ x: clamped.x, y: clamped.y });
    };

    const handleClick = (e: MouseEvent) => {
      // Only handle clicks within the container
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if click is within container bounds
      if (mouseX >= 0 && mouseX <= rect.width && mouseY >= 0 && mouseY <= rect.height) {
        e.preventDefault();
        e.stopPropagation();
        onPlace(gridPos.x, gridPos.y);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onPlace(gridPos.x, gridPos.y);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setGridPos((prev) => clampToBounds({ ...prev, x: Math.max(0, prev.x - 1), ...size }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setGridPos((prev) => clampToBounds({ ...prev, x: Math.min(GRID_COLUMNS - size.w, prev.x + 1), ...size }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setGridPos((prev) => clampToBounds({ ...prev, y: Math.max(0, prev.y - 1), ...size }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setGridPos((prev) => clampToBounds({ ...prev, y: Math.max(0, prev.y + 1), ...size }));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, containerWidth, size, gridPos, onPlace, onCancel]);

  // Convert grid position to pixel position for display
  const pixelPos = gridToPixels(gridPos.x, gridPos.y, containerWidth, GRID_UNIT_HEIGHT);
  const pixelWidth = (size.w / GRID_COLUMNS) * containerWidth;
  const pixelHeight = size.h * GRID_UNIT_HEIGHT;

  if (!containerRef.current) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: `${pixelPos.x}px`,
        top: `${pixelPos.y}px`,
        width: `${pixelWidth}px`,
        height: `${pixelHeight}px`,
      }}
    >
      <Card className="w-full h-full border-2 border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-950/50 opacity-80">
        <div className="absolute top-2 left-2 text-xs font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded shadow">
          {gridPos.x}, {gridPos.y} | {size.w}×{size.h}
        </div>
        <div className="absolute bottom-2 left-2 right-2 text-xs text-center text-muted-foreground">
          Click to place • Arrow keys to move • Enter to confirm • Esc to cancel
        </div>
      </Card>
    </div>
  );
};

