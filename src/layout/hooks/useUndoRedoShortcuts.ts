/**
 * Undo/redo keyboard shortcuts for layout editing (DO-291).
 *
 * Ctrl/Cmd+Z        → undo
 * Ctrl/Cmd+Shift+Z  → redo
 * Ctrl+Y            → redo (Windows convention)
 *
 * Active only while in layout edit mode. Unlike useKeyboardNavigation these
 * shortcuts don't require a selected panel — undo should work regardless of
 * selection. Native undo is left alone while typing in a field/code editor or
 * when a modal owns the keyboard.
 */

import { useEffect } from 'react';
import { useEditorStore } from '../state/editorStore';

function shouldIgnore(event: KeyboardEvent): boolean {
  // A modal (Full Schema, Panel Gallery, Filters, Delete, New Row…) is open —
  // let it own the keyboard rather than mutating the canvas underneath it.
  if (document.querySelector('[role="dialog"]')) {
    return true;
  }

  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }

  // Don't hijack the browser's native text undo while typing.
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    target.closest('.monaco-editor') !== null
  );
}

export function useUndoRedoShortcuts() {
  const isEditing = useEditorStore((state) => state.isEditingLayout);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) {
        return;
      }

      if (shouldIgnore(event)) {
        return;
      }

      // Read the store lazily so we act on the freshest stacks.
      const store = useEditorStore.getState();
      if (isUndo && store.undoStack.length > 0) {
        event.preventDefault();
        store.undo();
      } else if (isRedo && store.redoStack.length > 0) {
        event.preventDefault();
        store.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing]);
}
