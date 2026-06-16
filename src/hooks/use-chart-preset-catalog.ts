import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import type { ChartCatalog } from '@/types/chart-catalog';

const EMPTY_CATALOG: ChartCatalog = { schemaVersion: '1.0', groups: [] };

/**
 * Loads the drag-n-drop Chart Library preset catalog (FR-11365).
 *
 * Backed by `dashboard_studio_meta_data.chart_preset_catalog` (analyst-maintained
 * singleton row); in demo mode it reads the copy seeded into IndexedDB at login.
 * Returns React Query state — consumers use `data.groups`, `isLoading`, `isError`.
 */
export function useChartPresetCatalog() {
  const { user } = useAuth();

  return useQuery<ChartCatalog>({
    queryKey: ['chart-preset-catalog'],
    queryFn: async () => {
      const response = await apiService.getChartCatalog();
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data ?? EMPTY_CATALOG;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
