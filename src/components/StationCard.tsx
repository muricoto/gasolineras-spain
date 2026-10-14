import { memo } from 'react';
import type { FuelKey, FuelStation } from '../types/fuel';
import { getFuelLabel } from '../data/fuels';
import { formatDistance } from '../utils/geo';
import { formatPrice, formatRelativeTime, type PriceTone } from '../utils/format';
import { isOpenNow } from '../utils/schedule';

interface Props {
  station: FuelStation;
  fuel: FuelKey;
  onSelect: (station: FuelStation) => void;
  rank?: number;
  /** Semáforo del precio principal (verde/naranja/rojo dentro de su ciudad). */
  tone?: PriceTone;
}

/** Otros precios a mostrar junto al principal (los más relevantes primero). */
const SECONDARY_ORDER: FuelKey[] = ['gasoline95', 'diesel', 'gasoline98', 'dieselPremium'];

function OpenBadge({ schedule }: { schedule: string }) {
  const open = isOpenNow(schedule);
  if (open === null) return null;
  return (
    <span className={`badge ${open ? 'badge-open' : 'badge-closed'}`} title={schedule || undefined}>
      <span className="dot" aria-hidden="true" />
      {open ? 'Abierta' : 'Cerrada'}
    </span>
  );
}

/** Tarjeta de gasolinera (memoizada: el listado renderiza cientos). */
export const StationCard = memo(function StationCard({ station, fuel, onSelect, rank, tone }: Props) {
  const mainPrice = station.prices[fuel];
  const secondary = SECONDARY_ORDER.filter((k) => k !== fuel && station.prices[k] !== undefined).slice(0, 2);

  return (
    <article className="card" aria-label={`${station.name}, ${station.municipality}`}>
      <div className="card-top">
        <div className="card-brand">
          {rank !== undefined && <span className="rank" aria-hidden="true">{rank}</span>}
          <h3 className="card-name">{station.name}</h3>
        </div>
        <OpenBadge schedule={station.schedule} />
      </div>

      <p className="card-address">
        {station.address || 'Dirección no disponible'}
        <br />
        <span className="card-place">
          {station.municipality}
          {station.province ? `, ${station.province}` : ''}
        </span>
      </p>

      <div className="card-prices">
        <div className="price-main">
          <span className="price-fuel">{getFuelLabel(fuel)}</span>
          <span className={`price-value${tone ? ` price-${tone}` : ''}`}>{formatPrice(mainPrice)}</span>
        </div>
        {secondary.map((k) => (
          <div className="price-row" key={k}>
            <span>{getFuelLabel(k)}</span>
            <span className="price-row-value">{formatPrice(station.prices[k])}</span>
          </div>
        ))}
      </div>

      <div className="card-meta">
        <span className="meta-updated" title={`Última actualización: ${station.lastUpdated}`}>
          Actualizado {formatRelativeTime(station.lastUpdated)}
        </span>
        {station.distanceKm !== undefined && (
          <span className="meta-distance">· {formatDistance(station.distanceKm)}</span>
        )}
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onSelect(station)}
          aria-label={`Ver detalle de ${station.name}`}
        >
          Ver estación
        </button>
      </div>
    </article>
  );
});
