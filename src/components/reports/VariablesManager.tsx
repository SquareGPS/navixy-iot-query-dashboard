/**
 * VariablesManager
 *
 * Editor dialog for a dashboard's local filter variables (templating.list[]).
 * Currently supports Type 1 — date-range filters. Non-date-range template
 * variables present on the dashboard are preserved untouched on save.
 *
 * On save it hands the full, merged templating.list[] back to the parent, which
 * is responsible for persisting it onto the dashboard.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarRange, Plus, Trash2, Pencil, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Dashboard, Variable } from '@/types/dashboard-types';
import {
  DATE_RANGE_PRESETS,
  DEFAULT_DATE_RANGE,
  dateRangeDefaults,
  dateRangeParamNames,
  isValidFilterName,
  makeDateRangeVariable,
  suggestFilterName,
} from '@/utils/filterVariables';

interface VariablesManagerProps {
  open: boolean;
  onClose: () => void;
  dashboard: Dashboard | null;
  /** Receives the full, merged templating.list[] (date-range + preserved vars). */
  onSave: (variables: Variable[]) => Promise<void> | void;
}

interface EditorState {
  originalName: string | null; // null = creating a new filter
  label: string;
  name: string;
  presetId: string; // preset id, or 'custom' to keep an existing non-preset range
  nameTouched: boolean;
}

const CUSTOM_PRESET_ID = 'custom';

function isDateRange(v: Variable): boolean {
  return v['x-navixy']?.control === 'daterange';
}

/** Map a stored variable back to a preset id, or 'custom' if it doesn't match one. */
function matchPresetId(variable: Variable): string {
  const range = dateRangeDefaults(variable);
  const found = DATE_RANGE_PRESETS.find((p) => p.from === range.from && p.to === range.to);
  return found ? found.id : CUSTOM_PRESET_ID;
}

export const VariablesManager: React.FC<VariablesManagerProps> = ({
  open,
  onClose,
  dashboard,
  onSave,
}) => {
  const [list, setList] = useState<Variable[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize working copy from the dashboard each time the dialog opens.
  useEffect(() => {
    if (open) {
      setList(dashboard?.templating?.list ?? []);
      setEditor(null);
      setSaving(false);
    }
  }, [open, dashboard]);

  const dateFilters = useMemo(() => list.filter(isDateRange), [list]);

  const nameError = useMemo(() => {
    if (!editor) return null;
    const name = editor.name.trim();
    if (!name) return 'Name is required.';
    if (!isValidFilterName(name)) {
      return 'Use letters, digits and underscores; must start with a letter and not begin with "__".';
    }
    const collides = list.some(
      (v) => v.name === name && v.name !== editor.originalName
    );
    if (collides) return 'A variable with this name already exists.';
    return null;
  }, [editor, list]);

  const labelError = useMemo(() => {
    if (!editor) return null;
    return editor.label.trim() ? null : 'Label is required.';
  }, [editor]);

  const startAdd = () => {
    setEditor({
      originalName: null,
      label: '',
      name: '',
      presetId: DEFAULT_DATE_RANGE.id,
      nameTouched: false,
    });
  };

  const startEdit = (variable: Variable) => {
    setEditor({
      originalName: variable.name,
      label: variable.label || variable.name,
      name: variable.name,
      presetId: matchPresetId(variable),
      nameTouched: true,
    });
  };

  const handleDelete = (name: string) => {
    setList((prev) => prev.filter((v) => v.name !== name));
    setEditor((prev) => (prev?.originalName === name ? null : prev));
  };

  const handleLabelChange = (label: string) => {
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            label,
            name: prev.nameTouched ? prev.name : suggestFilterName(label),
          }
        : prev
    );
  };

  const commitEditor = () => {
    if (!editor || nameError || labelError) return;
    const name = editor.name.trim();
    const label = editor.label.trim();

    let from: string;
    let to: string;
    let text: string;

    if (editor.presetId === CUSTOM_PRESET_ID) {
      // Keep the existing custom range from the original variable.
      const original = list.find((v) => v.name === editor.originalName);
      const range = original ? dateRangeDefaults(original) : DEFAULT_DATE_RANGE;
      from = range.from;
      to = range.to;
      text = original?.current?.text || 'Custom range';
    } else {
      const preset =
        DATE_RANGE_PRESETS.find((p) => p.id === editor.presetId) ?? DEFAULT_DATE_RANGE;
      from = preset.from;
      to = preset.to;
      text = preset.display;
    }

    const newVar = makeDateRangeVariable({ name, label, from, to, text });

    setList((prev) => {
      if (editor.originalName) {
        return prev.map((v) => (v.name === editor.originalName ? newVar : v));
      }
      return [...prev, newVar];
    });
    setEditor(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(list);
      toast({ title: 'Saved', description: 'Dashboard filters updated.' });
      onClose();
    } catch (err) {
      console.error('Error saving dashboard filters:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save dashboard filters',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const derivedNames = editor && editor.name.trim() && !nameError
    ? dateRangeParamNames(editor.name.trim())
    : null;

  const presetOptions = editor?.presetId === CUSTOM_PRESET_ID
    ? [{ id: CUSTOM_PRESET_ID, display: 'Custom (keep current)' }, ...DATE_RANGE_PRESETS]
    : DATE_RANGE_PRESETS;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            Dashboard Filters
          </DialogTitle>
          <DialogDescription>
            Add local filter variables that bind into panel SQL. A date filter exposes
            two parameters you can reference in any panel query.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto">
          {/* Existing filters */}
          {dateFilters.length === 0 && !editor && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No filters yet. Add a date filter to let viewers pick a custom range.
            </div>
          )}

          {dateFilters.map((variable) => {
            const names = dateRangeParamNames(variable.name);
            const isEditingThis = editor?.originalName === variable.name;
            return (
              <div
                key={variable.name}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-lg border p-3',
                  isEditingThis && 'ring-2 ring-[#379EF9]'
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{variable.label || variable.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({variable.current?.text || 'range'})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {'${'}{names.from}{'}'} · {'${'}{names.to}{'}'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(variable)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(variable.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add / edit form */}
          {editor ? (
            <div className="rounded-lg border bg-[var(--surface-2)] p-4 space-y-3">
              <div className="text-sm font-semibold">
                {editor.originalName ? 'Edit date filter' : 'New date filter'}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={editor.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="Reporting period"
                  className="h-9"
                  autoFocus
                />
                {labelError && <p className="text-xs text-red-600">{labelError}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Variable name</Label>
                <Input
                  value={editor.name}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, name: e.target.value, nameTouched: true } : prev
                    )
                  }
                  placeholder="period"
                  className="h-9 font-mono"
                />
                {nameError ? (
                  <p className="text-xs text-red-600">{nameError}</p>
                ) : derivedNames ? (
                  <p className="text-xs text-muted-foreground">
                    Use in panel SQL as{' '}
                    <code className="rounded bg-[var(--surface-3)] px-1">
                      {'${'}{derivedNames.from}{'}'}
                    </code>{' '}
                    and{' '}
                    <code className="rounded bg-[var(--surface-3)] px-1">
                      {'${'}{derivedNames.to}{'}'}
                    </code>
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Default range</Label>
                <Select
                  value={editor.presetId}
                  onValueChange={(val) =>
                    setEditor((prev) => (prev ? { ...prev, presetId: val } : prev))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presetOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setEditor(null)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={commitEditor}
                  disabled={!!nameError || !!labelError}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {editor.originalName ? 'Update filter' : 'Add filter'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add date filter
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !!editor}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
