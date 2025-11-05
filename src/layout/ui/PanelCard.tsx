/**
 * PanelCard component - individual draggable panel card
 */

import React from 'react';
import { DraggablePanel } from './DragOverlay';
import { ResizeHandles } from './ResizeHandles';
import type { GrafanaPanel } from '@/types/grafana-dashboard';
import type { ResizeHandle } from '../geometry/resize';
import { pixelsToGrid, gridToPixels, GRID_UNIT_HEIGHT } from '../../layout/geometry/grid';

interface PanelCardProps {
  panel: GrafanaPanel;
  containerWidth: number;
  gridUnitHeight?: number;
  isSelected?: boolean;
  isEditingLayout?: boolean;
  onSelect?: (panelId: number) => void;
  onResizeStart?: (handle: ResizeHandle, e: React.PointerEvent) => void;
  renderContent: (panel: GrafanaPanel) => React.ReactNode;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  panel,
  containerWidth,
  gridUnitHeight = GRID_UNIT_HEIGHT,
  isSelected = false,
  isEditingLayout = false,
  onSelect,
  onResizeStart,
  renderContent,
}) => {
  if (!panel.id) {
    return null;
  }

  const panelPos = gridToPixels(
    panel.gridPos.x,
    panel.gridPos.y,
    containerWidth,
    gridUnitHeight
  );

  const panelWidth = (panel.gridPos.w / 24) * containerWidth;
  const panelHeight = panel.gridPos.h * gridUnitHeight;

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Panel ${panel.id} (${panel.title}):`, {
      gridPos: panel.gridPos,
      pixelPos: panelPos,
      pixelSize: { width: panelWidth, height: panelHeight },
      containerWidth,
    });
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${panelPos.x}px`,
        top: `${panelPos.y}px`,
        width: `${panelWidth}px`,
        height: `${panelHeight}px`,
        zIndex: 1,
      }}
    >
      <DraggablePanel
        panelId={panel.id}
        gridPos={panel.gridPos}
      >
        <div
          className={`relative transition-shadow bg-[var(--surface-2)] border border-[var(--border)] rounded-md ring-1 ring-inset ring-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${
            isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
          }`}
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => onSelect?.(panel.id!)}
        >
          <div className="flex-1 overflow-auto p-4">{renderContent(panel)}</div>
          {isEditingLayout && isSelected && onResizeStart && (
            <ResizeHandles onResizeStart={onResizeStart} />
          )}
        </div>
      </DraggablePanel>
    </div>
  );
};
