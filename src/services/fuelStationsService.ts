import { FUELS } from '../data/fuels';
import { getCcaaName } from '../data/territory';
import type {
  FuelStation,
  RawMitecoStation,
  StationsApiResponse,
} from '../types/fuel';
import { parseMitecoFecha } from '../utils/format';

/**
 * Capa de acceso a datos. Los componentes NUNCA llaman a fetch directamente:
 * usan los hooks (`useFuelStations`), que a su vez usan estas funciones.
 *
 * Flujo:  proxy propio (/api/stations) → normalizeFuelStation() → FuelStation
 * El proxy cachea el feed del MITECO y evita el bloqueo CORS del navegador.
 */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') detail = body.message;
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(detail || `Error ${res.status} al obtener las gasolineras`);
  }
  return res.json() as Promise<T>;
}

export interface StationsResult {
  stations: FuelStation[];
  /** Fecha oficial del feed MITECO en ISO. */
  updatedAt: string;
  /** true si son datos en caché porque MITECO falló al revalidar. */
  stale: boolean;
  warning?: string;
}

/** "1,849" → 1.849 · "" → undefined */
export function parseMitecoPrice(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = raw.trim();
  if (t === '' || t === '-') return undefined;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** "39,211417" → 39.211417 · "" → NaN */
function parseCoord(raw: string | undefined): number {
  if (!raw) return NaN;
  const n = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(n) && n !== 0 ? n : NaN;
}

export function normalizeFuelStation(
  raw: RawMitecoStation,
  lastUpdated: string,
): FuelStation {
  const lat = parseCoord(raw['Latitud']);
  const lon = parseCoord(raw['Longitud (WGS84)']);
  const prices: FuelStation['prices'] = {};
  for (const fuel of FUELS) {
    const v = parseMitecoPrice(raw[fuel.apiField]);
    if (v !== undefined) prices[fuel.key] = v;
  }
  return {
    id: raw.IDEESS ?? '',
    name: (raw['Rótulo'] ?? '').trim() || 'Sin rótulo',
    address: (raw['Dirección'] ?? '').trim(),
    postalCode: (raw['C.P.'] ?? '').trim(),
    locality: (raw['Localidad'] ?? '').trim(),
    municipality: (raw['Municipio'] ?? '').trim(),
    province: (raw['Provincia'] ?? '').trim(),
    provinceId: (raw['IDProvincia'] ?? '').trim(),
    autonomousCommunity: getCcaaName((raw['IDCCAA'] ?? '').trim()),
    autonomousCommunityId: (raw['IDCCAA'] ?? '').trim(),
    latitude: lat,
    longitude: lon,
    hasCoords: Number.isFinite(lat) && Number.isFinite(lon),
    prices,
    schedule: (raw['Horario'] ?? '').trim(),
    saleType: (raw['Tipo Venta'] ?? '').trim(),
    lastUpdated,
  };
}

export async function fetchStations(): Promise<StationsResult> {
  const data = await fetchJson<StationsApiResponse>('/api/stations');
  const updatedAt = parseMitecoFecha(data.fecha, data.updatedAt);
  const stations = data.stations.map((raw) => normalizeFuelStation(raw, updatedAt));
  return { stations, updatedAt, stale: data.stale, warning: data.warning };
}
