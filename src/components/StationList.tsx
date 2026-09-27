import { useEffect, useMemo, useRef, useState } from 'react';
import type { FuelKey, FuelStation } from '../types/fuel';
import { StationCard } from './StationCard';

const PAGE_SIZE = 48;

interface Props {
  stations: FuelStation[];
  fuel: FuelKey;
  onSelect: (station: FuelStation) => void;
}

/**
 * Listado con carga progresiva: solo renderiza la página visible y añade
 * más al hacer scroll (IntersectionObserver) o con el botón "Mostrar más".
 * Nunca monta miles de tarjetas a la vez.
 */
export function StationList({ stations, fuel, onSelect }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [stations]);

  const shown = useMemo(() => stations.slice(0, visible), [stations, visible]);
  const hasMore = visible < stations.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible((v) => Math.min(v + PAGE_SIZE, stations.length));
        }
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, stations.length]);

  return (
    <>
      <div className="grid">
        {shown.map((s) => (
          <StationCard key={s.id} station={s} fuel={fuel} onSelect={onSelect} />
        ))}
      </div>
      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden="true" />
          <div className="load-more">
            <p className="load-more-text">
              Mostrando {shown.length.toLocaleString('es-ES')} de{' '}
              {stations.length.toLocaleString('es-ES')}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE * 2, stations.length))}
            >
              Mostrar más
            </button>
          </div>
        </>
      )}
    </>
  );
}
