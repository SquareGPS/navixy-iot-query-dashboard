/**
 * PanelGrid - Shared component for rendering panels using Grafana's 24-column grid
 * Used in both view mode and edit mode to ensure consistent sizing
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { GrafanaPanel } from '@/types/grafana-dashboard';
import { gridToPixels, GRID_UNIT_HEIGHT } from '@/layout/geometry/grid';
import { Card } from '@/components/ui/card';
import { isRowPanel, getRowHeaders } from '@/layout/geometry/rows';
import { RowHeader } from './RowHeader';
import { DndContext } from '@dnd-kit/core';

interface PanelGridProps {
  panels: GrafanaPanel[];
  renderPanel: (panel: GrafanaPanel) => React.ReactNode;
  containerClassName?: string;
  enableDrag?: boolean;
  selectedPanelId?: number | null;
  onSelectPanel?: (panelId: number) => void;
  editMode?: boolean;
  onEditPanel?: (panel: GrafanaPanel) => void;
}

export const PanelGrid: React.FC<PanelGridProps> = ({
  panels,
  renderPanel,
  containerClassName = '',
  enableDrag = false,
  selectedPanelId,
  onSelectPanel,
  editMode = false,
  onEditPanel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width
  const measureWidth = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    }
  }, []);

  useEffect(() => {
    measureWidth();

    const resizeObserver = new ResizeObserver(() => {
      measureWidth();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', measureWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureWidth);
    };
  }, [measureWidth]);

  const maxY = Math.max(...panels.map((p) => p.gridPos.y + p.gridPos.h), 0);
  const canvasHeight = (maxY + 2) * GRID_UNIT_HEIGHT;

  // Filter out row panels and collapsed row children
  const rows = getRowHeaders(panels);
  const collapsedRowChildIds = new Set<number>();
  rows.forEach((row) => {
    if (row.collapsed === true && row.panels) {
      row.panels.forEach((p) => {
        if (p.id) collapsedRowChildIds.add(p.id);
      });
    }
  });

  const visiblePanels = panels.filter(
    (panel) => panel.id && !isRowPanel(panel) && !collapsedRowChildIds.has(panel.id)
  );

  if (containerWidth === 0) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full ${containerClassName}`}
        style={{ minHeight: '200px' }}
      />
    );
  }

  return (
    <DndContext>
      <div
        ref={containerRef}
        className={`relative w-full ${containerClassName}`}
        style={{ minHeight: canvasHeight }}
      >
      {/* Render Row Headers */}
      {rows.map((row) => {
        if (!row.id) return null;
        
        const rowPos = gridToPixels(
          row.gridPos.x,
          row.gridPos.y,
          containerWidth,
          GRID_UNIT_HEIGHT
        );
        const rowWidth = (row.gridPos.w / 24) * containerWidth;
        const rowHeight = row.gridPos.h * GRID_UNIT_HEIGHT;

        // Grafana-style spacing: add margins for visual spacing (same as panels)
        const PANEL_SPACING = 8; // px - matches Grafana's visual spacing (~8-10px)
        // Adjust width/height to account for spacing (half spacing on each side)
        const adjustedWidth = rowWidth - PANEL_SPACING;
        const adjustedHeight = rowHeight - PANEL_SPACING;

        return (
          <div
            key={`row-${row.id}`}
            style={{
              position: 'absolute',
              left: `${rowPos.x + PANEL_SPACING / 2}px`,
              top: `${rowPos.y + PANEL_SPACING / 2}px`,
              width: `${adjustedWidth}px`,
              height: `${adjustedHeight}px`,
              zIndex: 2,
            }}
          >
            <RowHeader
              row={row}
              containerWidth={adjustedWidth}
              isSelected={selectedPanelId === row.id}
              onSelect={onSelectPanel}
              enableDrag={false}
              enableEditControls={editMode}
            />
          </div>
        );
      })}
      
      {/* Render Panels */}
      {visiblePanels
        .sort((a, b) => {
          if (a.gridPos.y !== b.gridPos.y) {
            return a.gridPos.y - b.gridPos.y;
          }
          return a.gridPos.x - b.gridPos.x;
        })
        .map((panel) => {
          const panelPos = gridToPixels(
            panel.gridPos.x,
            panel.gridPos.y,
            containerWidth,
            GRID_UNIT_HEIGHT
          );

          const panelWidth = (panel.gridPos.w / 24) * containerWidth;
          const panelHeight = panel.gridPos.h * GRID_UNIT_HEIGHT;
          const isSelected = selectedPanelId === panel.id;
          
          // Grafana-style spacing: add margins for visual spacing
          // Panels remain back-to-back in grid coordinates, but CSS margins create visual gaps
          const PANEL_SPACING = 8; // px - matches Grafana's visual spacing (~8-10px)
          // Adjust width/height to account for margins (half spacing on each side)
          const adjustedWidth = panelWidth - PANEL_SPACING;
          const adjustedHeight = panelHeight - PANEL_SPACING;

          return (
            <div
              key={panel.id}
              style={{
                position: 'absolute',
                left: `${panelPos.x + PANEL_SPACING / 2}px`,
                top: `${panelPos.y + PANEL_SPACING / 2}px`,
                width: `${adjustedWidth}px`,
                height: `${adjustedHeight}px`,
                zIndex: 1,
                boxSizing: 'border-box',
              }}
            >
              <Card
                className={`relative group h-full flex flex-col ${
                  enableDrag ? 'cursor-move' : ''
                } ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                style={{
                  width: '100%',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
                onClick={() => onSelectPanel?.(panel.id!)}
              >
                {renderPanel(panel)}
              </Card>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
};

