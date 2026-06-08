import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

export const dashboardSearchQueryKeys = {
  all: ['dashboard-search'] as const,
  reports: () => [...dashboardSearchQueryKeys.all, 'reports'] as const,
};

export function invalidateDashboardSearchCache() {
  return queryClient.invalidateQueries({ queryKey: dashboardSearchQueryKeys.reports() });
}
