import { useEffect, useRef } from 'react';
import { FUELS } from '../data/fuels';
import type { FuelStation, UserLocation } from '../types/fuel';
import { directionsUrl, formatDistance } from '../utils/geo';
import { formatPrice, formatUpdatedAt } from '../utils/format';
import { isOpenNow } from '../utils/schedule';

interface Props {
  station: FuelStation | null;
  location: UserLocation | null;
  onClose: () => void;
}

/** Ficha completa de la estación en un diálogo modal accesible. */
export function StationDetail({ station, location, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!station) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [station, onClose]);

  if (!station) return null;

  const open = isOpenNow(station.schedule);
  const availableFuels = FUELS.filter((f) => station.prices[f.key] !== undefined);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${station.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{station.name}</h2>
            <p className="modal-sub">
              {station.address || 'Dirección no disponible'}
              <br />
              {station.postalCode && `${station.postalCode} `}
              {station.municipality}
              {station.province ? `, ${station.province}` : ''}
              {` · ${station.autonomousCommunity}`}
            </p>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar detalle">
            ✕
          </button>
        </div>

        <div className="modal-badges">
          {open !== null && (
            <span className={`badge ${open ? 'badge-open' : 'badge-closed'}`}>
              <span className="dot" aria-hidden="true" />
              {open ? 'Abierta ahora' : 'Cerrada ahora'}
            </span>
          )}
          {station.distanceKm !== undefined && (
            <span className="badge badge-neutral">A {formatDistance(station.distanceKm)}</span>
          )}
          <span className="badge badge-neutral" title={`Última actualización: ${station.lastUpdated}`}>
            Actualizado {formatUpdatedAt(station.lastUpdated)}
          </span>
        </div>

        <h3 className="modal-section">Precios (€/l)</h3>
        {availableFuels.length > 0 ? (
          <dl className="price-table">
            {availableFuels.map((f) => (
              <div className="price-table-row" key={f.key}>
                <dt>{f.label}</dt>
                <dd>{formatPrice(station.prices[f.key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">Esta estación no publica precios en este momento.</p>
        )}

        <h3 className="modal-section">Información</h3>
        <dl className="info-table">
          <div className="info-row">
            <dt>Horario</dt>
            <dd>{station.schedule || 'No disponible'}</dd>
          </div>
          <div className="info-row">
            <dt>Coordenadas</dt>
            <dd>
              {station.hasCoords
                ? `${station.latitude.toFixed(5)}, ${station.longitude.toFixed(5)}`
                : 'No disponibles'}
            </dd>
          </div>
          <div className="info-row">
            <dt>Tipo de venta</dt>
            <dd>{station.saleType === 'P' ? 'Público general' : station.saleType || 'No disponible'}</dd>
          </div>
          {location && station.hasCoords && (
            <div className="info-row">
              <dt>Distancia</dt>
              <dd>
                {station.distanceKm !== undefined
                  ? `${formatDistance(station.distanceKm)} en línea recta`
                  : 'Calcula tu ubicación para verla'}
              </dd>
            </div>
          )}
        </dl>

        <div className="modal-actions">
          {station.hasCoords ? (
            <a
              className="btn btn-primary btn-block"
              href={directionsUrl(station.latitude, station.longitude)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cómo llegar
            </a>
          ) : (
            <button type="button" className="btn btn-primary btn-block" disabled>
              Sin coordenadas para navegar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
