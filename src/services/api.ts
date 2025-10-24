// API service for backend communication
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...options.headers,
        },
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
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network request failed',
        },
      };
    }
  }

  async executeTableQuery(params: TableQueryParams): Promise<ApiResponse<TableQueryResult>> {
    return this.request<TableQueryResult>('/api/sql/table', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async executeTileQuery(params: TileQueryParams): Promise<ApiResponse<TileQueryResult>> {
    return this.request<TileQueryResult>('/api/sql/tile', {
      method: 'POST',
      body: JSON.stringify(params),
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
    return this.request('/api/settings');
  }

  async updateAppSettings(settings: any): Promise<ApiResponse<any>> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testDatabaseConnection(settings: any): Promise<ApiResponse<any>> {
    return this.request('/api/settings/test-connection', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Reports and Sections
  async getSections(): Promise<ApiResponse<any[]>> {
    const response = await this.request('/api/sections');
    if (response.data && response.data.sections) {
      return { data: response.data.sections };
    }
    return response;
  }

  async getReports(): Promise<ApiResponse<any[]>> {
    const response = await this.request('/api/reports');
    if (response.data && response.data.reports) {
      return { data: response.data.reports };
    }
    return response;
  }

  async getReportById(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reports/${id}`);
  }

  async createSection(name: string, sortIndex: number): Promise<ApiResponse<any>> {
    const response = await this.request('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ name, sort_index: sortIndex }),
    });
    if (response.data && response.data.section) {
      return { data: response.data.section };
    }
    return response;
  }

  async updateSection(id: string, name: string): Promise<ApiResponse<any>> {
    const response = await this.request(`/api/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    if (response.data && response.data.section) {
      return { data: response.data.section };
    }
    return response;
  }

  async createReport(reportData: any): Promise<ApiResponse<any>> {
    const response = await this.request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
    if (response.data && response.data.report) {
      return { data: response.data.report };
    }
    return response;
  }

  async updateReport(id: string, reportData: any): Promise<ApiResponse<any>> {
    const response = await this.request(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reportData),
    });
    if (response.data && response.data.report) {
      return { data: response.data.report };
    }
    return response;
  }

  async deleteReport(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reports/${id}`, {
      method: 'DELETE',
    });
  }

  // Schema
  async getExampleSchema(): Promise<ApiResponse<any>> {
    return this.request('/api/schema/example');
  }

  async getSchemaConfig(): Promise<ApiResponse<{ defaultUrl: string }>> {
    return this.request('/api/schema/config');
  }
}

export const apiService = new ApiService();

