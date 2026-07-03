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

      // Match by physical key position (event.code) so the shortcut fires on
      // non-US layouts (e.g. Cyrillic), where event.key for the Z/Y keys isn't
      // 'z'/'y'. Fall back to event.key where code isn't populated.
      const key = event.key.toLowerCase();
      const isZ = event.code === 'KeyZ' || key === 'z';
      const isY = event.code === 'KeyY' || key === 'y';
      const isUndo = isZ && !event.shiftKey;
      const isRedo = (isZ && event.shiftKey) || isY;
      if (!isUndo && !isRedo) {
        return;
      }

      if (shouldIgnore(event)) {
        return;
      }

      // We own undo/redo in edit mode: suppress the browser's native undo even
      // when our stack is empty, so Cmd/Ctrl+Z can't revert something unrelated
      // on the page. Read the store lazily so we act on the freshest stacks;
      // store.undo()/redo() are no-ops when their stack is empty.
      event.preventDefault();
      const store = useEditorStore.getState();
      if (isUndo) {
        store.undo();
      } else {
        store.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing]);
}
