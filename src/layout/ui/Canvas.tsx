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
import { RowHeader } from './RowHeader';
import { RowDropPocket } from './RowDropPocket';
import { useEditorStore } from '../state/editorStore';
import { cmdMovePanel, cmdResizePanel, cmdReorderRows, cmdMovePanelToRow, cmdMoveRow, setSelectedPanel, cmdAddPanel } from '../state/commands';
import { GRID_UNIT_HEIGHT, pixelsToGrid, gridToPixels } from '../geometry/grid';
import type { GrafanaPanel, GrafanaDashboard } from '@/types/grafana-dashboard';
import type { ResizeHandle, ResizeDelta } from '../geometry/resize';
import { resizeRectFromHandle } from '../geometry/resize';
import { getRowHeaders, computeBands, isRowPanel, scopeOf } from '../geometry/rows';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { PanelGallery } from './PanelGallery';
import { AddPanelGhost } from './AddPanelGhost';

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

  // Use a more specific selector to ensure re-renders when panels change
  const dashboard = useEditorStore((state) => state.dashboard);
  const dashboardPanelsLength = useEditorStore((state) => state.dashboard?.panels.length ?? 0);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const isEditingLayout = useEditorStore((state) => state.isEditingLayout);
  
  // Debug: Log when dashboard changes
  useEffect(() => {
    console.log('Canvas: Dashboard changed, panels count:', dashboard?.panels.length);
  }, [dashboard, dashboardPanelsLength]);

  // Add panel state
  const [showPanelGallery, setShowPanelGallery] = useState(false);
  const [isPlacingPanel, setIsPlacingPanel] = useState(false);
  const [placingPanelSpec, setPlacingPanelSpec] = useState<{ type: string; size: { w: number; h: number } } | null>(null);

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
    const activeIdStr = event.active.id.toString();
    
    // Check if it's a row header
    if (activeIdStr.startsWith('row-')) {
      const rowId = parseInt(activeIdStr.replace('row-', ''));
      const row = dashboard?.panels.find((p) => isRowPanel(p) && p.id === rowId);
      if (row && containerRef.current) {
        setDragStartPos({ x: row.gridPos.x, y: row.gridPos.y });
        setDragPreview({
          x: row.gridPos.x,
          y: row.gridPos.y,
          gridPos: row.gridPos,
        });
        
        // Capture initial mouse position for row dragging
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
      return;
    }
    
    // Regular panel drag
    const panelId = parseInt(activeIdStr.replace('panel-', ''));
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

    const activeIdStr = activeId.toString();
    
    // Handle row dragging
    if (activeIdStr.startsWith('row-')) {
      const rowId = parseInt(activeIdStr.replace('row-', ''));
      const row = dashboard.panels.find((p) => isRowPanel(p) && p.id === rowId);
      if (!row) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current || !mouseStartRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        const deltaY = mouseY - mouseStartRef.current.y;

        // Convert delta pixels to grid units
        const gridDeltaY = deltaY / GRID_UNIT_HEIGHT;

        const initialY = dragStartPos.y;
        const newY = Math.max(0, Math.round(initialY + gridDeltaY));

        setDragPreview({
          x: row.gridPos.x,
          y: newY,
          gridPos: { ...row.gridPos, y: newY },
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        mouseStartRef.current = null;
      };
    }

    // Handle panel dragging
    const panelId = parseInt(activeIdStr.replace('panel-', ''));
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

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Visual transform is handled by useDraggable
    // Position calculation is handled by mousemove listener
    // Check if we're hovering over a row header
    if (!event.over || !dashboard) return;
    
    const overId = event.over.id.toString();
    if (overId.startsWith('row-')) {
      const rowId = parseInt(overId.replace('row-', ''));
      const row = dashboard.panels.find((p) => isRowPanel(p) && p.id === rowId);
      if (row && isRowPanel(row)) {
        // Could show drop zone indicator here
      }
    }
  }, [dashboard]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!dashboard) {
        setActiveId(null);
        setDragPreview(null);
        setDragStartPos(null);
        return;
      }

      const activeIdStr = event.active.id.toString();

      // Handle row dragging
      if (activeIdStr.startsWith('row-')) {
        const draggedRowId = parseInt(activeIdStr.replace('row-', ''));
        
        if (event.over && event.over.id.toString().startsWith('row-')) {
          // Dropped on another row - reorder
          const targetRowId = parseInt(event.over.id.toString().replace('row-', ''));
          if (draggedRowId !== targetRowId) {
            const rows = getRowHeaders(dashboard.panels);
            const currentOrder = rows.map((r) => r.id!);
            const draggedIndex = currentOrder.indexOf(draggedRowId);
            const targetIndex = currentOrder.indexOf(targetRowId);
            
            if (draggedIndex !== -1 && targetIndex !== -1) {
              const newOrder = [...currentOrder];
              newOrder.splice(draggedIndex, 1);
              newOrder.splice(targetIndex, 0, draggedRowId);
              cmdReorderRows(newOrder);
            }
          }
        } else if (dragPreview) {
          // Dropped at arbitrary position - move row to new Y position
          cmdMoveRow(draggedRowId, dragPreview.y);
        }
        
        setActiveId(null);
        setDragPreview(null);
        setDragStartPos(null);
        return;
      }

      // Handle panel drag
      if (!dragPreview) {
        setActiveId(null);
        setDragPreview(null);
        setDragStartPos(null);
        return;
      }

      const panelId = parseInt(activeIdStr.replace('panel-', ''));
      const panel = dashboard.panels.find((p) => p.id === panelId);

      if (!panel) {
        setActiveId(null);
        setDragPreview(null);
        setDragStartPos(null);
        return;
      }

      // Check if dropped over a row pocket (preferred) or row header (fallback)
      if (event.over) {
        const overId = event.over.id.toString();
        if (overId.startsWith('row-pocket-')) {
          // Dropped on row pocket - move to row
          const targetRowId = parseInt(overId.replace('row-pocket-', ''));
          cmdMovePanelToRow(panelId, targetRowId);
        } else if (overId.startsWith('row-')) {
          // Dropped on row header - also move to row (fallback)
          const targetRowId = parseInt(overId.replace('row-', ''));
          cmdMovePanelToRow(panelId, targetRowId);
        } else {
          // Regular move (top-level)
          cmdMovePanel(panelId, dragPreview.x, dragPreview.y);
        }
      } else {
        // Regular move (top-level)
        cmdMovePanel(panelId, dragPreview.x, dragPreview.y);
      }

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

  // Ensure we have the latest dashboard from the store
  const rows = getRowHeaders(dashboard.panels);
  const bands = computeBands(dashboard.panels);
  
  // Get top-level panels (excluding nested children of collapsed rows)
  const collapsedRowChildIds = new Set<number>();
  rows.forEach((row) => {
    if (row.collapsed === true && row.panels) {
      row.panels.forEach((p) => {
        if (p.id) collapsedRowChildIds.add(p.id);
      });
    }
  });

  const topLevelPanels = dashboard.panels.filter(
    (p) => p.id && !collapsedRowChildIds.has(p.id)
  );

  const maxY = Math.max(...dashboard.panels.map((p) => p.gridPos.y + p.gridPos.h), 0);
  const canvasHeight = (maxY + 2) * GRID_UNIT_HEIGHT;

  const handleRowReorder = useCallback((rowId: number, direction: 'up' | 'down') => {
    if (!dashboard) return;
    const currentRows = getRowHeaders(dashboard.panels);
    const currentOrder = currentRows.map((r) => r.id!);
    const index = currentOrder.indexOf(rowId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      cmdReorderRows(newOrder);
    } else if (direction === 'down' && index < currentOrder.length - 1) {
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      cmdReorderRows(newOrder);
    }
  }, [dashboard]);

  const handlePanelGallerySelect = useCallback((type: string, size: { w: number; h: number }) => {
    setPlacingPanelSpec({ type, size });
    setIsPlacingPanel(true);
    setShowPanelGallery(false);
  }, []);

  const handleGhostPlace = useCallback((x: number, y: number) => {
    if (!placingPanelSpec || !dashboard) return;

    // Determine target scope (for now, always top-level)
    // TODO: Support row targeting when hovering row headers
    cmdAddPanel({
      type: placingPanelSpec.type,
      size: placingPanelSpec.size,
      target: 'top',
      hint: { position: { x, y } },
    });

    setIsPlacingPanel(false);
    setPlacingPanelSpec(null);
  }, [placingPanelSpec, dashboard]);

  const handleGhostCancel = useCallback(() => {
    setIsPlacingPanel(false);
    setPlacingPanelSpec(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowPanelGallery(true)}
            disabled={isPlacingPanel}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Panel
          </Button>
        </div>
      </div>

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

        {/* Row Bands - Visual indication for expanded rows */}
        {bands.map((band) => {
          const bandTop = band.top * GRID_UNIT_HEIGHT;
          const bandBottom = band.bottom === Infinity 
            ? canvasHeight 
            : band.bottom * GRID_UNIT_HEIGHT;
          const bandHeight = bandBottom - bandTop;
          
          return (
            <div
              key={`band-${band.rowId}`}
              className="absolute left-0 right-0 pointer-events-none border-l-4 border-blue-400 bg-blue-50/30"
              style={{
                top: `${bandTop}px`,
                height: `${bandHeight}px`,
                zIndex: 0,
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 opacity-50" />
            </div>
          );
        })}

        {/* Row Headers */}
        {containerWidth > 0 && rows.map((row) => {
          if (!row.id) return null;
          
          const rowPos = gridToPixels(row.gridPos.x, row.gridPos.y, containerWidth, GRID_UNIT_HEIGHT);
          const rowWidth = (row.gridPos.w / 24) * containerWidth;
          const rowHeight = row.gridPos.h * GRID_UNIT_HEIGHT;
          const headerHeight = row.gridPos.h * GRID_UNIT_HEIGHT;

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
                zIndex: 10,
              }}
            >
              <RowHeader
                row={row}
                containerWidth={adjustedWidth}
                isSelected={selectedPanelId === row.id}
                onSelect={setSelectedPanel}
                onReorder={(dir) => handleRowReorder(row.id!, dir)}
              />
              <RowDropPocket
                rowId={row.id}
                isCollapsed={row.collapsed === true}
                visible={isEditingLayout}
                headerHeight={headerHeight}
                containerWidth={adjustedWidth}
              />
            </div>
          );
        })}

        {/* Top-level Panels - Group by row bands */}
        {containerWidth > 0 && (() => {
          // Separate panels into bands and top-level
          const bandPanels = new Map<number, GrafanaPanel[]>();
          const topLevelOnlyPanels: GrafanaPanel[] = [];
          
          topLevelPanels
            .filter((panel) => !isRowPanel(panel) && panel.id)
            .forEach((panel) => {
              // Find which band this panel belongs to
              const band = bands.find((b) => 
                panel.gridPos.y >= b.top && panel.gridPos.y < b.bottom
              );
              
              if (band) {
                if (!bandPanels.has(band.rowId)) {
                  bandPanels.set(band.rowId, []);
                }
                bandPanels.get(band.rowId)!.push(panel);
              } else {
                topLevelOnlyPanels.push(panel);
              }
            });
          
          return (
            <>
              {/* Render panels within bands */}
              {Array.from(bandPanels.entries()).map(([rowId, bandPanelsList]) => {
                const row = rows.find((r) => r.id === rowId);
                const band = bands.find((b) => b.rowId === rowId);
                if (!row || !band) return null;
                
                return (
                  <React.Fragment key={`band-panels-${rowId}`}>
                    {bandPanelsList
                      .sort((a, b) => {
                        if (a.gridPos.y !== b.gridPos.y) {
                          return a.gridPos.y - b.gridPos.y;
                        }
                        return a.gridPos.x - b.gridPos.x;
                      })
                      .map((panel) => {
                        // Calculate panel position
                        const panelPos = gridToPixels(
                          panel.gridPos.x,
                          panel.gridPos.y,
                          containerWidth,
                          GRID_UNIT_HEIGHT
                        );
                        
                        // For panels inside rows, use normal spacing calculation
                        // The panel's gridPos.y already accounts for being below the row header
                        // Just use the standard spacing calculation like other panels
                        const PANEL_SPACING = 8;
                        const adjustedTop = panelPos.y + PANEL_SPACING / 2;
                        
                        return (
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
                            customTop={adjustedTop}
                          />
                        );
                      })}
                  </React.Fragment>
                );
              })}
              
              {/* Render top-level panels (not in any band) */}
              {topLevelOnlyPanels
                .sort((a, b) => {
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
            </>
          );
        })()}

        {/* Collapsed Row Children - Render separately if needed */}
        {containerWidth > 0 && rows
          .filter((row) => row.collapsed === true && row.panels && row.panels.length > 0)
          .map((row) => {
            if (!row.id || !row.panels) return null;
            
            // For collapsed rows, children are not rendered in the main canvas
            // They're only visible when the row is expanded
            return null;
          })}

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

        {/* Add Panel Ghost */}
        {isPlacingPanel && placingPanelSpec && containerWidth > 0 && (
          <AddPanelGhost
            containerRef={containerRef}
            containerWidth={containerWidth}
            size={placingPanelSpec.size}
            onPlace={handleGhostPlace}
            onCancel={handleGhostCancel}
          />
        )}
      </div>

      {/* Panel Gallery Dialog */}
      <PanelGallery
        open={showPanelGallery}
        onClose={() => setShowPanelGallery(false)}
        onSelect={handlePanelGallerySelect}
      />
    </DndContext>
  );
};

