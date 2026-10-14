import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { FUELS } from '../data/fuels';
import type { FuelStation, UserLocation } from '../types/fuel';
import { directionsUrl, formatDistance } from '../utils/geo';
import { formatPrice, formatUpdatedAt } from '../utils/format';
import { isOpenNow } from '../utils/schedule';

interface Props {
  station: FuelStation | null;
  location: UserLocation | null;
  onClose: () => void;
  /** Si se omite (vista mapa), no se muestra "Ver en mapa". */
  onShowOnMap?: (station: FuelStation) => void;
}

/** Ficha completa de la estación: bottom-sheet arrastrable en móvil, diálogo en escritorio. */
export function StationDetail({ station, location, onClose, onShowOnMap }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [dragging, setDragging] = useState(false);

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

  // Arrastre vertical del tirador: estira hasta 92dvh; si se baja más de un
  // 18 % de la pantalla, se cierra. Solo el tirador arrastra (el resto hace scroll).
  const onDragStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    dragRef.current = {
      startY: e.touches[0].clientY,
      startH: sheetRef.current?.getBoundingClientRect().height ?? 0,
    };
    setDragging(true);
  };

  const onDragMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const vh = window.innerHeight;
    const h = Math.min(vh * 0.92, Math.max(180, d.startH + (e.touches[0].clientY - d.startY)));
    el.style.maxHeight = `${h}px`;
  };

  const onDragEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = sheetRef.current;
    setDragging(false);
    dragRef.current = null;
    if (!d || !el) return;
    const dy = (e.changedTouches[0]?.clientY ?? d.startY) - d.startY;
    if (dy > window.innerHeight * 0.18) {
      onClose();
      return;
    }
    el.style.maxHeight = '';
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className={`modal${dragging ? ' dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${station.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-handle"
          aria-hidden="true"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        />
        <div className="modal-scroll">
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
        </div>

        <div className="modal-actions">
          {station.hasCoords && onShowOnMap && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => onShowOnMap(station)}
            >
              Ver en mapa
            </button>
          )}
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
