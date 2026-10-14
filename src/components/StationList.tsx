import { useEffect, useMemo, useState } from 'react';
import type { FuelKey, FuelStation } from '../types/fuel';
import { priceTone } from '../utils/format';
import { StationCard } from './StationCard';

const PAGE_SIZE = 15;

interface Props {
  stations: FuelStation[];
  fuel: FuelKey;
  onSelect: (station: FuelStation) => void;
}

function scrollToList() {
  try {
    document.getElementById('listado')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    /* noop */
  }
}

/**
 * Listado paginado (15 por página): nunca monta cientos de tarjetas a la vez
 * y la página siempre cabe de una ojeada. La página vuelve al inicio cuando
 * cambia el resultado.
 */
export function StationList({ stations, fuel, onSelect }: Props) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [stations]);

  const pageCount = Math.max(1, Math.ceil(stations.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = useMemo(
    () => stations.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [stations, safePage],
  );

  // Rango del combustible activo por municipio (mismo semáforo que el mapa).
  const cityPrices = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of stations) {
      const p = s.prices[fuel];
      if (p === undefined || !s.municipality) continue;
      const arr = m.get(s.municipality);
      if (arr) arr.push(p);
      else m.set(s.municipality, [p]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a - b);
    return m;
  }, [stations, fuel]);

  const goTo = (p: number) => {
    setPage(Math.max(0, Math.min(p, pageCount - 1)));
    scrollToList();
  };

  return (
    <>
      <div className="grid">
        {shown.map((s) => {
          const tone = priceTone(s.prices[fuel], cityPrices.get(s.municipality) ?? []);
          return <StationCard key={s.id} station={s} fuel={fuel} onSelect={onSelect} tone={tone} />;
        })}
      </div>
      {pageCount > 1 && (
        <nav className="pager" aria-label="Páginas de resultados">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => goTo(safePage - 1)}
            disabled={safePage === 0}
          >
            ← Anterior
          </button>
          <p className="pager-info" role="status">
            Página <strong>{safePage + 1}</strong> de {pageCount.toLocaleString('es-ES')}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => goTo(safePage + 1)}
            disabled={safePage >= pageCount - 1}
          >
            Siguiente →
          </button>
        </nav>
      )}
    </>
  );
}
