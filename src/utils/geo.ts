/** Distancia haversiana en km entre dos coordenadas WGS84. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface NearestPlace {
  municipality: string;
  province: string;
  provinceId: string;
  ccaaId: string;
  distanceKm: number;
}

/**
 * Municipio de la estación con coordenadas más cercana a la posición dada
 * (para mostrar "Estás en: …" y centrar la búsqueda en esa ciudad).
 * null si no hay estaciones con coords.
 */
export function nearestMunicipality(
  stations: { municipality: string; province: string; provinceId: string; autonomousCommunityId: string; latitude: number; longitude: number; hasCoords: boolean }[],
  latitude: number,
  longitude: number,
): NearestPlace | null {
  let best: NearestPlace | null = null;
  for (const s of stations) {
    if (!s.hasCoords || !s.municipality) continue;
    const d = haversineKm(latitude, longitude, s.latitude, s.longitude);
    if (!best || d < best.distanceKm) {
      best = {
        municipality: s.municipality,
        province: s.province,
        provinceId: s.provinceId,
        ccaaId: s.autonomousCommunityId,
        distanceKm: d,
      };
    }
  }
  return best;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

/** URL universal "cómo llegar" (la abre el sistema de mapas del dispositivo). */
export function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
