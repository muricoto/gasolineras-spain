import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { CheapestSection } from '../components/CheapestSection';
import { FilterPanel } from '../components/FilterPanel';
import { Header } from '../components/Header';
import { StationDetail } from '../components/StationDetail';
import { StationList } from '../components/StationList';
import { StationListSkeleton, EmptyState, ErrorState } from '../components/States';
import { StatusBar } from '../components/StatusBar';
import { useFuelStations } from '../hooks/useFuelStations';
import { useGeolocation } from '../hooks/useGeolocation';
import { useStationFilters } from '../hooks/useStationFilters';
import type { FuelStation } from '../types/fuel';

const StationMap = lazy(() =>
  import('../components/StationMap').then((m) => ({ default: m.StationMap })),
);

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function stationIdFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('station');
  } catch {
    return null;
  }
}

function setStationIdInUrl(id: string | null) {
  try {
    const p = new URLSearchParams(window.location.search);
    if (id) p.set('station', id);
    else p.delete('station');
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  } catch {
    /* noop */
  }
}

function viewFromUrl(): 'list' | 'map' {
  try {
    return new URLSearchParams(window.location.search).get('view') === 'map' ? 'map' : 'list';
  } catch {
    return 'list';
  }
}

/** Página principal: listado/buscador de gasolineras. */
export function HomePage({ theme, onToggleTheme }: Props) {
  const { stations, updatedAt, stale, warning, isLoading, isFetching, isError, error, refetch } =
    useFuelStations();
  const geo = useGeolocation();
  const { filters, patch, reset, facets, filtered } = useStationFilters(stations, geo.location);

  const [view, setView] = useState<'list' | 'map'>(viewFromUrl);
  const [selected, setSelected] = useState<FuelStation | null>(null);

  const changeView = useCallback((v: 'list' | 'map') => {
    setView(v);
    try {
      const p = new URLSearchParams(window.location.search);
      if (v === 'map') p.set('view', 'map');
      else p.delete('view');
      const qs = p.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    } catch {
      /* noop */
    }
  }, []);

  const openStation = useCallback((s: FuelStation) => {
    setSelected(s);
    setStationIdInUrl(s.id);
  }, []);

  const closeStation = useCallback(() => {
    setSelected(null);
    setStationIdInUrl(null);
  }, []);

  // Deep-link ?station=ID: abre el detalle cuando llegan los datos.
  useEffect(() => {
    if (selected || stations.length === 0) return;
    const id = stationIdFromUrl();
    if (!id) return;
    const found = stations.find((s) => s.id === id);
    if (found) setSelected(found);
  }, [stations, selected]);

  // Si el usuario ordena por distancia sin ubicación, se pide con el cambio.
  useEffect(() => {
    if (filters.sort === 'distance' && !geo.location && geo.status === 'idle') {
      geo.request();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sort]);

  const fitKey = useMemo(
    () => `${filters.ccaaId}|${filters.provinceId}|${filters.municipality}|${filters.radiusKm ?? ''}`,
    [filters.ccaaId, filters.provinceId, filters.municipality, filters.radiusKm],
  );

  return (
    <>
      <Header
        query={filters.query}
        onQuery={(q) => patch({ query: q })}
        locationStatus={geo.status}
        hasLocation={geo.location !== null}
        onUseLocation={geo.request}
        onClearLocation={geo.clear}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <main className="container">
        <StatusBar
          updatedAt={updatedAt}
          count={stations.length}
          stale={stale}
          warning={warning}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />

        {geo.error && !geo.location && (
          <p className="geo-error" role="status">
            {geo.error}
          </p>
        )}

        {isLoading ? (
          <>
            <div className="filters filters-skeleton" aria-hidden="true">
              <div className="sk sk-chips" />
              <div className="sk sk-bar" />
            </div>
            <StationListSkeleton />
          </>
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : 'Error desconocido al cargar los datos.'}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        ) : (
          <>
            {view === 'list' && (
              <CheapestSection
                stations={filtered}
                fuel={filters.fuel}
                location={geo.location}
                onSelect={openStation}
              />
            )}

            <FilterPanel
              filters={filters}
              patch={patch}
              facets={facets}
              location={geo.location}
              view={view}
              onView={changeView}
              resultCount={filtered.length}
            />

            {filtered.length === 0 ? (
              <EmptyState onReset={reset} />
            ) : view === 'list' ? (
              <StationList stations={filtered} fuel={filters.fuel} onSelect={openStation} />
            ) : (
              <Suspense fallback={<StationListSkeleton count={3} />}>
                <StationMap
                  stations={filtered}
                  fuel={filters.fuel}
                  fitKey={fitKey}
                  center={geo.location}
                  onSelect={openStation}
                />
              </Suspense>
            )}
          </>
        )}

        <footer className="footer">
          <p>
            Datos oficiales del{' '}
            <a
              href="https://geoportalgasolineras.es/geoportal-inicio"
              target="_blank"
              rel="noopener noreferrer"
            >
              Geoportal de Hidrocarburos del MITECO
            </a>
            . Precios con impuestos incluidos según la fuente oficial.
          </p>
        </footer>
      </main>

      <StationDetail station={selected} location={geo.location} onClose={closeStation} />
    </>
  );
}
