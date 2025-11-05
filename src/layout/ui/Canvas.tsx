/**
 * Canvas component - main container for draggable dashboard panels
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay as DndKitDragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { GridOverlay } from './GridOverlay';
import { PanelCard } from './PanelCard';
import { ResizePreview } from './ResizePreview';
import { useEditorStore } from '../state/editorStore';
import { cmdMovePanel, cmdResizePanel, setSelectedPanel } from '../state/commands';
import { GRID_UNIT_HEIGHT, pixelsToGrid, gridToPixels } from '../geometry/grid';
import type { GrafanaPanel, GrafanaDashboard } from '@/types/grafana-dashboard';
import type { ResizeHandle, ResizeDelta } from '../geometry/resize';
import { resizeRectFromHandle } from '../geometry/resize';
import { Card } from '@/components/ui/Card';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

interface CanvasProps {
  renderPanelContent: (panel: GrafanaPanel) => React.ReactNode;
  onDashboardChange?: (dashboard: GrafanaDashboard) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  renderPanelContent,
  onDashboardChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; gridPos: { x: number; y: number; w: number; h: number } } | null>(null);
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Resize state
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizePanelId, setResizePanelId] = useState<number | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number; gridPos: { x: number; y: number; w: number; h: number } } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number } | null>(null);

  const dashboard = useEditorStore((state) => state.dashboard);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const isEditingLayout = useEditorStore((state) => state.isEditingLayout);

  // Callback ref to measure width immediately when container mounts
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node && isEditingLayout) {
      const width = node.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    }
  }, [isEditingLayout]);

  // Enable keyboard navigation
  useKeyboardNavigation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  // Measure container width when component mounts or layout editing starts
  useEffect(() => {
    if (!isEditingLayout) {
      return;
    }

    // Use callback ref approach to measure immediately when ref is set
    const measureWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    };

    // Try immediate measurement
    measureWidth();

    // Also try after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(measureWidth, 0);

    return () => clearTimeout(timeoutId);
  }, [isEditingLayout]);

  // Update container width on resize
  useEffect(() => {
    if (!isEditingLayout) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let cleanup: (() => void) | null = null;

    // Wait for next frame to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) {
        return;
      }

      const updateWidth = () => {
        if (containerRef.current) {
          const newWidth = containerRef.current.clientWidth;
          if (newWidth > 0) {
            setContainerWidth((prevWidth) => {
              // Only update if significantly different to avoid unnecessary re-renders
              return Math.abs(newWidth - prevWidth) > 1 ? newWidth : prevWidth;
            });
          }
        }
      };

      // Initial measurement
      updateWidth();

      // Use ResizeObserver for better performance
      resizeObserver = new ResizeObserver(() => {
        updateWidth();
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // Fallback for browsers that don't support ResizeObserver
      window.addEventListener('resize', updateWidth);
      
      cleanup = () => {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        window.removeEventListener('resize', updateWidth);
      };
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) {
        cleanup();
      }
    };
  }, [isEditingLayout]);

  // Subscribe to dashboard changes
  useEffect(() => {
    if (!onDashboardChange) {
      return;
    }

    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.dashboard) {
        onDashboardChange(state.dashboard);
      }
    });

    return unsubscribe;
  }, [onDashboardChange]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Don't allow drag if we're resizing
    if (resizeHandle !== null) {
      return;
    }
    
    setActiveId(event.active.id as string);
    const panelId = parseInt(event.active.id.toString().replace('panel-', ''));
    const panel = dashboard?.panels.find((p) => p.id === panelId);
    if (panel && containerRef.current) {
      // Store initial panel grid position
      setDragStartPos({ x: panel.gridPos.x, y: panel.gridPos.y });
      setDragPreview({
        x: panel.gridPos.x,
        y: panel.gridPos.y,
        gridPos: panel.gridPos,
      });
      
      // Capture initial mouse position
      const handleInitialMouseMove = (e: MouseEvent) => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          mouseStartRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          window.removeEventListener('mousemove', handleInitialMouseMove);
        }
      };
      window.addEventListener('mousemove', handleInitialMouseMove);
    }
  }, [dashboard, resizeHandle]);

  // Track mouse movement during drag
  useEffect(() => {
    if (!activeId || !dragStartPos || !containerRef.current || !dashboard) {
      mouseStartRef.current = null;
      return;
    }

    const panelId = parseInt(activeId.toString().replace('panel-', ''));
    const panel = dashboard.panels.find((p) => p.id === panelId);
    if (!panel) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !mouseStartRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const deltaX = mouseX - mouseStartRef.current.x;
      const deltaY = mouseY - mouseStartRef.current.y;

      // Convert delta pixels to grid units
      const gridDeltaX = (deltaX / containerWidth) * 24;
      const gridDeltaY = deltaY / GRID_UNIT_HEIGHT;

      const initialX = dragStartPos.x;
      const initialY = dragStartPos.y;

      const newX = Math.round(initialX + gridDeltaX);
      const newY = Math.round(initialY + gridDeltaY);

      setDragPreview({
        x: newX,
        y: newY,
        gridPos: { ...panel.gridPos, x: newX, y: newY },
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      mouseStartRef.current = null;
    };
  }, [activeId, dragStartPos, containerWidth, dashboard]);

  const handleDragOver = useCallback(() => {
    // Visual transform is handled by useDraggable
    // Position calculation is handled by mousemove listener
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!dashboard || !dragPreview) {
        setActiveId(null);
        setDragPreview(null);
        setDragStartPos(null);
        return;
      }

      const panelId = parseInt(event.active.id.toString().replace('panel-', ''));
      const panel = dashboard.panels.find((p) => p.id === panelId);

      if (!panel) {
        setActiveId(null);
        setDragPreview(null);
        setDragStartPos(null);
        return;
      }

      // Use the preview position (already calculated from mouse movement)
      cmdMovePanel(panelId, dragPreview.x, dragPreview.y);

      setActiveId(null);
      setDragPreview(null);
      setDragStartPos(null);
    },
    [dashboard, dragPreview]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (panelId: number, handle: ResizeHandle, e: React.PointerEvent) => {
      // Don't allow resize if we're dragging
      if (activeId !== null) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const panel = dashboard?.panels.find((p) => p.id === panelId);
      if (!panel || !containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      resizeStartRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      setResizeHandle(handle);
      setResizePanelId(panelId);
      setResizeStartPos({
        x: (panel.gridPos.x / 24) * containerWidth,
        y: panel.gridPos.y * GRID_UNIT_HEIGHT,
        gridPos: panel.gridPos,
      });
      setResizePreview(panel.gridPos);

      // Capture pointer
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [dashboard, containerWidth, activeId]
  );

  // Handle resize move
  useEffect(() => {
    if (!resizeHandle || !resizePanelId || !resizeStartPos || !resizeStartRef.current || !containerRef.current || !dashboard) {
      return;
    }

    const panel = dashboard.panels.find((p) => p.id === resizePanelId);
    if (!panel) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current || !resizeStartRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const deltaX = currentX - resizeStartRef.current.x;
      const deltaY = currentY - resizeStartRef.current.y;

      const delta: ResizeDelta = { x: deltaX, y: deltaY };

      // Calculate preview rect
      const previewRect = resizeRectFromHandle(
        resizeStartPos.gridPos,
        resizeHandle,
        delta,
        containerWidth,
        panel.type
      );

      setResizePreview(previewRect);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!resizeHandle || !resizePanelId || !resizeStartPos || !resizeStartRef.current || !containerRef.current || !dashboard) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const deltaX = currentX - resizeStartRef.current.x;
      const deltaY = currentY - resizeStartRef.current.y;

      const delta: ResizeDelta = { x: deltaX, y: deltaY };

      // Commit resize
      cmdResizePanel(resizePanelId, resizeHandle, delta, containerWidth);

      // Release pointer
      if (e.target instanceof HTMLElement) {
        e.target.releasePointerCapture(e.pointerId);
      }

      // Reset resize state
      setResizeHandle(null);
      setResizePanelId(null);
      setResizeStartPos(null);
      setResizePreview(null);
      resizeStartRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      resizeStartRef.current = null;
    };
  }, [resizeHandle, resizePanelId, resizeStartPos, containerWidth, dashboard]);

  if (!dashboard || !isEditingLayout) {
    return null;
  }

  const maxY = Math.max(...dashboard.panels.map((p) => p.gridPos.y + p.gridPos.h), 0);
  const canvasHeight = (maxY + 2) * GRID_UNIT_HEIGHT;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={setContainerRef}
        data-canvas-container
        className="relative w-full overflow-auto bg-gray-50"
        style={{ minHeight: '100vh', height: canvasHeight, width: '100%' }}
      >
        <GridOverlay
          containerWidth={containerWidth || 1200}
          containerHeight={canvasHeight}
          gridUnitHeight={GRID_UNIT_HEIGHT}
          visible={isEditingLayout && containerWidth > 0}
        />

        {containerWidth > 0 && dashboard.panels
          .filter((panel) => panel.id)
          .sort((a, b) => {
            // Sort by y, then x for consistent rendering order
            if (a.gridPos.y !== b.gridPos.y) {
              return a.gridPos.y - b.gridPos.y;
            }
            return a.gridPos.x - b.gridPos.x;
          })
          .map((panel) => (
            <PanelCard
              key={panel.id}
              panel={panel}
              containerWidth={containerWidth}
              gridUnitHeight={GRID_UNIT_HEIGHT}
              isSelected={selectedPanelId === panel.id}
              isEditingLayout={isEditingLayout}
              onSelect={setSelectedPanel}
              onResizeStart={(handle, e) => handleResizeStart(panel.id!, handle, e)}
              renderContent={renderPanelContent}
            />
          ))}

        {/* Resize Preview */}
        {resizePreview && resizePanelId && (
          <ResizePreview
            gridPos={resizePreview}
            containerWidth={containerWidth}
            containerHeight={canvasHeight}
          />
        )}

        <DndKitDragOverlay>
          {activeId && dragPreview ? (
            <Card
              className="opacity-80 shadow-2xl"
              style={{
                width: `${(dragPreview.gridPos.w / 24) * containerWidth}px`,
                height: `${dragPreview.gridPos.h * GRID_UNIT_HEIGHT}px`,
              }}
            >
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {dragPreview.x}, {dragPreview.y} | {dragPreview.gridPos.w}×{dragPreview.gridPos.h}
                </div>
                <div className="text-sm">Dragging...</div>
              </div>
            </Card>
          ) : null}
        </DndKitDragOverlay>
      </div>
    </DndContext>
  );
};

