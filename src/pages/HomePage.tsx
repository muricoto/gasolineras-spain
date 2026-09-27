import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheapestSection } from '../components/CheapestSection';
import { FilterPanel } from '../components/FilterPanel';
import { Header } from '../components/Header';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { MarketStrip } from '../components/MarketStrip';
import { StationDetail } from '../components/StationDetail';
import { StationList } from '../components/StationList';
import { StationListSkeleton, EmptyState, ErrorState } from '../components/States';
import { StatusBar } from '../components/StatusBar';
import { useFuelStations } from '../hooks/useFuelStations';
import { useGeolocation } from '../hooks/useGeolocation';
import { useStationFilters } from '../hooks/useStationFilters';
import type { Place } from '../hooks/useStationFilters';
import type { FuelStation } from '../types/fuel';
import { normalizeSearchText } from '../utils/format';

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
  const { stations, updatedAt, stale, isLoading, isFetching, isError, error, refetch } =
    useFuelStations();
  const geo = useGeolocation();
  const { filters, patch, reset, newSearch, facets, filtered, debouncedQuery, favorites, saveFavorite, applyFavorite, deleteFavorite } =
    useStationFilters(stations, geo.location);

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

  // Elegir una localidad en el buscador: fija municipio + provincia + CCAA
  // y muestra su nombre en la caja (filtro exacto y texto coinciden).
  const pickPlace = useCallback((p: Place) => {
    patch({ municipality: p.name, provinceId: p.provinceId, ccaaId: p.ccaaId, query: p.name });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Al conceder la ubicación: resetea la búsqueda anterior. El orden se
  // mantiene siempre de menor a mayor (las cercanas se acotan con el radio).
  // Solo una vez por concesión.
  const prevGeoStatus = useRef(geo.status);
  useEffect(() => {
    if (geo.status === 'granted' && prevGeoStatus.current !== 'granted') {
      reset();
    }
    prevGeoStatus.current = geo.status;
  }, [geo.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sin ubicación no tiene sentido ordenar por distancia: vuelve a precio.
  useEffect(() => {
    if (!geo.location && filters.sort === 'distance') {
      patch({ sort: 'price-asc' });
    }
  }, [geo.location, filters.sort]); // eslint-disable-line react-hooks/exhaustive-deps

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
        onQuery={(q) => {
          // Búsqueda nueva (de vacío a texto): resetea todos los filtros
          // salvo el combustible. Si se edita el texto tras fijar una
          // localidad y ya no coincide, se suelta el candado exacto.
          if (!filters.query && q) newSearch(q);
          else if (filters.municipality && normalizeSearchText(q) !== normalizeSearchText(filters.municipality)) {
            patch({ query: q, municipality: '' });
          } else patch({ query: q });
        }}
        places={facets.places}
        onPickPlace={pickPlace}
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
            <MarketStrip stations={stations} fuel={filters.fuel} />

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
              pendingQuery={filters.query !== debouncedQuery}
              onReset={reset}
              favorites={favorites}
              onSaveFavorite={saveFavorite}
              onApplyFavorite={applyFavorite}
              onDeleteFavorite={deleteFavorite}
            />

            {filtered.length === 0 ? (
              <EmptyState onReset={reset} />
            ) : view === 'list' ? (
              <StationList stations={filtered} fuel={filters.fuel} onSelect={openStation} />
            ) : (
              <MapErrorBoundary>
                <Suspense fallback={<StationListSkeleton count={3} />}>
                  <StationMap
                    stations={filtered}
                    fuel={filters.fuel}
                    fitKey={fitKey}
                    center={geo.location}
                    onSelect={openStation}
                  />
                </Suspense>
              </MapErrorBoundary>
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
