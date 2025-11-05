/**
 * PanelCard component - individual draggable panel card
 */

import React, { useState } from 'react';
import { DraggablePanel } from './DragOverlay';
import { ResizeHandles } from './ResizeHandles';
import type { GrafanaPanel } from '@/types/grafana-dashboard';
import type { ResizeHandle } from '../geometry/resize';
import { pixelsToGrid, gridToPixels, GRID_UNIT_HEIGHT } from '../../layout/geometry/grid';
import { Button } from '@/components/ui/button';
import { Copy, Pencil } from 'lucide-react';
import { cmdDuplicatePanel } from '../state/commands';

interface PanelCardProps {
  panel: GrafanaPanel;
  containerWidth: number;
  gridUnitHeight?: number;
  isSelected?: boolean;
  isEditingLayout?: boolean;
  onSelect?: (panelId: number) => void;
  onResizeStart?: (handle: ResizeHandle, e: React.PointerEvent) => void;
  onEditPanel?: (panel: GrafanaPanel) => void;
  renderContent: (panel: GrafanaPanel) => React.ReactNode;
  customTop?: number; // Optional custom top position (for panels inside rows)
}

export const PanelCard: React.FC<PanelCardProps> = ({
  panel,
  containerWidth,
  gridUnitHeight = GRID_UNIT_HEIGHT,
  isSelected = false,
  isEditingLayout = false,
  onSelect,
  onResizeStart,
  onEditPanel,
  renderContent,
  customTop,
}) => {
  const [isHovered, setIsHovered] = useState(false);
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
  
  // Grafana-style spacing: add margins for visual spacing
  // Panels remain back-to-back in grid coordinates, but CSS positioning creates visual gaps
  const PANEL_SPACING = 8; // px - matches Grafana's visual spacing (~8-10px)
  // Adjust width/height to account for spacing (half spacing on each side)
  const adjustedWidth = panelWidth - PANEL_SPACING;
  const adjustedHeight = panelHeight - PANEL_SPACING;
  
  // Use custom top if provided (for panels inside rows), otherwise use calculated position with spacing
  const topPosition = customTop !== undefined 
    ? customTop 
    : panelPos.y + PANEL_SPACING / 2;

  // Debug logging removed to prevent excessive console output
  // Uncomment for debugging:
  // if (process.env.NODE_ENV === 'development') {
  //   console.log(`Panel ${panel.id} (${panel.title}):`, {
  //     gridPos: panel.gridPos,
  //     pixelPos: panelPos,
  //     pixelSize: { width: panelWidth, height: panelHeight },
  //     containerWidth,
  //   });
  // }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${panelPos.x + PANEL_SPACING / 2}px`,
        top: `${topPosition}px`,
        width: `${adjustedWidth}px`,
        height: `${adjustedHeight}px`,
        zIndex: 1,
        boxSizing: 'border-box',
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
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex-1 overflow-auto p-4">{renderContent(panel)}</div>
          
          {/* Edit button - shown on hover in edit mode, always in same position */}
          {isEditingLayout && onEditPanel && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                className={`h-7 w-7 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-opacity rounded-sm flex items-center justify-center ${
                  isHovered || isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPanel(panel);
                }}
                title="Edit panel"
              >
                <Pencil className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
              </button>
            </div>
          )}
          
          {/* Selected panel controls - duplicate button */}
          {isEditingLayout && isSelected && (
            <>
              <div className="absolute top-2 right-10 flex gap-1 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (panel.id) {
                      cmdDuplicatePanel(panel.id);
                    }
                  }}
                  title="Duplicate panel"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {onResizeStart && <ResizeHandles onResizeStart={onResizeStart} />}
            </>
          )}
        </div>
      </DraggablePanel>
    </div>
  );
};
