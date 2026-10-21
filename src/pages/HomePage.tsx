import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterPanel } from '../components/FilterPanel';
import { ViewSwitch } from '../components/ViewSwitch';
import { Header } from '../components/Header';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { MarketStrip } from '../components/MarketStrip';
import { StationDetail } from '../components/StationDetail';
import { StationList } from '../components/StationList';
import { StationListSkeleton, EmptyState, ErrorState } from '../components/States';
import { useFuelStations } from '../hooks/useFuelStations';
import { useGeolocation } from '../hooks/useGeolocation';
import { useStationFilters } from '../hooks/useStationFilters';
import type { FavoriteSearch, Place } from '../hooks/useStationFilters';
import type { FuelStation, StationFilters } from '../types/fuel';
import { formatDistance, nearestMunicipality } from '../utils/geo';
import { formatPlaceName } from '../utils/format';

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
  const { stations, updatedAt, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } =
    useFuelStations();
  const geo = useGeolocation();
  const { filters, patch, reset, facets, filtered, debouncedQuery, favorites, saveFavorite, applyFavorite, deleteFavorite } =
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

  // Elegir una localidad en el buscador: suelta la ubicación (pasa a ser
  // búsqueda manual), fija municipio + provincia + CCAA, muestra su nombre
  // en la caja y baja hasta el interruptor Lista/Mapa.
  const pickPlace = useCallback((p: Place) => {
    geo.clear();
    patch({ municipality: p.name, provinceId: p.provinceId, ccaaId: p.ccaaId, query: p.name });
    try {
      document.getElementById('vista')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* noop */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aviso por consola (sin ruido visual) cada vez que llegan datos nuevos.
  const loggedDataAt = useRef(0);
  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== loggedDataAt.current && stations.length > 0) {
      loggedDataAt.current = dataUpdatedAt;
      console.log(
        `[fuel] precios actualizados: ${stations.length.toLocaleString('es-ES')} estaciones (${updatedAt ?? 'sin fecha'})`,
      );
    }
  }, [dataUpdatedAt, stations.length, updatedAt]);

  // Al conceder la ubicación: resetea la búsqueda anterior, centra los
  // filtros en tu municipio (lista y mapa muestran tu ciudad) y baja hasta
  // el aviso "Estás en: …" (si no está, hasta los botones Lista/Mapa).
  // Solo una vez.
  const prevGeoStatus = useRef(geo.status);
  useEffect(() => {
    if (geo.status === 'granted' && prevGeoStatus.current !== 'granted' && geo.location) {
      reset();
      const n = stations.length > 0
        ? nearestMunicipality(stations, geo.location.latitude, geo.location.longitude)
        : null;
      if (n) {
        patch({ municipality: n.municipality, provinceId: n.provinceId, ccaaId: n.ccaaId });
      }
      try {
        (document.getElementById('donde') ?? document.getElementById('vista'))
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* noop */
      }
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

  // "Ver en mapa" desde la ficha: cierra, cambia a mapa y centra la estación.
  // El foco se consume una sola vez (FocusPoint lo limpia tras aplicarlo).
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number; key: number } | null>(null);
  const clearMapFocus = useCallback(() => setMapFocus(null), []);
  const showOnMap = useCallback((s: FuelStation) => {
    closeStation();
    changeView('map');
    if (s.hasCoords) {
      setMapFocus({ latitude: s.latitude, longitude: s.longitude, key: Date.now() });
    }
  }, [closeStation, changeView]);

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

  // Cambios manuales de territorio desde el panel o favoritas: sueltan la
  // ubicación (combustible, orden, precio y radio son refinados y la conservan).
  const clearLocation = geo.clear;
  const manualPatch = (p: Partial<StationFilters>) => {
    if (p.ccaaId !== undefined || p.provinceId !== undefined || p.municipality !== undefined) {
      clearLocation();
    }
    patch(p);
  };
  const manualApplyFavorite = (fav: FavoriteSearch) => {
    clearLocation();
    applyFavorite(fav);
  };

  const fitKey = useMemo(
    () => `${filters.ccaaId}|${filters.provinceId}|${filters.municipality}|${filters.radiusKm ?? ''}`,
    [filters.ccaaId, filters.provinceId, filters.municipality, filters.radiusKm],
  );

  // Dónde se está buscando: con ubicación, municipio de la estación más
  // cercana ("Estás en: …"); con búsqueda manual, la localidad fijada.
  const locationLabel = useMemo(() => {
    if (geo.location && stations.length > 0) {
      const n = nearestMunicipality(stations, geo.location.latitude, geo.location.longitude);
      if (n) {
        return `Estás en: ${formatPlaceName(n.municipality)} (${formatPlaceName(n.province)}) · la más cercana a ${formatDistance(n.distanceKm)}`;
      }
      return 'Ubicación activada';
    }
    if (filters.municipality) {
      const prov = facets.provinces.find((p) => p.id === filters.provinceId);
      return `Buscando en: ${formatPlaceName(filters.municipality)}${prov ? ` (${formatPlaceName(prov.name)})` : ''}`;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.location, stations, filters.municipality, filters.provinceId]);

  return (
    <>
      <Header
        query={filters.query}
        onClearText={() => patch({ query: '' })}
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
            <MarketStrip stations={stations} fuel={filters.fuel} onFuel={(f) => patch({ fuel: f })} />

            <FilterPanel
              filters={filters}
              patch={manualPatch}
              facets={facets}
              location={geo.location}
              resultCount={filtered.length}
              pendingQuery={filters.query !== debouncedQuery}
              onReset={reset}
              favorites={favorites}
              onSaveFavorite={saveFavorite}
              onApplyFavorite={manualApplyFavorite}
              onDeleteFavorite={deleteFavorite}
            />

            {locationLabel && (
              <p className="geo-place" id="donde" role="status">
                <span aria-hidden="true">{geo.location ? '📍' : '🔍'} </span>
                {locationLabel}
              </p>
            )}
            <ViewSwitch view={view} onView={changeView} />

            {filtered.length === 0 ? (
              <EmptyState onReset={reset} />
            ) : view === 'list' ? (
              <div id="listado">
                <StationList stations={filtered} fuel={filters.fuel} onSelect={openStation} />
              </div>
            ) : (
              <MapErrorBoundary>
                <Suspense fallback={<StationListSkeleton count={3} />}>
                  <StationMap
                    stations={filtered}
                    fuel={filters.fuel}
                    fitKey={fitKey}
                    center={geo.location}
                    focus={mapFocus}
                    clearFocus={clearMapFocus}
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

      <StationDetail
        station={selected}
        location={geo.location}
        onClose={closeStation}
        onShowOnMap={view === 'map' ? undefined : showOnMap}
      />
    </>
  );
}
