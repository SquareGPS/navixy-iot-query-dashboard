/**
 * ParameterBar Component
 * Renders dashboard parameters with appropriate input controls
 * Supports time range picker with presets, number inputs, text inputs, etc.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RotateCcw, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GrafanaDashboard, DashboardParameter } from '@/types/grafana-dashboard';
import { parseGrafanaTime, formatDateToLocalInput } from '@/utils/grafanaTimeParser';
import { extractParameterNames } from '@/utils/sqlParameterExtractor';
import { useParameterUrlSync } from '@/hooks/use-parameter-url-sync';

// Simple date formatter (avoiding date-fns dependency)
function formatDate(date: Date, formatStr: string): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

export interface ParameterValues {
  [paramName: string]: unknown;
}

interface ParameterBarProps {
  dashboard: GrafanaDashboard;
  values: ParameterValues;
  onChange: (values: ParameterValues) => void;
  className?: string;
}

interface TimeRangePreset {
  from: string;
  to: string;
  display: string;
}

export const ParameterBar: React.FC<ParameterBarProps> = ({
  dashboard,
  values,
  onChange,
  className
}) => {
  // Get declared parameters from x-navixy.params
  const declaredParams = dashboard['x-navixy']?.params || [];

  // Get time range from dashboard.time
  const defaultTimeRange = dashboard.time || { from: 'now-24h', to: 'now' };

  // Get quick ranges from timepicker
  const quickRanges: TimeRangePreset[] = dashboard.timepicker?.quickRanges || [];

  // Add common presets if not already present
  const allPresets: TimeRangePreset[] = [
    ...quickRanges,
    { from: 'now/d', to: 'now', display: 'Today' },
    { from: 'now-1d/d', to: 'now/d', display: 'Yesterday' }, // Start of yesterday to start of today (covers all of yesterday)
    { from: 'now-7d/d', to: 'now', display: 'Last 7 days' },
    { from: 'now-30d/d', to: 'now', display: 'Last 30 days' },
  ].filter((preset, index, self) => 
    index === self.findIndex(p => p.display === preset.display)
  );

  // Infer parameters from panel SQL if not declared
  const inferredParams = useInferredParameters(dashboard);

  // Merge declared and inferred parameters
  const allParams = useMemo(() => {
    const paramMap = new Map<string, DashboardParameter>();
    
    // Add declared parameters
    declaredParams.forEach(param => {
      paramMap.set(param.name, param);
    });

    // Add inferred parameters (only if not already declared)
    inferredParams.forEach(param => {
      if (!paramMap.has(param.name)) {
        paramMap.set(param.name, param);
      }
    });

    // Check if __from or __to parameters exist (from SQL inference or declaration)
    const hasFromParam = paramMap.has('__from');
    const hasToParam = paramMap.has('__to');
    
    // If __from or __to are found, ensure they're marked as time parameters
    // and have defaults from dashboard.time
    if ((hasFromParam || hasToParam) && dashboard.time) {
      if (hasFromParam) {
        const fromParam = paramMap.get('__from')!;
        paramMap.set('__from', {
          ...fromParam,
          type: 'time',
          label: fromParam.label || 'From',
          default: fromParam.default || dashboard.time.from,
          order: fromParam.order ?? -2
        });
      }
      
      if (hasToParam) {
        const toParam = paramMap.get('__to')!;
        paramMap.set('__to', {
          ...toParam,
          type: 'time',
          label: toParam.label || 'To',
          default: toParam.default || dashboard.time.to,
          order: toParam.order ?? -1
        });
      }
    }

    // Sort by order if specified, otherwise by name
    return Array.from(paramMap.values()).sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [declaredParams, inferredParams, dashboard.time]);

  // Calculate default values
  const defaultValues = useMemo(() => {
    const defaults: ParameterValues = {};
    
    allParams.forEach(param => {
      if (param.name === '__from' || param.name === '__to') {
        // Time range params get defaults from dashboard.time
        if (param.name === '__from') {
          defaults.__from = parseGrafanaTime(defaultTimeRange.from);
        } else {
          defaults.__to = parseGrafanaTime(defaultTimeRange.to);
        }
      } else if (param.default !== undefined && param.default !== null) {
        // Handle default based on type
        if (param.type === 'time' || param.type === 'datetime') {
          defaults[param.name] = parseGrafanaTime(String(param.default));
        } else {
          defaults[param.name] = param.default;
        }
      }
    });

    return defaults;
  }, [allParams, defaultTimeRange]);

  // Sync with URL parameters
  useParameterUrlSync(values, onChange, defaultValues);

  // Store pending changes separately (don't apply immediately)
  const [pendingValues, setPendingValues] = useState<ParameterValues>(values);

  // Sync pending values when values prop changes (from URL or external source)
  useEffect(() => {
    setPendingValues(values);
  }, [values]);

  // Check if pending values have changed from current values
  const hasPendingChanges = useMemo(() => {
    for (const [key, pendingValue] of Object.entries(pendingValues)) {
      const currentValue = values[key];
      
      // Handle Date comparisons
      if (pendingValue instanceof Date && currentValue instanceof Date) {
        if (pendingValue.getTime() !== currentValue.getTime()) {
          return true;
        }
      } else if (pendingValue !== currentValue) {
        return true;
      }
    }
    
    // Check if any current values don't exist in pending (removed values)
    for (const key of Object.keys(values)) {
      if (!(key in pendingValues)) {
        return true;
      }
    }
    
    return false;
  }, [pendingValues, values]);

  const handleParamChange = useCallback((name: string, value: unknown) => {
    setPendingValues(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleApply = useCallback(() => {
    // If there are pending changes, apply them
    // Otherwise, just refresh with current values
    if (hasPendingChanges) {
      onChange(pendingValues);
    } else {
      // Refresh: re-apply current values to trigger query re-execution
      onChange({ ...values });
    }
  }, [pendingValues, values, hasPendingChanges, onChange]);

  const handlePresetSelect = useCallback((preset: TimeRangePreset) => {
    const from = parseGrafanaTime(preset.from);
    const to = parseGrafanaTime(preset.to);
    setPendingValues(prev => ({
      ...prev,
      __from: from,
      __to: to
    }));
  }, []);

  const handleReset = useCallback(() => {
    setPendingValues(defaultValues);
    onChange(defaultValues);
  }, [defaultValues, onChange]);

  // Get current time range values from pending (for display)
  // Support both __from/__to (new) and from/to (legacy migration)
  const fromDate = pendingValues.__from instanceof Date 
    ? pendingValues.__from 
    : (pendingValues.from instanceof Date 
      ? pendingValues.from 
      : parseGrafanaTime(defaultTimeRange.from));
  const toDate = pendingValues.__to instanceof Date 
    ? pendingValues.__to 
    : (pendingValues.to instanceof Date 
      ? pendingValues.to 
      : parseGrafanaTime(defaultTimeRange.to));

  // Group parameters: time range (__from/__to) first, then others
  const timeParams = allParams.filter(p => p.name === '__from' || p.name === '__to');
  const otherParams = allParams.filter(p => p.name !== '__from' && p.name !== '__to');

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Parameters</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="h-8"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset to defaults
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 flex-1">
        {/* Time Range Picker */}
        {timeParams.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium whitespace-nowrap">Time Range:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate && toDate ? (
                    <>
                      {formatDate(fromDate, "LLL dd, y")} - {formatDate(toDate, "LLL dd, y")}
                    </>
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <div className="space-y-2">
                    <Label className="text-xs">Quick Ranges</Label>
                    <div className="flex flex-wrap gap-2">
                      {allPresets.map((preset, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handlePresetSelect(preset)}
                          className="text-xs"
                        >
                          {preset.display}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="datetime-local"
                      value={formatDateToLocalInput(fromDate)}
                      onChange={(e) => {
                        const newFrom = new Date(e.target.value);
                        setPendingValues(prev => ({
                          ...prev,
                          __from: newFrom,
                          __to: toDate
                        }));
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="datetime-local"
                      value={formatDateToLocalInput(toDate)}
                      onChange={(e) => {
                        const newTo = new Date(e.target.value);
                        setPendingValues(prev => ({
                          ...prev,
                          __from: fromDate,
                          __to: newTo
                        }));
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Other Parameters */}
        {otherParams.map(param => (
          <div key={param.name} className="flex items-center gap-2">
            <Label className="text-xs font-medium whitespace-nowrap">
              {param.label || param.name}:
            </Label>
            {renderParameterInput(param, pendingValues[param.name], (value) => 
              handleParamChange(param.name, value)
            )}
          </div>
        ))}
      </div>

      {/* Apply button - always visible, reserved space at bottom */}
      <div className="flex justify-end mt-4 pt-4 border-t h-[52px] items-center">
        <Button
          variant="primary"
          onClick={handleApply}
          disabled={!hasPendingChanges}
        >
          {hasPendingChanges ? (
            <>
              <Check className="h-4 w-4" />
              Apply
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Update
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

/**
 * Render appropriate input for parameter type
 */
function renderParameterInput(
  param: DashboardParameter,
  value: unknown,
  onChange: (value: unknown) => void
): React.ReactNode {
  switch (param.type) {
    case 'number':
    case 'integer':
      return (
        <Input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => {
            const numValue = param.type === 'integer' 
              ? parseInt(e.target.value, 10)
              : parseFloat(e.target.value);
            onChange(isNaN(numValue) ? undefined : numValue);
          }}
          placeholder={param.placeholder}
          min={param.min}
          max={param.max}
          step={param.step}
          className="h-8 w-32 text-xs"
        />
      );

    case 'text':
      return (
        <Input
          type="text"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={param.placeholder}
          className="h-8 w-48 text-xs"
        />
      );

    case 'boolean':
      return (
        <Select
          value={value !== undefined ? String(value) : 'false'}
          onValueChange={(val) => onChange(val === 'true')}
        >
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'select':
      if (!param.options || param.options.length === 0) {
        return (
          <Input
            type="text"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={param.placeholder}
            className="h-8 w-48 text-xs"
          />
        );
      }
      return (
        <Select
          value={value !== undefined && value !== null ? String(value) : ''}
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder={param.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {param.options.map((option, idx) => (
              <SelectItem key={idx} value={String(option.value)}>
                {option.label || String(option.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'datetime':
      const dateValue = value instanceof Date ? value : (value ? new Date(String(value)) : new Date());
      return (
        <Input
          type="datetime-local"
          value={formatDateToLocalInput(dateValue)}
          onChange={(e) => onChange(new Date(e.target.value))}
          className="h-8 w-48 text-xs"
        />
      );

    default:
      return (
        <Input
          type="text"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={param.placeholder}
          className="h-8 w-48 text-xs"
        />
      );
  }
}

/**
 * Infer parameters from panel SQL queries
 */
function useInferredParameters(dashboard: GrafanaDashboard): DashboardParameter[] {
  const [inferred, setInferred] = useState<DashboardParameter[]>([]);

  useEffect(() => {
    const params = new Map<string, DashboardParameter>();

    // Scan all panels for SQL with parameters
    dashboard.panels.forEach(panel => {
      const sql = panel['x-navixy']?.sql?.statement;
      if (!sql) return;

      const paramNames = extractParameterNames(sql);
      paramNames.forEach(name => {
        // Skip if already declared
        if (dashboard['x-navixy']?.params?.some(p => p.name === name)) {
          return;
        }

        // Create implicit parameter
        if (!params.has(name)) {
          // Special handling for __from and __to - mark as time type
          const isTimeParam = name === '__from' || name === '__to';
          params.set(name, {
            name,
            type: isTimeParam ? 'time' : 'text', // Mark __from/__to as time type
            label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          });
        }
      });
    });

    setInferred(Array.from(params.values()));
  }, [dashboard]);

  return inferred;
}

