import { useEffect, useMemo, useState } from 'react';
import { MAIN_FUELS } from '../data/fuels';
import { CCAA_NAMES } from '../data/territory';
import type {
  FuelKey,
  FuelStation,
  SortKey,
  StationFilters,
  UserLocation,
} from '../types/fuel';
import { haversineKm } from '../utils/geo';
import { useDebouncedValue } from './useDebouncedValue';

const DEFAULT_FILTERS: StationFilters = {
  query: '',
  fuel: 'gasoline95',
  ccaaId: '',
  provinceId: '',
  municipality: '',
  maxPrice: null,
  sort: 'price-asc',
  radiusKm: null,
};

function readFromUrl(): StationFilters {
  const p = new URLSearchParams(window.location.search);
  const fuel = p.get('fuel');
  const sort = p.get('sort');
  const maxPrice = p.get('maxPrice');
  const radius = p.get('radius');
  return {
    query: p.get('q') ?? '',
    fuel: MAIN_FUELS.includes(fuel as FuelKey)
      ? (fuel as FuelKey)
      : isFuelKey(p.get('fuel'))
        ? (p.get('fuel') as FuelKey)
        : 'gasoline95',
    ccaaId: p.get('cc') ?? '',
    provinceId: p.get('prov') ?? '',
    municipality: p.get('mun') ?? '',
    maxPrice: maxPrice !== null && maxPrice !== '' && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null,
    sort: sort === 'price-desc' || sort === 'distance' || sort === 'name' ? sort : 'price-asc',
    radiusKm: radius !== null && radius !== '' && Number.isFinite(Number(radius)) ? Number(radius) : null,
  };
}

function isFuelKey(v: string | null): boolean {
  if (!v) return false;
  return [
    'gasoline95', 'gasoline95Premium', 'gasoline95E10', 'gasoline98', 'gasoline98E10',
    'diesel', 'dieselPremium', 'dieselB', 'dieselC', 'biodiesel', 'bioethanol',
    'lpg', 'cng', 'lng', 'hydrogen', 'adblue', 'dieselRenovable', 'gasolineRenovable', 'e85',
  ].includes(v);
}

function writeToUrl(f: StationFilters) {
  const p = new URLSearchParams();
  if (f.query) p.set('q', f.query);
  if (f.fuel !== 'gasoline95') p.set('fuel', f.fuel);
  if (f.ccaaId) p.set('cc', f.ccaaId);
  if (f.provinceId) p.set('prov', f.provinceId);
  if (f.municipality) p.set('mun', f.municipality);
  if (f.maxPrice !== null) p.set('maxPrice', String(f.maxPrice));
  if (f.sort !== 'price-asc') p.set('sort', f.sort);
  if (f.radiusKm !== null) p.set('radius', String(f.radiusKm));
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  window.history.replaceState(null, '', url);
}

export interface Facets {
  ccaas: { id: string; name: string }[];
  provinces: { id: string; name: string; ccaaId: string }[];
  municipalities: string[];
}

/**
 * Estado de filtros sincronizado con la URL (filtros compartibles),
 * filtrado/ordenación memoizados y cálculo de distancias.
 */
export function useStationFilters(stations: FuelStation[], location: UserLocation | null) {
  const [filters, setFilters] = useState<StationFilters>(() => {
    try {
      return readFromUrl();
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const debouncedQuery = useDebouncedValue(filters.query, 250);

  // Soporte para atrás/adelante del navegador.
  useEffect(() => {
    const onPop = () => {
      try {
        setFilters(readFromUrl());
      } catch {
        /* noop */
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    writeToUrl({ ...filters, query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filters.fuel, filters.ccaaId, filters.provinceId, filters.municipality, filters.maxPrice, filters.sort, filters.radiusKm]);

  const patch = (p: Partial<StationFilters>) =>
    setFilters((f) => {
      const next = { ...f, ...p };
      // Al cambiar de CCAA se resetea provincia/municipio; al cambiar
      // provincia se resetea municipio.
      if (p.ccaaId !== undefined && p.ccaaId !== f.ccaaId) {
        next.provinceId = '';
        next.municipality = '';
      }
      if (p.provinceId !== undefined && p.provinceId !== f.provinceId) {
        next.municipality = '';
      }
      return next;
    });

  const reset = () => setFilters((f) => ({ ...DEFAULT_FILTERS, query: '', fuel: f.fuel }));

  /** Facetas derivadas de los datos (provincias, municipios). */
  const facets: Facets = useMemo(() => {
    const provMap = new Map<string, { id: string; name: string; ccaaId: string }>();
    const munSet = new Set<string>();
    for (const s of stations) {
      if (s.provinceId) {
        if (!provMap.has(s.provinceId)) {
          provMap.set(s.provinceId, { id: s.provinceId, name: s.province, ccaaId: s.autonomousCommunityId });
        }
      }
      if (!filters.provinceId || s.provinceId === filters.provinceId) {
        if (s.municipality) munSet.add(s.municipality);
      }
    }
    const provinces = [...provMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const ccaas = Object.entries(CCAA_NAMES).map(([id, name]) => ({ id, name }));
    return { ccaas, provinces, municipalities: [...munSet].sort((a, b) => a.localeCompare(b, 'es')) };
  }, [stations, filters.provinceId]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const { fuel, ccaaId, provinceId, municipality, maxPrice, sort, radiusKm } = filters;
    let out: FuelStation[] = [];

    for (const s of stations) {
      if (ccaaId && s.autonomousCommunityId !== ccaaId) continue;
      if (provinceId && s.provinceId !== provinceId) continue;
      if (municipality && s.municipality !== municipality) continue;
      const price = s.prices[fuel];
      if (price === undefined) continue;
      if (maxPrice !== null && price > maxPrice) continue;
      if (q) {
        const hay = `${s.name} ${s.address} ${s.municipality} ${s.province} ${s.locality}`.toLowerCase();
        // Búsqueda por tokens: todos deben aparecer (en cualquier orden).
        const tokens = q.split(/\s+/).filter(Boolean);
        let ok = true;
        for (const t of tokens) {
          if (!hay.includes(t)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      let distanceKm: number | undefined;
      if (location && s.hasCoords) {
        distanceKm = haversineKm(location.latitude, location.longitude, s.latitude, s.longitude);
        if (radiusKm !== null && distanceKm > radiusKm) continue;
      }
      out.push(distanceKm === undefined ? s : { ...s, distanceKm });
    }

    out.sort((a, b) => {
      if (sort === 'price-asc') return (a.prices[fuel] ?? Infinity) - (b.prices[fuel] ?? Infinity);
      if (sort === 'price-desc') return (b.prices[fuel] ?? -Infinity) - (a.prices[fuel] ?? -Infinity);
      if (sort === 'distance') {
        if (a.distanceKm === undefined) return 1;
        if (b.distanceKm === undefined) return -1;
        return a.distanceKm - b.distanceKm;
      }
      return a.name.localeCompare(b.name, 'es');
    });
    return out;
  }, [stations, debouncedQuery, filters, location]);

  return { filters, patch, reset, facets, filtered, debouncedQuery };
}
