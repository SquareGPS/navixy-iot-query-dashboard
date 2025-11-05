/**
 * Keyboard navigation hook for layout editing
 * Provides arrow key movement for selected panels
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '../state/editorStore';
import { cmdMovePanel, cmdResizePanel } from '../state/commands';
import type { ResizeHandle } from '../geometry/resize';
import { GRID_UNIT_HEIGHT, GRID_COLUMNS } from '../geometry/grid';

export function useKeyboardNavigation() {
  const dashboard = useEditorStore((state) => state.dashboard);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const isEditing = useEditorStore((state) => state.isEditingLayout);
  const containerWidthRef = useRef(1200); // Default, will be updated from Canvas

  // Update container width reference (can be called from Canvas)
  useEffect(() => {
    const updateWidth = () => {
      const container = document.querySelector('[data-canvas-container]') as HTMLElement;
      if (container) {
        containerWidthRef.current = container.clientWidth;
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    const container = document.querySelector('[data-canvas-container]');
    if (container) {
      observer.observe(container);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isEditing || !dashboard || !selectedPanelId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }

      const panel = dashboard.panels.find((p) => p.id === selectedPanelId);
      if (!panel) {
        return;
      }

      const containerWidth = containerWidthRef.current;
      const isShift = event.shiftKey;
      const isAlt = event.altKey;

      // Resize shortcuts
      if (isShift) {
        event.preventDefault();

        if (isAlt) {
          // Symmetric resize: Alt+Shift+Arrows
          const gridUnitWidth = containerWidth / GRID_COLUMNS;
          let deltaX = 0;
          let deltaY = 0;
          let handle: ResizeHandle = 'se';

          switch (event.key) {
            case 'ArrowLeft':
              deltaX = -gridUnitWidth;
              handle = 'w';
              break;
            case 'ArrowRight':
              deltaX = gridUnitWidth;
              handle = 'e';
              break;
            case 'ArrowUp':
              deltaY = -GRID_UNIT_HEIGHT;
              handle = 'n';
              break;
            case 'ArrowDown':
              deltaY = GRID_UNIT_HEIGHT;
              handle = 's';
              break;
          }

          if (deltaX !== 0 || deltaY !== 0) {
            cmdResizePanel(selectedPanelId, handle, { x: deltaX, y: deltaY }, containerWidth);
          }
        } else {
          // Regular resize: Shift+Arrows
          const gridUnitWidth = containerWidth / GRID_COLUMNS;
          let deltaX = 0;
          let deltaY = 0;
          let handle: ResizeHandle = 'se';

          switch (event.key) {
            case 'ArrowLeft':
              deltaX = -gridUnitWidth;
              handle = 'w';
              break;
            case 'ArrowRight':
              deltaX = gridUnitWidth;
              handle = 'e';
              break;
            case 'ArrowUp':
              deltaY = -GRID_UNIT_HEIGHT;
              handle = 'n';
              break;
            case 'ArrowDown':
              deltaY = GRID_UNIT_HEIGHT;
              handle = 's';
              break;
          }

          if (deltaX !== 0 || deltaY !== 0) {
            cmdResizePanel(selectedPanelId, handle, { x: deltaX, y: deltaY }, containerWidth);
          }
        }
        return;
      }

      // Regular arrow key movement (no modifiers)
      event.preventDefault();

      const currentX = panel.gridPos.x;
      const currentY = panel.gridPos.y;

      let newX = currentX;
      let newY = currentY;

      switch (event.key) {
        case 'ArrowUp':
          newY = Math.max(0, currentY - 1);
          break;
        case 'ArrowDown':
          newY = currentY + 1;
          break;
        case 'ArrowLeft':
          newX = Math.max(0, currentX - 1);
          break;
        case 'ArrowRight':
          newX = Math.min(24 - panel.gridPos.w, currentX + 1);
          break;
      }

      // Only move if position changed
      if (newX !== currentX || newY !== currentY) {
        cmdMovePanel(selectedPanelId, newX, newY);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dashboard, selectedPanelId, isEditing]);
}

