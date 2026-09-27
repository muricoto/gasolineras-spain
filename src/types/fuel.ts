/**
 * Modelo interno de la aplicación.
 * La forma cruda del MITECO se define en `RawMitecoStation` y se convierte
 * a `FuelStation` mediante `normalizeFuelStation()` (ver services/).
 */

/** Claves internas de carburante. */
export type FuelKey =
  | 'gasoline95'
  | 'gasoline95Premium'
  | 'gasoline95E10'
  | 'gasoline98'
  | 'gasoline98E10'
  | 'diesel'
  | 'dieselPremium'
  | 'dieselB'
  | 'dieselC'
  | 'lpg'
  | 'cng'
  | 'lng'
  | 'biodiesel'
  | 'bioethanol'
  | 'hydrogen'
  | 'adblue'
  | 'dieselRenovable'
  | 'gasolineRenovable'
  | 'e85';

/** Registro crudo tal como lo devuelve el MITECO (`ListaEESSPrecio[]`). */
export interface RawMitecoStation {
  IDEESS: string;
  'Rótulo': string;
  'Dirección': string;
  'C.P.': string;
  Localidad: string;
  Municipio: string;
  Provincia: string;
  Latitud: string;
  'Longitud (WGS84)': string;
  Horario: string;
  'Tipo Venta': string;
  'Remisión': string;
  Margen: string;
  IDMunicipio: string;
  IDProvincia: string;
  IDCCAA: string;
  [priceField: string]: string;
}

/** Respuesta del proxy propio (`GET /api/stations`). */
export interface StationsApiResponse {
  /** Campo `Fecha` del feed MITECO, ej. "27/09/2026 14:06:30". */
  fecha: string | null;
  count: number;
  /** Cuándo descargó el proxy el feed (ISO). */
  updatedAt: string;
  /** true si se sirven datos caducados porque MITECO falló. */
  stale: boolean;
  warning?: string;
  stations: RawMitecoStation[];
}

/** Estación normalizada lista para la UI. */
export interface FuelStation {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  locality: string;
  municipality: string;
  province: string;
  provinceId: string;
  autonomousCommunity: string;
  autonomousCommunityId: string;
  latitude: number;
  longitude: number;
  /** false cuando la estación no trae coordenadas válidas. */
  hasCoords: boolean;
  prices: Partial<Record<FuelKey, number>>;
  schedule: string;
  saleType: string;
  /** Fecha oficial del feed MITECO en ISO (misma para todas las estaciones). */
  lastUpdated: string;
  /** Distancia en km respecto al usuario (solo si hay geolocalización). */
  distanceKm?: number;
}

export type SortKey = 'price-asc' | 'price-desc' | 'distance' | 'name';

export interface StationFilters {
  query: string;
  fuel: FuelKey;
  ccaaId: string;
  provinceId: string;
  municipality: string;
  maxPrice: number | null;
  sort: SortKey;
  radiusKm: number | null;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}
