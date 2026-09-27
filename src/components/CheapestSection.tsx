import { useMemo } from 'react';
import { getFuelLabel } from '../data/fuels';
import type { FuelKey, FuelStation, UserLocation } from '../types/fuel';
import { StationCard } from './StationCard';

interface Props {
  stations: FuelStation[];
  fuel: FuelKey;
  location: UserLocation | null;
  onSelect: (station: FuelStation) => void;
}

/**
 * "Las más baratas": top 5 ordenadas SOLO por el combustible seleccionado.
 * Nunca mezcla precios de carburantes distintos.
 */
export function CheapestSection({ stations, fuel, location, onSelect }: Props) {
  const cheapest = useMemo(() => stations.slice(0, 5), [stations]);

  if (cheapest.length === 0) return null;

  return (
    <section className="cheapest" aria-label="Las más baratas">
      <div className="cheapest-head">
        <h2 className="cheapest-title">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M4 21h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Las más baratas{location ? ' cerca de ti' : ` en ${getFuelLabel(fuel)}`}
        </h2>
        <p className="cheapest-sub">Ordenadas por precio de {getFuelLabel(fuel).toLowerCase()}</p>
      </div>
      <div className="cheapest-row">
        {cheapest.map((s, i) => (
          <StationCard key={s.id} station={s} fuel={fuel} onSelect={onSelect} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
