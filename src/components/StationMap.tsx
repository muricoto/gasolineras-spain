import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import Supercluster from 'supercluster';
import type { FuelKey, FuelStation } from '../types/fuel';
import { formatPriceShort, priceTone } from '../utils/format';

const MAX_MARKERS = 8000;

interface MapPoint {
  type: 'Feature';
  properties: { stationId: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
}

function dotIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mk-wrap',
    html: '<span class="mk-dot"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

/** Pin "estás aquí": gota azul con centro blanco. */
function userIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mk-wrap',
    html: '<span class="mk-user"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 24],
  });
}

function clusterIcon(count: number): L.DivIcon {  const size = count > 500 ? 52 : count > 100 ? 44 : 36;
  return L.divIcon({
    className: 'mk-wrap',
    html: `<span class="mk-cluster" style="width:${size}px;height:${size}px">${count > 999 ? `${Math.round(count / 100) / 10}k` : count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ fitSignal, points, focusKey }: { fitSignal: string; points: MapPoint[]; focusKey: number | null }) {
  const map = useMap();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    // Encuadra al montar la vista y cuando cambia el territorio/búsqueda.
    // Los refrescos de datos no tocan la señal, así no se pierde la posición.
    // Si hay un foco ("Ver en mapa"), manda FocusPoint y aquí no se toca nada.
    if (prev.current === fitSignal) return;
    prev.current = fitSignal;
    if (points.length === 0) return;
    if (focusKey !== null) return;
    // Encaje robusto: con conjuntos grandes se descarta el 5 % de los extremos
    // en lat y lng, para que una coincidencia lejana (calle homónima en otra
    // provincia al buscar) no aleje la vista de donde está el grueso.
    const fitBox = (vals: number[]): [number, number] => {
      if (vals.length < 40) return [vals[0], vals[vals.length - 1]];
      const lo = vals[Math.floor(vals.length * 0.05)];
      const hi = vals[Math.ceil(vals.length * 0.95) - 1];
      return [lo, hi];
    };
    const lats = points.map((p) => p.geometry.coordinates[1]).sort((a, b) => a - b);
    const lngs = points.map((p) => p.geometry.coordinates[0]).sort((a, b) => a - b);
    const [sLat, eLat] = fitBox(lats);
    const [sLng, eLng] = fitBox(lngs);
    const bounds = L.latLngBounds([sLat, sLng], [eLat, eLng]);
    map.fitBounds(bounds.pad(0.1), { animate: true });
  }, [fitSignal, points, map, focusKey]);
  return null;
}

function FocusPoint({ focus, clearFocus }: {
  focus: { latitude: number; longitude: number; key: number } | null;
  clearFocus: () => void;
}) {  const map = useMap();
  const prevKey = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || prevKey.current === focus.key) return;
    prevKey.current = focus.key;
    map.setView([focus.latitude, focus.longitude], 15, { animate: true });
    clearFocus();
  }, [focus, map, clearFocus]);
  return null;
}

/** Punto azul "estás aquí" en un panel propio por encima de marcadores,
 * clusters y etiquetas de precio: nunca queda tapado. El panel se crea
 * antes de montar el marcador (Leaflet falla si el panel no existe). */
function UserMarker({ center }: { center: { latitude: number; longitude: number } }) {  const map = useMap();
  const [ready, setReady] = useState(() => map.getPane('userPane') !== undefined);
  useEffect(() => {
    if (!map.getPane('userPane')) {
      const pane = map.createPane('userPane');
      pane.style.zIndex = '680';
      pane.style.pointerEvents = 'none';
    }
    setReady(true);
  }, [map]);
  if (!ready) return null;
  return (
    <Marker
      position={[center.latitude, center.longitude]}
      icon={userIcon()}
      pane="userPane"
      interactive={false}
      keyboard={false}
      title="Estás aquí"
    />
  );
}

/**
 * Botón "ir a mi ubicación" sobre el mapa (arriba a la derecha, como el de
 * Google Maps). Solo visible con ubicación activa: centra el mapa en tu
 * posición exacta si te has desplazado mirando otras zonas.
 */
function RecenterControl({ center }: { center: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    const ctrl = new L.Control({ position: 'topright' });
    ctrl.onAdd = () => {
      const btn = L.DomUtil.create('button', 'map-recenter') as HTMLButtonElement;
      btn.type = 'button';
      btn.title = 'Ir a mi ubicación';
      btn.setAttribute('aria-label', 'Centrar el mapa en mi ubicación');
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round" /></svg>';
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        map.setView([center.latitude, center.longitude], 14, { animate: true });
      });
      return btn;
    };
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map, center]);
  return null;
}

function ClusterLayer({
  points,
  byId,
  fuel,
  onSelect,
}: {
  points: MapPoint[];
  byId: Map<string, FuelStation>;
  fuel: FuelKey;
  onSelect: (s: FuelStation) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bbox, setBbox] = useState<[number, number, number, number]>(() => {
    const b = map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  });

  useEffect(() => {
    const update = () => {
      const b = map.getBounds();
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      setZoom(map.getZoom());
    };
    map.on('moveend zoomend', update);
    return () => {
      map.off('moveend zoomend', update);
    };
  }, [map]);

  const index = useMemo(() => {
    const sc = new Supercluster({ radius: 45, maxZoom: 14, minPoints: 2 });
    sc.load(points as never);
    return sc;
  }, [points]);

  const clusters = useMemo(() => {
    try {
      return index.getClusters(bbox, Math.round(zoom));
    } catch {
      return [];
    }
  }, [index, bbox, zoom]);

  // Etiquetas de precio: a partir de zoom 7 y con tope de puntos sueltos
  // para no petar el DOM cuando se ven cientos a la vez.
  let singles = 0;
  for (const c of clusters) {
    if (!(c.properties as { cluster?: boolean }).cluster) singles++;
  }
  const showPrices = zoom >= 7 && singles <= 1000;

  // Precios del combustible activo por municipio, ordenados: la más barata
  // de cada ciudad va en verde y el 10 % más caro en rojo.
  const cityPrices = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of byId.values()) {
      const p = s.prices[fuel];
      if (p === undefined || !s.municipality) continue;
      const arr = m.get(s.municipality);
      if (arr) arr.push(p);
      else m.set(s.municipality, [p]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a - b);
    return m;
  }, [byId, fuel]);

  return (
    <>
      {clusters.map((c) => {
        const [lng, lat] = c.geometry.coordinates;
        const props = c.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; stationId?: string };
        if (props.cluster) {
          return (
            <Marker
              key={`c-${props.cluster_id}`}
              position={[lat, lng]}
              icon={clusterIcon(props.point_count ?? 0)}
              eventHandlers={{
                click: () => {
                  const z = Math.min(index.getClusterExpansionZoom(props.cluster_id as number), 18);
                  map.setView([lat, lng], z, { animate: true });
                },
              }}
            />
          );
        }
        const station = props.stationId ? byId.get(props.stationId) : undefined;
        if (!station) return null;
        const price = station.prices[fuel];
        const tone = priceTone(price, cityPrices.get(station.municipality) ?? []);
        return (
          <Marker
            key={station.id}
            position={[lat, lng]}
            icon={dotIcon()}
            eventHandlers={{ click: () => onSelect(station) }}
          >
            {showPrices && price !== undefined && (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -12]}
                opacity={1}
                interactive
                className={tone ? `mk-price mk-${tone}` : 'mk-price'}
              >
                <span className="mk-label" onClick={() => onSelect(station)}>
                  <span className="mk-name">{station.name}</span>
                  <span className="mk-num">{formatPriceShort(price)}</span>
                </span>
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </>
  );
}

interface Props {
  stations: FuelStation[];
  fuel: FuelKey;
  fitKey: string;
  center: { latitude: number; longitude: number } | null;
  focus: { latitude: number; longitude: number; key: number } | null;
  clearFocus: () => void;
  onSelect: (station: FuelStation) => void;
}

/**
 * Vista de mapa (Leaflet + OpenStreetMap). Los puntos se agrupan con
 * supercluster para no crear miles de marcadores DOM a la vez; además se
 * limita el número de estaciones pintadas con aviso visible.
 */
export function StationMap({ stations, fuel, fitKey, center, focus, clearFocus, onSelect }: Props) {
  const withCoords = useMemo(() => stations.filter((s) => s.hasCoords), [stations]);
  const capped = withCoords.length > MAX_MARKERS;
  const shown = useMemo(() => (capped ? withCoords.slice(0, MAX_MARKERS) : withCoords), [withCoords, capped]);

  const { points, byId } = useMemo(() => {
    const mapById = new Map<string, FuelStation>();
    const pts: MapPoint[] = shown.map((s) => {
      mapById.set(s.id, s);
      return {
        type: 'Feature',
        properties: { stationId: s.id },
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
      };
    });
    return { points: pts, byId: mapById };
  }, [shown]);

  const initialCenter: [number, number] = center
    ? [center.latitude, center.longitude]
    : [40.3, -3.7];
  const initialZoom = center ? 10 : 6;

  // Cambia al filtrar/buscar y al pasar de vacío a con datos: entrar al mapa
  // o cambiar filtros reencuadra; los refrescos periódicos, no.
  const fitSignal = `${fitKey}|${points.length > 0}`;

  return (
    <div className="map-wrap">
      {capped && (
        <p className="map-notice" role="status">
          Mostrando {MAX_MARKERS.toLocaleString('es-ES')} de {withCoords.length.toLocaleString('es-ES')}{' '}
          estaciones en el mapa. Afina los filtros para ver el resto.
        </p>
      )}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom
        className="map"
        aria-label="Mapa de gasolineras"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds fitSignal={fitSignal} points={points} focusKey={focus?.key ?? null} />
        <ClusterLayer points={points} byId={byId} fuel={fuel} onSelect={onSelect} />
        {center && <UserMarker center={center} />}
        {center && <RecenterControl center={center} />}
        <FocusPoint focus={focus} clearFocus={clearFocus} />
      </MapContainer>
    </div>
  );
}
