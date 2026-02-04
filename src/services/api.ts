// API service for backend communication
import { isDemoMode } from './demoApi';
import { demoApiService } from './demoApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface TableQueryParams {
  sql: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface TableQueryResult {
  columns: string[];
  rows: any[];
  columnTypes: Record<string, string>;
  total: number;
  page: number;
  pageSize: number;
}

export interface TileQueryParams {
  sql: string;
}

export interface TileQueryResult {
  value: number | null;
}

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  private async request<T>(
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

  async executeTableQuery(params: TableQueryParams): Promise<ApiResponse<TableQueryResult>> {
    // SQL queries always go to real backend, even in demo mode
    return this.request<TableQueryResult>('/api/sql/table', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async executeTileQuery(params: TileQueryParams): Promise<ApiResponse<TileQueryResult>> {
    // SQL queries always go to real backend, even in demo mode
    return this.request<TileQueryResult>('/api/sql/tile', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // New parameterized SQL execution method using the validated endpoint
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
    // SQL queries always go to real backend, even in demo mode
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

    // Add pagination if provided
    if (params.pagination) {
      requestBody.pagination = params.pagination;
    }

    return this.request('/api/sql-new/execute', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async testConnection(): Promise<ApiResponse<{ success: boolean; message: string; result: any }>> {
    return this.request('/api/sql/test-connection', {
      method: 'POST',
    });
  }

  async clearCache(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/api/sql/clear-cache', {
      method: 'POST',
    });
  }

  async getHealthStatus(): Promise<ApiResponse<any>> {
    return this.request('/health');
  }

  // App Settings
  async getAppSettings(): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.getAppSettings();
    }
    return this.request('/api/settings');
  }

  async updateAppSettings(settings: any): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.updateAppSettings(settings);
    }
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testDatabaseConnection(settings: any): Promise<ApiResponse<any>> {
    // Always use real backend for connection testing
    return this.request('/api/settings/test-connection', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Reports and Sections
  async getSections(): Promise<ApiResponse<any[]>> {
    if (isDemoMode()) {
      return demoApiService.getSections();
    }
    const response = await this.request('/api/sections');
    if (response.data && (response.data as any).sections) {
      return { data: (response.data as any).sections };
    }
    return response as ApiResponse<any[]>;
  }

  async getReports(): Promise<ApiResponse<any[]>> {
    if (isDemoMode()) {
      return demoApiService.getReports();
    }
    const response = await this.request('/api/reports');
    if (response.data && (response.data as any).reports) {
      return { data: (response.data as any).reports };
    }
    return response as ApiResponse<any[]>;
  }

  async getReportById(id: string): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.getReportById(id);
    }
    return this.request(`/api/reports/${id}`);
  }

  async createSection(name: string, sortOrder?: number): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.createSection(name, sortOrder);
    }
    const response = await this.request('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ 
        name, 
        sort_order: sortOrder || 0
      }),
    });
    if (response.data && (response.data as any).section) {
      return { data: (response.data as any).section };
    }
    return response;
  }

  async updateSection(id: string, name: string): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.updateSection(id, name);
    }
    const response = await this.request(`/api/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    if (response.data && (response.data as any).section) {
      return { data: (response.data as any).section };
    }
    return response;
  }

  async createReport(reportData: {
    title: string;
    section_id?: string | null;
    slug?: string;
    sort_order?: number;
    report_schema: any;
  }): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.createReport(reportData);
    }
    const response = await this.request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
    if (response.data && (response.data as any).report) {
      return { data: (response.data as any).report };
    }
    return response;
  }

  async updateReport(id: string, reportData: any): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.updateReport(id, reportData);
    }
    const response = await this.request(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reportData),
    });
    if (response.data && (response.data as any).report) {
      return { data: (response.data as any).report };
    }
    return response;
  }



  async reorderSections(sections: Array<{ id: string; sort_index: number }>): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.reorderSections(sections);
    }
    return this.request('/api/sections/reorder', {
      method: 'PUT',
      body: JSON.stringify({ sections }),
    });
  }

  async reorderReports(reports: Array<{ id: string; sort_index: number; section_id?: string | null }>): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.reorderReports(reports);
    }
    return this.request('/api/reports/reorder', {
      method: 'PUT',
      body: JSON.stringify({ reports }),
    });
  }

  // Schema
  async getExampleSchema(): Promise<ApiResponse<any>> {
    // Schema always from real backend
    return this.request('/api/schema/example');
  }

  async getSchemaConfig(): Promise<ApiResponse<{ defaultUrl: string }>> {
    // Schema config always from real backend
    return this.request('/api/schema/config');
  }

  // Menu Management API (v1)
  async getMenuTree(includeDeleted: boolean = false): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.getMenuTree(includeDeleted);
    }
    return this.request(`/api/v1/menu/tree?include_deleted=${includeDeleted}`);
  }

  async reorderMenu(payload: any): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.reorderMenu(payload);
    }
    try {
      const result = await this.request('/api/v1/menu/reorder', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      
      return result;
    } catch (error) {
      console.error('API: reorderMenu error:', error);
      throw error;
    }
  }

  async renameSection(id: string, name: string, version: number): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.renameSection(id, name, version);
    }
    return this.request(`/api/v1/sections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, version }),
    });
  }

  async renameReport(id: string, name: string, version: number): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.renameReport(id, name, version);
    }
    return this.request(`/api/v1/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, version }),
    });
  }

  async deleteSection(id: string, strategy: 'move_children_to_root' | 'delete_children'): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.deleteSection(id, strategy);
    }
    return this.request(`/api/v1/sections/${id}/delete`, {
      method: 'PATCH',
      body: JSON.stringify({ strategy }),
    });
  }

  async deleteReport(id: string): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.deleteReport(id);
    }
    return this.request(`/api/v1/reports/${id}/delete`, {
      method: 'PATCH',
    });
  }

  async restoreSection(id: string): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.restoreSection(id);
    }
    return this.request(`/api/v1/sections/${id}/restore`, {
      method: 'PATCH',
    });
  }

  async restoreReport(id: string): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.restoreReport(id);
    }
    return this.request(`/api/v1/reports/${id}/restore`, {
      method: 'PATCH',
    });
  }

  // Global Variables
  async getGlobalVariables(): Promise<ApiResponse<any[]>> {
    if (isDemoMode()) {
      return demoApiService.getGlobalVariables();
    }
    const response = await this.request('/api/global-variables');
    if (response.data && (response.data as any).variables) {
      return { data: (response.data as any).variables };
    }
    return response as ApiResponse<any[]>;
  }

  async createGlobalVariable(data: {
    label: string;
    description?: string;
    value?: string;
  }): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.createGlobalVariable(data);
    }
    const response = await this.request('/api/global-variables', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.data && (response.data as any).variable) {
      return { data: (response.data as any).variable };
    }
    return response;
  }

  async updateGlobalVariable(id: string, data: {
    label?: string;
    description?: string;
    value?: string;
  }): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.updateGlobalVariable(id, data);
    }
    const response = await this.request(`/api/global-variables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.data && (response.data as any).variable) {
      return { data: (response.data as any).variable };
    }
    return response;
  }

  async deleteGlobalVariable(id: string): Promise<ApiResponse<any>> {
    if (isDemoMode()) {
      return demoApiService.deleteGlobalVariable(id);
    }
    return this.request(`/api/global-variables/${id}`, {
      method: 'DELETE',
    });
  }

  // User Preferences
  async getUserPreferences(): Promise<ApiResponse<{ timezone: string }>> {
    if (isDemoMode()) {
      return demoApiService.getUserPreferences();
    }
    const response = await this.request('/api/user/preferences');
    if (response.data && (response.data as any).preferences) {
      return { data: (response.data as any).preferences };
    }
    return response as ApiResponse<{ timezone: string }>;
  }

  async updateUserPreferences(preferences: { timezone: string }): Promise<ApiResponse<{ timezone: string }>> {
    if (isDemoMode()) {
      return demoApiService.updateUserPreferences(preferences);
    }
    const response = await this.request('/api/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
    if (response.data && (response.data as any).preferences) {
      return { data: (response.data as any).preferences };
    }
    return response as ApiResponse<{ timezone: string }>;
  }

  // ==========================================
  // Composite Reports API
  // ==========================================

  async getCompositeReports(): Promise<ApiResponse<any[]>> {
    const response = await this.request('/api/composite-reports');
    if (response.data && (response.data as any).data) {
      return { data: (response.data as any).data };
    }
    return response as ApiResponse<any[]>;
  }

  async getCompositeReportById(id: string): Promise<ApiResponse<any>> {
    const response = await this.request(`/api/composite-reports/${id}`);
    if (response.data && (response.data as any).data) {
      return { data: (response.data as any).data };
    }
    return response;
  }

  async createCompositeReport(data: {
    title: string;
    description?: string;
    slug?: string;
    section_id?: string | null;
    sort_order?: number;
    sql_query: string;
    config: any;
    report_schema?: any;
  }): Promise<ApiResponse<any>> {
    const response = await this.request('/api/composite-reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.data && (response.data as any).data) {
      return { data: (response.data as any).data };
    }
    return response;
  }

  async updateCompositeReport(id: string, data: {
    title?: string;
    description?: string;
    slug?: string;
    section_id?: string | null;
    sort_order?: number;
    sql_query?: string;
    config?: any;
    report_schema?: any;
  }): Promise<ApiResponse<any>> {
    const response = await this.request(`/api/composite-reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.data && (response.data as any).data) {
      return { data: (response.data as any).data };
    }
    return response;
  }

  async deleteCompositeReport(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/composite-reports/${id}`, {
      method: 'DELETE',
    });
  }

  async executeCompositeReport(id: string, params?: {
    page?: number;
    pageSize?: number;
    params?: Record<string, unknown>;
  }): Promise<ApiResponse<any>> {
    const response = await this.request(`/api/composite-reports/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
    if (response.data && (response.data as any).data) {
      return { data: (response.data as any).data };
    }
    return response;
  }

  async detectCompositeReportColumns(id: string): Promise<ApiResponse<any>> {
    const response = await this.request(`/api/composite-reports/${id}/detect-columns`, {
      method: 'POST',
    });
    if (response.data && (response.data as any).data) {
      return { data: (response.data as any).data };
    }
    return response;
  }

  async exportCompositeReportExcel(id: string, options?: {
    params?: Record<string, unknown>;
    geocodedAddresses?: Record<string, string>;
    latColumn?: string;
    lonColumn?: string;
    format?: 'xlsx' | 'csv';
  }): Promise<Blob | null> {
    try {
      const url = `${API_BASE_URL}/api/composite-reports/${id}/export/excel`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(options || {}),
      });

      if (!response.ok) {
        console.error('Export failed:', response.status);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('Export error:', error);
      return null;
    }
  }

  async exportCompositeReportHTML(id: string, options?: {
    params?: Record<string, unknown>;
    includeChart?: boolean;
    includeMap?: boolean;
    geocodedAddresses?: Record<string, string>;
    latColumn?: string;
    lonColumn?: string;
    chartSettings?: {
      xColumn?: string;
      yColumn?: string;
      groupColumn?: string;
    };
    mapSettings?: {
      center: [number, number];
      zoom: number;
    };
  }): Promise<Blob | null> {
    try {
      const url = `${API_BASE_URL}/api/composite-reports/${id}/export/html`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(options || {}),
      });

      if (!response.ok) {
        console.error('Export failed:', response.status);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('Export error:', error);
      return null;
    }
  }

  async exportCompositeReportPDF(id: string, options?: {
    params?: Record<string, unknown>;
    includeChart?: boolean;
    includeMap?: boolean;
    geocodedAddresses?: Record<string, string>;
    latColumn?: string;
    lonColumn?: string;
    chartSettings?: {
      xColumn?: string;
      yColumn?: string;
      groupColumn?: string;
    };
    mapSettings?: {
      center: [number, number];
      zoom: number;
    };
  }): Promise<Blob | null> {
    try {
      const url = `${API_BASE_URL}/api/composite-reports/${id}/export/pdf`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(options || {}),
      });

      if (!response.ok) {
        console.error('PDF Export failed:', response.status);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('PDF Export error:', error);
      return null;
    }
  }

  // Geocoding
  async geocodeBatch(coordinates: { lat: number; lng: number }[]): Promise<ApiResponse<{
    results: { lat: number; lng: number; address: string | null }[];
  }>> {
    return this.request('/api/composite-reports/geocode-batch', {
      method: 'POST',
      body: JSON.stringify({ coordinates }),
    });
  }
}

export const apiService = new ApiService();
