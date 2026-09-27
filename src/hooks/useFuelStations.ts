import { useQuery } from '@tanstack/react-query';
import { fetchStations } from '../services/fuelStationsService';

/**
 * Datos de estaciones con TanStack Query.
 *
 * Política de caché (el feed del MITECO se actualiza unas pocas veces al día,
 * no en tiempo real):
 *   - staleTime 10 min: no refetch al remontar dentro de ese margen.
 *   - gcTime 60 min: conserva datos viejos para navegación fluida/offline.
 *   - refetchInterval 15 min: actualización automática mientras se navega.
 *   - Si un refetch falla, React Query conserva los datos anteriores y
 *     marca `isError` sin vaciar la pantalla (stale-while-revalidate).
 */
export function useFuelStations() {
  const query = useQuery({
    queryKey: ['fuel-stations'],
    queryFn: fetchStations,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
  });

  return {
    stations: query.data?.stations ?? [],
    updatedAt: query.data?.updatedAt ?? null,
    stale: query.data?.stale ?? false,
    warning: query.data?.warning,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError && !query.data,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}
