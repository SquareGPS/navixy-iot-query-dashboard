/**
 * Query Client
 * Executes SQL queries over HTTP with abort/retry support
 */

import type { DataRows, PanelError } from './grafana-dashboard';
import type { QueryResult } from './runtime-types';

export interface QueryExecutionConfig {
  statement: string;
  params: Record<string, unknown>;
  limits?: {
    timeoutMs?: number;
    maxRows?: number;
  };
  readOnly?: boolean;
  endpoint: string;
  dialect: string;
  timeoutMs: number;
  maxRows: number;
  auth?: { token?: string };
}

export class QueryClient {
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly DEFAULT_MAX_ROWS = 10000;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [100, 200, 400]; // Exponential backoff

  /**
   * Execute SQL query with retry logic
   */
  static async execute(
    config: QueryExecutionConfig,
    signal?: AbortSignal
  ): Promise<QueryResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeSingleQuery(config, signal);
        
        return {
          data: result,
          stats: {
            elapsedMs: Date.now() - startTime,
            cacheHit: false // TODO: Implement cache detection
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Don't retry on abort
        if (signal?.aborted) {
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAYS[attempt] || 400);
        }
      }
    }

    // All retries failed
    return {
      data: { columns: [], rows: [] },
      error: this.normalizeError(lastError),
      stats: {
        elapsedMs: Date.now() - startTime,
        cacheHit: false
      }
    };
  }

  /**
   * Execute single query attempt using the validated SQL endpoint
   */
  private static async executeSingleQuery(
    config: QueryExecutionConfig,
    signal?: AbortSignal
  ): Promise<DataRows> {
    const requestBody = {
      dialect: config.dialect,
      statement: config.statement,
      params: config.params,
      limits: {
        timeout_ms: config.limits?.timeoutMs || config.timeoutMs,
        max_rows: config.limits?.maxRows || config.maxRows
      },
      read_only: config.readOnly ?? true
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (config.auth?.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    }

    const controller = new AbortController();
    
    // Combine external signal with our controller
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeoutMs);

    try {
      // Use the new validated SQL endpoint
      const endpoint = config.endpoint.replace('/api/sql/', '/api/sql-new/');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Handle SQL validation errors
      if (result.error) {
        throw new Error(result.error.message || 'SQL validation failed');
      }

      // Validate response structure
      if (!this.isValidQueryResponse(result)) {
        throw new Error('Invalid response structure');
      }

      // Enforce client-side row limit
      if (result.rows && result.rows.length > config.maxRows) {
        throw new Error(`Query returned too many rows: ${result.rows.length} > ${config.maxRows}`);
      }

      return {
        columns: result.columns || [],
        rows: result.rows || [],
        stats: {
          rowCount: result.rows?.length || 0,
          elapsedMs: result.stats?.elapsedMs || 0
        }
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Query was aborted');
      }
      
      throw error;
    }
  }

  /**
   * Check if error should not be retried
   */
  private static isNonRetryableError(error: any): boolean {
    if (error instanceof Error) {
      // Don't retry on client errors (4xx)
      if (error.message.includes('HTTP 4')) {
        return true;
      }
      
      // Don't retry on SQL syntax errors
      if (error.message.includes('syntax error') || error.message.includes('SQL')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validate query response structure
   */
  private static isValidQueryResponse(result: any): boolean {
    return (
      result &&
      Array.isArray(result.columns) &&
      Array.isArray(result.rows)
    );
  }

  /**
   * Normalize error to PanelError format
   */
  private static normalizeError(error: Error | null): PanelError {
    if (!error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred'
      };
    }

    // Extract error code from message if present
    const codeMatch = error.message.match(/^([A-Z_]+):/);
    const code = codeMatch ? codeMatch[1] : 'EXECUTION_ERROR';

    return {
      code,
      message: error.message,
      details: {
        name: error.name,
        stack: error.stack
      }
    };
  }

  /**
   * Delay utility for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create AbortController for query cancellation
   */
  static createAbortController(): AbortController {
    return new AbortController();
  }

  /**
   * Check if query should be cancelled
   */
  static shouldCancel(signal?: AbortSignal): boolean {
    return signal?.aborted ?? false;
  }
}
