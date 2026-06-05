import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { normalizeReportsForSearch, type SearchableDashboard } from '@/utils/dashboardSearch';

export const dashboardSearchQueryKeys = {
  all: ['dashboard-search'] as const,
  reports: () => [...dashboardSearchQueryKeys.all, 'reports'] as const,
};

export function useDashboardSearchReports() {
  const { user } = useAuth();

  return useQuery<SearchableDashboard[]>({
    queryKey: dashboardSearchQueryKeys.reports(),
    queryFn: async () => {
      const response = await apiService.getReports();
      if (response.error) {
        throw new Error(response.error.message);
      }
      return normalizeReportsForSearch((response.data || []) as Record<string, unknown>[]);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
