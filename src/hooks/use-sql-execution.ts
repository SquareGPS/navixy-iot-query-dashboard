import { useState } from 'react';
import { apiService } from '@/services/api';
import { toast } from 'sonner';

export interface SqlExecutionResult {
  columns: string[];
  rows: any[];
  columnTypes: Record<string, string>;
  rowCount: number;
  executionTime: number;
  fetchTime: number;
  executedAt: Date;
}

export interface SqlExecutionOptions {
  sql: string;
  params?: Record<string, unknown>;
  timeout_ms?: number;
  row_limit?: number;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export function useSqlExecution() {
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<SqlExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async (options: SqlExecutionOptions): Promise<SqlExecutionResult | null> => {
    const {
      sql,
      params = {},
      timeout_ms = 30000,
      row_limit = 1000,
      showSuccessToast = true,
      showErrorToast = true,
    } = options;

    if (!sql.trim()) {
      if (showErrorToast) {
        toast.error('Please enter a SQL query');
      }
      return null;
    }

    const startTime = performance.now();
    setExecuting(true);
    setError(null);
    setResults(null);

    try {
      const fetchStartTime = performance.now();
      const response = await apiService.executeSQL({
        sql: sql.trim(),
        params,
        timeout_ms,
        row_limit,
      });
      const fetchEndTime = performance.now();

      const executionTime = fetchEndTime - startTime;
      const fetchTime = fetchEndTime - fetchStartTime;
      const executedAt = new Date();

      // Handle API errors
      if (response.error) {
        console.error('API error:', response.error);
        const errorMsg = response.error.message || 'Failed to execute query';
        
        setError(errorMsg);
        if (showErrorToast) {
          toast.error(errorMsg);
        }
        return null;
      }

      // Success case - transform the response to match the expected format
      console.log('SQL Execution - Raw response data:', response.data);
      console.log('SQL Execution - Response columns:', response.data?.columns);
      console.log('SQL Execution - Response rows:', response.data?.rows);
      
      const transformedData: SqlExecutionResult = {
        columns: response.data?.columns?.map((col: any) => col.name) || [],
        rows: response.data?.rows?.map((row: any[]) => {
          // Convert array of values to object with column names as keys
          const rowObj: any = {};
          response.data?.columns?.forEach((col: any, index: number) => {
            rowObj[col.name] = row[index];
          });
          return rowObj;
        }) || [],
        columnTypes: response.data?.columns?.reduce((acc: any, col: any) => {
          acc[col.name] = col.type;
          return acc;
        }, {}) || {},
        rowCount: response.data?.rows?.length || 0,
        executionTime,
        fetchTime,
        executedAt,
      };
      
      console.log('SQL Execution - Transformed data:', transformedData);

      setResults(transformedData);
      if (showSuccessToast) {
        toast.success('Query executed successfully');
      }
      
      return transformedData;
    } catch (err: any) {
      console.error('Unexpected error executing query:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        context: err.context,
      });
      
      let errorMessage = 'Failed to execute query';
      
      // Try to extract meaningful error information
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.context?.body) {
        try {
          const bodyError = typeof err.context.body === 'string' 
            ? JSON.parse(err.context.body) 
            : err.context.body;
          if (bodyError?.error?.message) {
            errorMessage = bodyError.error.message;
            if (bodyError.error.code) {
              errorMessage = `[${bodyError.error.code}] ${errorMessage}`;
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse error body:', parseErr);
        }
      }
      
      setError(errorMessage);
      if (showErrorToast) {
        toast.error(errorMessage);
      }
      
      return null;
    } finally {
      setExecuting(false);
    }
  };

  const reset = () => {
    setExecuting(false);
    setResults(null);
    setError(null);
  };

  return {
    executing,
    results,
    error,
    executeQuery,
    reset,
  };
}

