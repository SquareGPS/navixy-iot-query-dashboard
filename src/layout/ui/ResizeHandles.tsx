/**
 * ResizeHandles component - renders resize handles for panels
 */

import React from 'react';
import type { ResizeHandle } from '../geometry/resize';

interface ResizeHandlesProps {
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
  visible?: boolean;
}

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;

const HANDLE_STYLES: Record<ResizeHandle, React.CSSProperties> = {
  n: {
    top: -HANDLE_OFFSET,
    left: '50%',
    transform: 'translateX(-50%)',
    cursor: 'ns-resize',
  },
  s: {
    bottom: -HANDLE_OFFSET,
    left: '50%',
    transform: 'translateX(-50%)',
    cursor: 'ns-resize',
  },
  e: {
    right: -HANDLE_OFFSET,
    top: '50%',
    transform: 'translateY(-50%)',
    cursor: 'ew-resize',
  },
  w: {
    left: -HANDLE_OFFSET,
    top: '50%',
    transform: 'translateY(-50%)',
    cursor: 'ew-resize',
  },
  ne: {
    top: -HANDLE_OFFSET,
    right: -HANDLE_OFFSET,
    cursor: 'nesw-resize',
  },
  nw: {
    top: -HANDLE_OFFSET,
    left: -HANDLE_OFFSET,
    cursor: 'nwse-resize',
  },
  se: {
    bottom: -HANDLE_OFFSET,
    right: -HANDLE_OFFSET,
    cursor: 'nwse-resize',
  },
  sw: {
    bottom: -HANDLE_OFFSET,
    left: -HANDLE_OFFSET,
    cursor: 'nesw-resize',
  },
};

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  onResizeStart,
  visible = true,
}) => {
  if (!visible) {
    return null;
  }

  const handles: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  const handlePointerDown = (handle: ResizeHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(handle, e);
  };

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle}
          className="absolute bg-blue-500 border-2 border-white rounded-full hover:bg-blue-600 transition-colors z-10"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            ...HANDLE_STYLES[handle],
          }}
          onPointerDown={(e) => handlePointerDown(handle, e)}
        />
      ))}
    </>
  );
};

