import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import Supercluster from 'supercluster';
import { getFuelLabel } from '../data/fuels';
import type { FuelKey, FuelStation } from '../types/fuel';
import { formatPrice, formatPriceShort } from '../utils/format';

const MAX_MARKERS = 4000;

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

function clusterIcon(count: number): L.DivIcon {
  const size = count > 500 ? 52 : count > 100 ? 44 : 36;
  return L.divIcon({
    className: 'mk-wrap',
    html: `<span class="mk-cluster" style="width:${size}px;height:${size}px">${count > 999 ? `${Math.round(count / 100) / 10}k` : count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ fitKey, points }: { fitKey: string; points: MapPoint[] }) {
  const map = useMap();
  const firstKey = useMemo(() => fitKey, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (fitKey === firstKey) return; // no reencuadrar en el primer montaje
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.geometry.coordinates[1], p.geometry.coordinates[0]] as [number, number]));
    map.fitBounds(bounds.pad(0.1), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
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
    const sc = new Supercluster({ radius: 70, maxZoom: 15, minPoints: 2 });
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
        return (
          <Marker key={station.id} position={[lat, lng]} icon={dotIcon()}>
            {price !== undefined && (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -12]}
                opacity={1}
                interactive={false}
                className="mk-price"
              >
                {formatPriceShort(price)}
              </Tooltip>
            )}
            <Popup>
              <div className="popup">
                <strong className="popup-name">{station.name}</strong>
                <p className="popup-place">
                  {station.municipality}
                  {station.province ? `, ${station.province}` : ''}
                </p>
                <p className="popup-price">
                  {getFuelLabel(fuel)} · <strong>{formatPrice(station.prices[fuel])}</strong>
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onSelect(station)}>
                  Ver estación
                </button>
              </div>
            </Popup>
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
  onSelect: (station: FuelStation) => void;
}

/**
 * Vista de mapa (Leaflet + OpenStreetMap). Los puntos se agrupan con
 * supercluster para no crear miles de marcadores DOM a la vez; además se
 * limita el número de estaciones pintadas con aviso visible.
 */
export function StationMap({ stations, fuel, fitKey, center, onSelect }: Props) {
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
        <FitBounds fitKey={fitKey} points={points} />
        <ClusterLayer points={points} byId={byId} fuel={fuel} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}
