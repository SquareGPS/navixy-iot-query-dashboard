/**
 * Hook for syncing parameter values with URL query string
 * Allows sharing dashboards with specific parameter values
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ParameterValues } from '@/components/reports/ParameterBar';
import { formatDateToISO } from '@/utils/timeParser';

/**
 * Hook to sync parameter values with URL query parameters
 * @param values Current parameter values
 * @param onChange Callback when values change
 * @param defaults Default parameter values (for initialization)
 * @param arrayParamNames Names of params whose value is a string[] (multiselect
 *   filters). They are JSON-encoded in the URL so selections — including an empty
 *   "All" — round-trip on reload and via shared links, instead of being dropped.
 */
export function useParameterUrlSync(
  values: ParameterValues,
  onChange: (values: ParameterValues) => void,
  defaults?: ParameterValues,
  arrayParamNames?: string[]
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const arrayParams = new Set(arrayParamNames ?? []);

  // Load parameters from URL on mount
  useEffect(() => {
    const urlParams: ParameterValues = {};
    let hasUrlParams = false;

    searchParams.forEach((value, key) => {
      // Array params (multiselect) are JSON-encoded — decode back to string[].
      if (arrayParams.has(key)) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            urlParams[key] = parsed.map(String);
            hasUrlParams = true;
            return;
          }
        } catch {
          // Fall through to scalar parsing on malformed input.
        }
      }

      // Try to parse as date first (ISO format)
      if (value.includes('T') && value.includes('Z')) {
        const dateValue = new Date(value);
        if (!isNaN(dateValue.getTime())) {
          urlParams[key] = dateValue;
          hasUrlParams = true;
          return;
        }
      }
      
      // Try boolean
      if (value === 'true' || value === 'false') {
        urlParams[key] = value === 'true';
        hasUrlParams = true;
        return;
      }
      
      // Try number
      if (!isNaN(Number(value)) && value !== '') {
        urlParams[key] = Number(value);
        hasUrlParams = true;
        return;
      }
      
      // Default to string
      urlParams[key] = value;
      hasUrlParams = true;
    });

    // If URL has parameters, use them (overriding defaults)
    if (hasUrlParams && Object.keys(urlParams).length > 0) {
      const merged = { ...defaults, ...urlParams };
      onChange(merged);
    } else if (defaults && Object.keys(defaults).length > 0) {
      // Otherwise, initialize with defaults (but don't update URL yet)
      onChange(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update URL when parameter values change (but skip initial load to avoid loops)
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    // Skip URL update on initial mount (URL -> values sync already happened)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newParams = new URLSearchParams();

    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Multiselect selections round-trip as JSON (including [] = "All"), so a
        // shared/refreshed URL restores them instead of reverting to the default.
        if (Array.isArray(value)) {
          newParams.set(key, JSON.stringify(value));
          return;
        }
        if (value instanceof Date) {
          newParams.set(key, formatDateToISO(value));
        } else if (typeof value === 'boolean') {
          newParams.set(key, String(value));
        } else if (typeof value === 'number') {
          newParams.set(key, String(value));
        } else {
          newParams.set(key, String(value));
        }
      }
    });

    // Only update URL if params actually changed
    const currentParams = searchParams.toString();
    const newParamsStr = newParams.toString();
    
    if (currentParams !== newParamsStr) {
      setSearchParams(newParams, { replace: true });
    }
  }, [values, searchParams, setSearchParams]);
}

