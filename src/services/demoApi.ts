/**
 * Demo API Service - Wraps the real API and routes settings-related calls to IndexedDB in demo mode
 * 
 * IoT database queries (SQL execution) still go to the real backend - only settings storage is local.
 */
import { demoStorageService } from './demoStorage';
import type { ApiResponse, TableQueryParams, TableQueryResult, TileQueryParams, TileQueryResult } from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ==========================================
// Demo Mode State Management
// ==========================================

const DEMO_MODE_KEY = 'demo_mode';
const DEMO_USER_ID_KEY = 'demo_user_id';

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
    } catch (error: any) {
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
    const requestBody: any = {
      dialect: 'postgresql',
      statement: params.sql,
      params: params.params || {},
      limits: {
        timeout_ms: params.timeout_ms || 30000,
        max_rows: params.row_limit || 10000
      },
      read_only: true
    };

    if (params.pagination) {
      requestBody.pagination = params.pagination;
    }

    return this.realRequest('/api/sql-new/execute', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async testConnection(): Promise<ApiResponse<{ success: boolean; message: string; result: any }>> {
    return this.realRequest('/api/sql/test-connection', {
      method: 'POST',
    });
  }

  async clearCache(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.realRequest('/api/sql/clear-cache', {
      method: 'POST',
    });
  }

  async getHealthStatus(): Promise<ApiResponse<any>> {
    return this.realRequest('/health');
  }

  // ==========================================
  // Sections (Demo mode uses IndexedDB)
  // ==========================================

  async getSections(): Promise<ApiResponse<any[]>> {
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get sections from demo storage'
        }
      };
    }
  }

  async createSection(name: string, sortOrder?: number): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to create section in demo storage'
        }
      };
    }
  }

  async updateSection(id: string, name: string): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
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

  async getReports(): Promise<ApiResponse<any[]>> {
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get reports from demo storage'
        }
      };
    }
  }

  async getReportById(id: string): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
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
    report_schema: any;
  }): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to create report in demo storage'
        }
      };
    }
  }

  async updateReport(id: string, reportData: any): Promise<ApiResponse<any>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const report = await demoStorageService.updateReport(id, {
        title: reportData.title,
        sectionId: reportData.section_id,
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to update report in demo storage'
        }
      };
    }
  }

  async reorderSections(sections: Array<{ id: string; sort_index: number }>): Promise<ApiResponse<any>> {
    // This is handled through the menu reorder API
    return { data: { success: true } };
  }

  async reorderReports(reports: Array<{ id: string; sort_index: number; section_id?: string | null }>): Promise<ApiResponse<any>> {
    // This is handled through the menu reorder API
    return { data: { success: true } };
  }

  // ==========================================
  // Schema (Always goes to real backend)
  // ==========================================

  async getExampleSchema(): Promise<ApiResponse<any>> {
    return this.realRequest('/api/schema/example');
  }

  async getSchemaConfig(): Promise<ApiResponse<{ defaultUrl: string }>> {
    return this.realRequest('/api/schema/config');
  }

  // ==========================================
  // Menu Management API (Demo mode uses IndexedDB)
  // ==========================================

  async getMenuTree(includeDeleted: boolean = false): Promise<ApiResponse<any>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const menuTree = await demoStorageService.getMenuTree(userId, includeDeleted);
      return { data: menuTree };
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get menu tree from demo storage'
        }
      };
    }
  }

  async reorderMenu(payload: any): Promise<ApiResponse<any>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      const result = await demoStorageService.reorderMenu({
        sections: payload.sections || [],
        reports: payload.reports || [],
        userId
      });
      
      return { data: { ok: true, newVersions: result.newVersions } };
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to reorder menu in demo storage'
        }
      };
    }
  }

  async renameSection(id: string, name: string, version: number): Promise<ApiResponse<any>> {
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
            version: section.version
          }
        }
      };
    } catch (error: any) {
      const isConflict = error.message?.includes('conflict');
      return {
        error: {
          code: isConflict ? 'VERSION_CONFLICT' : 'DEMO_ERROR',
          message: error.message || 'Failed to rename section'
        }
      };
    }
  }

  async renameReport(id: string, name: string, version: number): Promise<ApiResponse<any>> {
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
            version: report.version
          }
        }
      };
    } catch (error: any) {
      const isConflict = error.message?.includes('conflict');
      return {
        error: {
          code: isConflict ? 'VERSION_CONFLICT' : 'DEMO_ERROR',
          message: error.message || 'Failed to rename report'
        }
      };
    }
  }

  async deleteSection(id: string, strategy: 'move_children_to_root' | 'delete_children'): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to delete section'
        }
      };
    }
  }

  async deleteReport(id: string): Promise<ApiResponse<any>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      await demoStorageService.deleteReport(id, userId);
      
      return { data: { ok: true } };
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to delete report'
        }
      };
    }
  }

  async restoreSection(id: string): Promise<ApiResponse<any>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      await demoStorageService.restoreSection(id, userId);
      
      return { data: { ok: true } };
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to restore section'
        }
      };
    }
  }

  async restoreReport(id: string): Promise<ApiResponse<any>> {
    try {
      const userId = getDemoUserId();
      if (!userId) throw new Error('User not authenticated in demo mode');
      
      await demoStorageService.restoreReport(id, userId);
      
      return { data: { ok: true } };
    } catch (error: any) {
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

  async getGlobalVariables(): Promise<ApiResponse<any[]>> {
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
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to get global variables from demo storage'
        }
      };
    }
  }

  async createGlobalVariable(data: {
    label: string;
    description?: string;
    value?: string;
  }): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
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
  }): Promise<ApiResponse<any>> {
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
    } catch (error: any) {
      const isDuplicate = error.message?.includes('already exists');
      return {
        error: {
          code: isDuplicate ? 'DUPLICATE' : 'DEMO_ERROR',
          message: error.message || 'Failed to update global variable'
        }
      };
    }
  }

  async deleteGlobalVariable(id: string): Promise<ApiResponse<any>> {
    try {
      await demoStorageService.deleteGlobalVariable(id);
      return { data: { success: true } };
    } catch (error: any) {
      return {
        error: {
          code: 'DEMO_ERROR',
          message: error.message || 'Failed to delete global variable'
        }
      };
    }
  }

  // ==========================================
  // User Preferences (Demo mode uses IndexedDB)
  // For now, return defaults - could be extended
  // ==========================================

  async getUserPreferences(): Promise<ApiResponse<{ timezone: string }>> {
    // Return default timezone
    return { data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } };
  }

  async updateUserPreferences(preferences: { timezone: string }): Promise<ApiResponse<{ timezone: string }>> {
    // In demo mode, just return the preferences (could store in localStorage)
    return { data: preferences };
  }

  // ==========================================
  // App Settings (Not applicable in demo mode)
  // ==========================================

  async getAppSettings(): Promise<ApiResponse<any>> {
    return { data: {} };
  }

  async updateAppSettings(settings: any): Promise<ApiResponse<any>> {
    return { data: settings };
  }

  async testDatabaseConnection(settings: any): Promise<ApiResponse<any>> {
    // Forward to real API for testing IoT connection
    return this.realRequest('/api/auth/test-iot-connection', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }
}

// Singleton instance
export const demoApiService = new DemoApiService();
