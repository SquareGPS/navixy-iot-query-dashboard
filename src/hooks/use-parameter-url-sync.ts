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
 */
export function useParameterUrlSync(
  values: ParameterValues,
  onChange: (values: ParameterValues) => void,
  defaults?: ParameterValues
) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Load parameters from URL on mount
  useEffect(() => {
    const urlParams: ParameterValues = {};
    let hasUrlParams = false;

    searchParams.forEach((value, key) => {
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

