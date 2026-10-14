import { useMemo } from 'react';
import { FUELS, getFuelLabel } from '../data/fuels';
import type { FuelKey, FuelStation } from '../types/fuel';
import { formatPrice } from '../utils/format';

interface Props {
  stations: FuelStation[];
  fuel: FuelKey;
  onFuel: (fuel: FuelKey) => void;
}

/**
 * Tótem de precio medio nacional: el dato más característico del producto
 * (tablero de gasolinera) calculado en vivo con el feed del MITECO.
 */
export function MarketStrip({ stations, fuel, onFuel }: Props) {
  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const s of stations) {
      const p = s.prices[fuel];
      if (p === undefined) continue;
      sum += p;
      count++;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    if (count === 0) return null;
    return { avg: sum / count, min, max, count };
  }, [stations, fuel]);

  if (!stats) return null;

  const span = stats.max - stats.min;
  const pos = span > 0 ? ((stats.avg - stats.min) / span) * 100 : 50;

  return (
    <section className="totem" aria-label={`Precio medio nacional de ${getFuelLabel(fuel)}`}>
      <div className="totem-main">
        <p className="totem-kicker">
          Precio medio nacional ·{' '}
          <label className="totem-fuel">
            <span className="sr-only">Carburante de la media nacional</span>
            <select
              className="totem-select"
              value={fuel}
              onChange={(e) => onFuel(e.target.value as FuelKey)}
              aria-label="Carburante de la media nacional"
            >
              {FUELS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p className="totem-price">{formatPrice(stats.avg)}</p>
        <p className="totem-sub">
          Entre {formatPrice(stats.min)} y {formatPrice(stats.max)} en{' '}
          {stats.count.toLocaleString('es-ES')} estaciones
        </p>
      </div>
      <div className="totem-range" aria-hidden="true">
        <div className="totem-track">
          <span className="totem-marker" style={{ left: `${pos.toFixed(1)}%` }} />
        </div>
        <div className="totem-ends">
          <span>{formatPrice(stats.min)}</span>
          <span>{formatPrice(stats.max)}</span>
        </div>
      </div>
    </section>
  );
}
