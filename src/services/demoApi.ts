/**
 * Demo API Service - Wraps the real API and routes settings-related calls to IndexedDB in demo mode
 * 
 * IoT database queries (SQL execution) still go to the real backend - only settings storage is local.
 */
import { demoStorageService } from './demoStorage';
import type { DemoReport } from './demoStorage';
import { resolveSqlTimeZone } from './sqlTimeZone';
import { toErrorMeta } from '@/utils/errors';
import type { ChartCatalog } from '@/types/chart-catalog';
import type { MenuTree, ReorderResponse, RenameResponse, DeleteSectionResponse, DeleteReportResponse } from '@/types/menu-editor';
import type { CompositeReport, CompositeReportExecutionResult, StoredReport } from '@/types/dashboard-types';
import {
  DATE_FORMAT_VALUES,
  TIME_FORMAT_VALUES,
  detectInitialTimeFormat,
  sanitizeStoredTimeZone,
} from '@/utils/datetime';
import type { DateFormat, TimeFormat } from '@/utils/datetime';
import type {
  ApiResponse,
  ReportApiData,
  TableQueryParams,
  TableQueryResult,
  TileQueryParams,
  TileQueryResult,
  UserPreferences,
} from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ==========================================
// Demo Mode State Management
// ==========================================

const DEMO_MODE_KEY = 'demo_mode';
const DEMO_USER_ID_KEY = 'demo_user_id';
// User preferences in demo mode live in localStorage. The IndexedDB layer
// (demoStorageService) doesn't have a table for them and a dedicated migration
// would be overkill for three scalar fields. The key is per-installation, not
// per-user, since demo mode only has one active user at a time.
const DEMO_USER_PREFS_KEY = 'demo.userPreferences.v1';

function readDemoUserPreferences(): Partial<UserPreferences> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DEMO_USER_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<UserPreferences> = {};
    // Sanitized like the real backend's read path: a legacy stored bare
    // offset ("+05:00") behaves like an unset zone instead of splitting
    // client formatting from the SQL session (DO-352 review round 4).
    const storedTz = sanitizeStoredTimeZone(parsed.timezone);
    if (storedTz && storedTz !== 'auto') out.timezone = storedTz;
    if (
      typeof parsed.dateFormat === 'string' &&
      (DATE_FORMAT_VALUES as readonly string[]).includes(parsed.dateFormat)
    ) {
      out.dateFormat = parsed.dateFormat as DateFormat;
    }
    if (
      typeof parsed.timeFormat === 'string' &&
      (TIME_FORMAT_VALUES as readonly string[]).includes(parsed.timeFormat)
    ) {
      out.timeFormat = parsed.timeFormat as TimeFormat;
    }
    return out;
  } catch {
    return {};
  }
}

function writeDemoUserPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_USER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage might be unavailable (privacy mode); ignore — the call
    // still echoes the prefs back to the caller for the active session.
  }
}

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function setDemoMode(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(DEMO_MODE_KEY);
    localStorage.removeItem(DEMO_USER_ID_KEY);
  }
}

export function getDemoUserId(): string | null {
  return localStorage.getItem(DEMO_USER_ID_KEY);
}

export function setDemoUserId(userId: string): void {
  localStorage.setItem(DEMO_USER_ID_KEY, userId);
}

// ==========================================
// Demo API Service Class
// ==========================================

class DemoApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Make a real API request - used for IoT database queries even in demo mode
   */
  private async realRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        headers,
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: {
            code: data.error?.code || 'HTTP_ERROR',
            message: data.error?.message || `HTTP ${response.status}`,
            details: data.error?.details,
          },
        };
      }

      return { data };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      console.error('API: Network error', {
        url,
        error: error.message,
      });
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network request failed',
        },
      };
    }
  }

  // ==========================================
  // SQL Execution (Always goes to real backend)
  // ==========================================

  async executeTableQuery(params: TableQueryParams): Promise<ApiResponse<TableQueryResult>> {
    return this.realRequest<TableQueryResult>('/api/sql/table', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async executeTileQuery(params: TileQueryParams): Promise<ApiResponse<TileQueryResult>> {
    return this.realRequest<TileQueryResult>('/api/sql/tile', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async executeSQL(params: {
    sql: string;
    params?: Record<string, unknown>;
    timeout_ms?: number;
    row_limit?: number;
    pagination?: {
      page: number;
      pageSize: number;
    };
  }): Promise<ApiResponse<{
    columns: Array<{ name: string; type: string }>;
    rows: unknown[][];
    stats?: {
      rowCount: number;
      elapsedMs: number;
    };
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  }>> {
    // Mirrors apiService.executeSQL: demo SQL still hits the real backend, so
    // it carries the same session timezone (DO-352).
    const timeZone = resolveSqlTimeZone();
    const requestBody: Record<string, unknown> = {
      dialect: 'postgresql',
      statement: params.sql,
      params: params.params || {},
      limits: {
        timeout_ms: params.timeout_ms || 30000,
        max_rows: params.row_limit || 10000
      },
      read_only: true,
      ...(timeZone && { time_zone: timeZone })
    };

    if (params.pagination) {
      requestBody.pagination = params.pagination;
    }

    return this.realRequest('/api/sql-new/execute', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async testConnection(): Promise<ApiResponse<{ success: boolean; message: string; result: unknown }>> {
    return this.realRequest('/api/sql/test-connection', {
      method: 'POST',
    });
  }

  async clearCache(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.realRequest('/api/sql/clear-cache', {
      method: 'POST',
    });
  }

  async getHealthStatus(): Promise<ApiResponse<unknown>> {
    return this.realRequest('/health');
  }

  // ==========================================
  // Sections (Demo mode uses IndexedDB)
  // ==========================================

  async getSections(): Promise<ApiResponse<unknown[]>> {
    try {
      const userId = getDemoUserId();
      const sections = await demoStorageService.getSections(userId ?? undefined);
      
      // Convert to API format
      const apiSections = sections.map(s => ({
        id: s.id,
        name: s.name,
        sort_order: s.sortOrder,
        version: s.version,
        is_deleted: s.isDeleted,
        user_id: s.userId,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString()
      }));
      
      return { data: apiSections };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get sections from demo storage'
        }
      };
    }
  }

  async createSection(name: string, sortOrder?: number): Promise<ApiResponse<unknown>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const section = await demoStorageService.createSection({
        name,
        sortOrder,
        userId
      });
      
      return {
        data: {
          id: section.id,
          name: section.name,
          sort_order: section.sortOrder,
          version: section.version,
          user_id: section.userId,
          created_at: section.createdAt.toISOString(),
          updated_at: section.updatedAt.toISOString()
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to create section in demo storage'
        }
      };
    }
  }

  async updateSection(id: string, name: string): Promise<ApiResponse<unknown>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      // Get current version for optimistic concurrency
      const existing = await demoStorageService.getSections(userId);
      const section = existing.find(s => s.id === id);
      if (!section) throw new Error('Section not found');
      
      const updated = await demoStorageService.updateSection(id, {
        name,
        userId,
        version: section.version
      });
      
      return {
        data: {
          id: updated.id,
          name: updated.name,
          sort_order: updated.sortOrder,
          version: updated.version,
          user_id: updated.userId,
          created_at: updated.createdAt.toISOString(),
          updated_at: updated.updatedAt.toISOString()
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to update section in demo storage'
        }
      };
    }
  }

  // ==========================================
  // Reports (Demo mode uses IndexedDB)
  // ==========================================

  async getReports(): Promise<ApiResponse<unknown[]>> {
    try {
      const userId = getDemoUserId();
      const reports = await demoStorageService.getReports(userId ?? undefined);
      
      // Convert to API format
      const apiReports = reports.map(r => ({
        id: r.id,
        title: r.title,
        section_id: r.sectionId,
        slug: r.slug,
        sort_order: r.sortOrder,
        version: r.version,
        report_schema: r.reportSchema,
        is_deleted: r.isDeleted,
        user_id: r.userId,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString()
      }));
      
      return { data: apiReports };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get reports from demo storage'
        }
      };
    }
  }

  async getReportById(id: string): Promise<ApiResponse<ReportApiData>> {
    try {
      const userId = getDemoUserId();
      const report = await demoStorageService.getReportById(id, userId ?? undefined);
      
      if (!report) {
        return {
          error: {
            code: 'NOT_FOUND',
            message: 'Report not found'
          }
        };
      }
      
      return {
        data: {
          report: {
            id: report.id,
            title: report.title,
            section_id: report.sectionId,
            slug: report.slug,
            sort_order: report.sortOrder,
            version: report.version,
            report_schema: report.reportSchema,
            is_deleted: report.isDeleted,
            user_id: report.userId,
            created_at: report.createdAt.toISOString(),
            updated_at: report.updatedAt.toISOString()
          }
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get report from demo storage'
        }
      };
    }
  }

  async createReport(reportData: {
    title: string;
    section_id?: string | null;
    slug?: string;
    sort_order?: number;
    report_schema: unknown;
  }): Promise<ApiResponse<StoredReport>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');

      const report = await demoStorageService.createReport({
        title: reportData.title,
        sectionId: reportData.section_id,
        slug: reportData.slug,
        sortOrder: reportData.sort_order,
        reportSchema: reportData.report_schema,
        userId
      });
      
      return {
        data: {
          id: report.id,
          title: report.title,
          section_id: report.sectionId,
          slug: report.slug,
          sort_order: report.sortOrder,
          version: report.version,
          report_schema: report.reportSchema,
          user_id: report.userId,
          created_at: report.createdAt.toISOString(),
          updated_at: report.updatedAt.toISOString()
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to create report in demo storage'
        }
      };
    }
  }

  async updateReport(id: string, reportData: unknown): Promise<ApiResponse<StoredReport>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const rd = reportData as { title?: string; section_id?: string | null; sort_order?: number; report_schema?: unknown };
      const report = await demoStorageService.updateReport(id, {
        title: rd.title,
        sectionId: rd.section_id,
        sortOrder: rd.sort_order,
        reportSchema: rd.report_schema,
        userId
      });
      
      return {
        data: {
          id: report.id,
          title: report.title,
          section_id: report.sectionId,
          slug: report.slug,
          sort_order: report.sortOrder,
          version: report.version,
          report_schema: report.reportSchema,
          user_id: report.userId,
          created_at: report.createdAt.toISOString(),
          updated_at: report.updatedAt.toISOString()
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to update report in demo storage'
        }
      };
    }
  }

  async reorderSections(sections: Array<{ id: string; sort_index: number }>): Promise<ApiResponse<unknown>> {
    // This is handled through the menu reorder API
    return { data: { success: true } };
  }

  async reorderReports(reports: Array<{ id: string; sort_index: number; section_id?: string | null }>): Promise<ApiResponse<unknown>> {
    // This is handled through the menu reorder API
    return { data: { success: true } };
  }

  // ==========================================
  // Schema (Always goes to real backend)
  // ==========================================

  async getExampleSchema(): Promise<ApiResponse<unknown>> {
    return this.realRequest('/api/schema/example');
  }

  async getSchemaConfig(): Promise<ApiResponse<{ defaultUrl: string }>> {
    return this.realRequest('/api/schema/config');
  }

  // ==========================================
  // Menu Management API (Demo mode uses IndexedDB)
  // ==========================================

  async getMenuTree(includeDeleted: boolean = false): Promise<ApiResponse<MenuTree>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const menuTree = await demoStorageService.getMenuTree(userId, includeDeleted);
      return { data: menuTree };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get menu tree from demo storage'
        }
      };
    }
  }

  async reorderMenu(payload: unknown): Promise<ApiResponse<ReorderResponse>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      type ReorderArg = Parameters<typeof demoStorageService.reorderMenu>[0];
      const p = payload as { sections?: ReorderArg['sections']; reports?: ReorderArg['reports'] };
      const result = await demoStorageService.reorderMenu({
        sections: p.sections || [],
        reports: p.reports || [],
        userId
      });
      
      return { data: { ok: true, newVersions: result.newVersions } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to reorder menu in demo storage'
        }
      };
    }
  }

  async renameSection(id: string, name: string, version: number): Promise<ApiResponse<RenameResponse>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const section = await demoStorageService.updateSection(id, {
        name,
        userId,
        version
      });
      
      return {
        data: {
          ok: true,
          section: {
            id: section.id,
            name: section.name,
            sortOrder: section.sortOrder,
            version: section.version
          }
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      const isConflict = error.message?.includes('conflict');
      return {
        error: {
          code: isConflict ? 'VERSION_CONFLICT' : 'DEMO_ERROR',
          message: error.message || 'Failed to rename section'
        }
      };
    }
  }

  async renameReport(id: string, name: string, version: number): Promise<ApiResponse<RenameResponse>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const report = await demoStorageService.updateReport(id, {
        title: name,
        userId,
        version
      });
      
      return {
        data: {
          ok: true,
          report: {
            id: report.id,
            name: report.title,
            sortOrder: report.sortOrder,
            parentSectionId: report.sectionId,
            version: report.version
          }
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      const isConflict = error.message?.includes('conflict');
      return {
        error: {
          code: isConflict ? 'VERSION_CONFLICT' : 'DEMO_ERROR',
          message: error.message || 'Failed to rename report'
        }
      };
    }
  }

  async deleteSection(id: string, strategy: 'move_children_to_root' | 'delete_children'): Promise<ApiResponse<DeleteSectionResponse>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const result = await demoStorageService.deleteSection(id, strategy, userId);
      
      return {
        data: {
          ok: true,
          affectedReports: result.affectedReports
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to delete section'
        }
      };
    }
  }

  async deleteReport(id: string): Promise<ApiResponse<DeleteReportResponse>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      await demoStorageService.deleteReport(id, userId);
      
      return { data: { ok: true } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to delete report'
        }
      };
    }
  }

  async restoreSection(id: string): Promise<ApiResponse<{ ok: boolean }>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      await demoStorageService.restoreSection(id, userId);
      
      return { data: { ok: true } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to restore section'
        }
      };
    }
  }

  async restoreReport(id: string): Promise<ApiResponse<{ ok: boolean }>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      await demoStorageService.restoreReport(id, userId);
      
      return { data: { ok: true } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to restore report'
        }
      };
    }
  }

  // ==========================================
  // Global Variables (Demo mode uses IndexedDB)
  // ==========================================

  async getGlobalVariables(): Promise<ApiResponse<unknown[]>> {
    try {
      const variables = await demoStorageService.getGlobalVariables();
      
      // Convert to API format
      const apiVariables = variables.map(v => ({
        id: v.id,
        label: v.label,
        description: v.description,
        value: v.value,
        created_at: v.createdAt.toISOString(),
        updated_at: v.updatedAt.toISOString()
      }));
      
      return { data: apiVariables };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get global variables from demo storage'
        }
      };
    }
  }

  // Chart Library preset catalog (drag-n-drop — FR-11365); seeded into IndexedDB at login
  async getChartCatalog(): Promise<ApiResponse<ChartCatalog>> {
    try {
      const catalog = await demoStorageService.getChartCatalog();
      return { data: (catalog ?? { schemaVersion: '1.0', groups: [] }) as ChartCatalog };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get chart catalog from demo storage'
        }
      };
    }
  }

  async createGlobalVariable(data: {
    label: string;
    description?: string;
    value?: string;
  }): Promise<ApiResponse<unknown>> {
    try {
      const variable = await demoStorageService.createGlobalVariable(data);
      
      return {
        data: {
          id: variable.id,
          label: variable.label,
          description: variable.description,
          value: variable.value,
          created_at: variable.createdAt.toISOString(),
          updated_at: variable.updatedAt.toISOString()
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      const isDuplicate = error.message?.includes('already exists');
      return {
        error: {
          code: isDuplicate ? 'DUPLICATE' : 'DEMO_ERROR',
          message: error.message || 'Failed to create global variable'
        }
      };
    }
  }

  async updateGlobalVariable(id: string, data: {
    label?: string;
    description?: string;
    value?: string;
  }): Promise<ApiResponse<unknown>> {
    try {
      const variable = await demoStorageService.updateGlobalVariable(id, data);
      
      return {
        data: {
          id: variable.id,
          label: variable.label,
          description: variable.description,
          value: variable.value,
          created_at: variable.createdAt.toISOString(),
          updated_at: variable.updatedAt.toISOString()
        }
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      const isDuplicate = error.message?.includes('already exists');
      return {
        error: {
          code: isDuplicate ? 'DUPLICATE' : 'DEMO_ERROR',
          message: error.message || 'Failed to update global variable'
        }
      };
    }
  }

  async deleteGlobalVariable(id: string): Promise<ApiResponse<unknown>> {
    try {
      await demoStorageService.deleteGlobalVariable(id);
      return { data: { success: true } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to delete global variable'
        }
      };
    }
  }

  // ==========================================
  // Composite Reports (Demo mode uses IndexedDB for metadata, real SQL for execution)
  // ==========================================

  async getCompositeReports(): Promise<ApiResponse<unknown[]>> {
    try {
      const userId = getDemoUserId();
      const reports = await demoStorageService.getReports(userId ?? undefined);
      const compositeReports = reports
        .filter(r => r.reportSchema?.type === 'composite')
        .map(r => this.demoReportToComposite(r));
      return { data: compositeReports };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to get composite reports' }
      };
    }
  }

  async getCompositeReportById(id: string): Promise<ApiResponse<CompositeReport>> {
    try {
      const userId = getDemoUserId();
      const report = await demoStorageService.getReportById(id, userId ?? undefined);
      if (!report) {
        return { error: { code: 'NOT_FOUND', message: 'Composite report not found' } };
      }
      return { data: this.demoReportToComposite(report) };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to get composite report' }
      };
    }
  }

  async createCompositeReport(data: {
    title: string;
    description?: string;
    slug?: string;
    section_id?: string | null;
    sort_order?: number;
    sql_query: string;
    config?: unknown;
  }): Promise<ApiResponse<CompositeReport>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');

      const report = await demoStorageService.createReport({
        title: data.title,
        sectionId: data.section_id,
        slug: data.slug,
        sortOrder: data.sort_order,
        reportSchema: {
          type: 'composite',
          description: data.description || '',
          sqlQuery: data.sql_query,
          config: data.config,
        },
        userId,
      });

      return { data: this.demoReportToComposite(report) };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to create composite report' }
      };
    }
  }

  async updateCompositeReport(id: string, data: {
    title?: string;
    description?: string;
    slug?: string;
    section_id?: string | null;
    sort_order?: number;
    sql_query?: string;
    config?: unknown;
  }): Promise<ApiResponse<CompositeReport>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');

      const existing = await demoStorageService.getReportById(id, userId);
      if (!existing) throw new Error('Composite report not found');

      const existingSchema = existing.reportSchema || {};
      const updatedSchema: Record<string, unknown> = { ...existingSchema, type: 'composite' };
      if (data.description !== undefined) updatedSchema.description = data.description;
      if (data.sql_query !== undefined) updatedSchema.sqlQuery = data.sql_query;
      if (data.config !== undefined) updatedSchema.config = data.config;

      const report = await demoStorageService.updateReport(id, {
        title: data.title,
        sectionId: data.section_id,
        sortOrder: data.sort_order,
        reportSchema: updatedSchema,
        userId,
      });

      return { data: this.demoReportToComposite(report) };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to update composite report' }
      };
    }
  }

  async deleteCompositeReport(id: string): Promise<ApiResponse<unknown>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      await demoStorageService.deleteReport(id, userId);
      return { data: { ok: true } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to delete composite report' }
      };
    }
  }

  async executeCompositeReport(id: string, params?: {
    page?: number;
    pageSize?: number;
    params?: Record<string, unknown>;
  }): Promise<ApiResponse<CompositeReportExecutionResult>> {
    try {
      const userId = getDemoUserId();
      const report = await demoStorageService.getReportById(id, userId ?? undefined);
      if (!report) {
        return { error: { code: 'NOT_FOUND', message: 'Composite report not found' } };
      }

      const sqlQuery = (report.reportSchema as { sqlQuery?: string })?.sqlQuery;
      if (!sqlQuery) {
        return { error: { code: 'VALIDATION_ERROR', message: 'Report has no SQL query' } };
      }

      const maxRows = params?.pageSize || (report.reportSchema as { config?: { table?: { maxRows?: number } } })?.config?.table?.maxRows || 10000;
      const result = await this.executeSQL({
        sql: sqlQuery,
        params: params?.params,
        row_limit: maxRows,
      });

      if (result.error) return { error: result.error };

      const data = result.data!;
      const gps = this.detectGPSColumns(data.columns);

      return {
        data: {
          columns: data.columns,
          rows: data.rows,
          stats: data.stats || { rowCount: data.rows.length, elapsedMs: 0 },
          gps,
        } as unknown as CompositeReportExecutionResult
      };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to execute composite report' }
      };
    }
  }

  async detectCompositeReportColumns(id: string): Promise<ApiResponse<unknown>> {
    try {
      const userId = getDemoUserId();
      const report = await demoStorageService.getReportById(id, userId ?? undefined);
      if (!report) {
        return { error: { code: 'NOT_FOUND', message: 'Composite report not found' } };
      }

      const sqlQuery = (report.reportSchema as { sqlQuery?: string })?.sqlQuery;
      if (!sqlQuery) {
        return { error: { code: 'VALIDATION_ERROR', message: 'Report has no SQL query' } };
      }

      const result = await this.executeSQL({
        sql: sqlQuery,
        row_limit: 1,
      });

      if (result.error) return result;
      return { data: { columns: result.data!.columns } };
    } catch (rawError: unknown) {
      const error = toErrorMeta(rawError);
      return {
        error: { code: 'DEMO_ERROR', message: error.message || 'Failed to detect columns' }
      };
    }
  }

  private demoReportToComposite(r: DemoReport): CompositeReport {
    const schema = (r.reportSchema || {}) as { description?: string; sqlQuery?: string; config?: unknown };
    return {
      id: r.id,
      title: r.title,
      description: schema.description || '',
      slug: r.slug,
      section_id: r.sectionId ?? null,
      sort_order: r.sortOrder ?? 0,
      version: r.version,
      type: 'composite',
      sql_query: schema.sqlQuery || '',
      config: schema.config || {},
      report_schema: r.reportSchema,
      user_id: r.userId,
      created_by: r.createdBy,
      is_deleted: r.isDeleted ?? false,
      created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? new Date().toISOString()),
      updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ?? new Date().toISOString()),
    } as unknown as CompositeReport;
  }

  private detectGPSColumns(columns: Array<{ name: string; type: string }>) {
    const latPatterns = ['lat', 'latitude', 'lat_col', 'y'];
    const lonPatterns = ['lon', 'lng', 'longitude', 'lon_col', 'x'];
    let latColumn: string | null = null;
    let lonColumn: string | null = null;

    for (const col of columns) {
      const lower = col.name.toLowerCase();
      if (!latColumn && latPatterns.some(p => lower.includes(p))) latColumn = col.name;
      if (!lonColumn && lonPatterns.some(p => lower.includes(p))) lonColumn = col.name;
    }

    if (latColumn && lonColumn) {
      return { latColumn, lonColumn, hasGPS: true };
    }
    return null;
  }

  // ==========================================
  // User Preferences (Demo mode uses IndexedDB)
  // For now, return defaults - could be extended
  // ==========================================

  async getUserPreferences(): Promise<ApiResponse<UserPreferences>> {
    const stored = readDemoUserPreferences();
    return {
      data: {
        timezone:
          stored.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: stored.dateFormat ?? 'dd/mm/yyyy',
        timeFormat: stored.timeFormat ?? detectInitialTimeFormat(),
      },
    };
  }

  async updateUserPreferences(
    preferences: Partial<UserPreferences>,
  ): Promise<ApiResponse<UserPreferences>> {
    // Mirror the real backend's validatePreferencesPatch: an invalid or
    // bare-offset timezone 400s instead of being persisted, and the stored
    // value is the sanitized (trimmed) form.
    let patchTimezone: string | undefined;
    if (preferences.timezone !== undefined) {
      patchTimezone = sanitizeStoredTimeZone(preferences.timezone);
      if (!patchTimezone || patchTimezone === 'auto') {
        return {
          error: {
            code: 'CLIENT_ERROR',
            message: `Invalid timezone identifier: ${String(preferences.timezone).trim()}`,
          },
        };
      }
    }
    // Merge the patch with any previously stored prefs and persist to
    // localStorage so a page reload doesn't reset the user's choice. The
    // returned shape matches the real backend's RETURNING payload.
    const stored = readDemoUserPreferences();
    const merged: UserPreferences = {
      timezone:
        patchTimezone ??
        stored.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: preferences.dateFormat ?? stored.dateFormat ?? 'dd/mm/yyyy',
      timeFormat:
        preferences.timeFormat ?? stored.timeFormat ?? detectInitialTimeFormat(),
    };
    writeDemoUserPreferences(merged);
    return { data: merged };
  }

  // ==========================================
  // App Settings (Not applicable in demo mode)
  // ==========================================

  async getAppSettings(): Promise<ApiResponse<unknown>> {
    return { data: {} };
  }

  async updateAppSettings(settings: unknown): Promise<ApiResponse<unknown>> {
    return { data: settings };
  }

  async testDatabaseConnection(settings: unknown): Promise<ApiResponse<unknown>> {
    // Forward to real API for testing IoT connection
    return this.realRequest('/api/auth/test-iot-connection', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }
}

// Singleton instance
export const demoApiService = new DemoApiService();
