import { FUELS, MAIN_FUELS, getFuelLabel } from '../data/fuels';
import type { Facets, } from '../hooks/useStationFilters';
import type { FuelKey, SortKey, StationFilters, UserLocation } from '../types/fuel';

interface Props {
  filters: StationFilters;
  patch: (p: Partial<StationFilters>) => void;
  facets: Facets;
  location: UserLocation | null;
  view: 'list' | 'map';
  onView: (v: 'list' | 'map') => void;
  resultCount: number;
}

const RADIUS_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Todas' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
];

const MAX_PRICE_CAP = 3.0;

/** Panel de filtros: combustible, territorio, precio, distancia y orden. */
export function FilterPanel({ filters, patch, facets, location, view, onView, resultCount }: Props) {
  const provinces = facets.provinces.filter(
    (p) => !filters.ccaaId || p.ccaaId === filters.ccaaId,
  );

  return (
    <section className="filters" aria-label="Filtros de búsqueda">
      <div className="fuel-chips" role="group" aria-label="Tipo de combustible">
        {MAIN_FUELS.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip ${filters.fuel === key ? 'chip-active' : ''}`}
            onClick={() => patch({ fuel: key })}
            aria-pressed={filters.fuel === key}
          >
            {getFuelLabel(key)}
          </button>
        ))}
        <label className="chip-select-wrap">
          <span className="sr-only">Otros combustibles</span>
          <select
            className="chip chip-select"
            value={MAIN_FUELS.includes(filters.fuel) ? '' : filters.fuel}
            onChange={(e) => {
              if (e.target.value) patch({ fuel: e.target.value as FuelKey });
            }}
            aria-label="Otros combustibles"
          >
            <option value="">Otros…</option>
            {FUELS.filter((f) => !MAIN_FUELS.includes(f.key)).map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {!MAIN_FUELS.includes(filters.fuel) && (
          <span className="chip chip-active chip-static">{getFuelLabel(filters.fuel)}</span>
        )}
      </div>

      <div className="filter-grid">
        <div className="field">
          <label htmlFor="f-ccaa">Comunidad autónoma</label>
          <select
            id="f-ccaa"
            value={filters.ccaaId}
            onChange={(e) => patch({ ccaaId: e.target.value })}
          >
            <option value="">Todas</option>
            {facets.ccaas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-prov">Provincia</label>
          <select
            id="f-prov"
            value={filters.provinceId}
            onChange={(e) => patch({ provinceId: e.target.value })}
          >
            <option value="">Todas</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-mun">Municipio</label>
          <select
            id="f-mun"
            value={filters.municipality}
            onChange={(e) => patch({ municipality: e.target.value })}
            disabled={facets.municipalities.length === 0}
          >
            <option value="">Todos</option>
            {facets.municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-sort">Ordenar</label>
          <select
            id="f-sort"
            value={filters.sort}
            onChange={(e) => patch({ sort: e.target.value as SortKey })}
          >
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="distance" disabled={!location}>
              Distancia{location ? '' : ' (activa tu ubicación)'}
            </option>
            <option value="name">Nombre (A–Z)</option>
          </select>
        </div>

        <div className="field field-price">
          <label htmlFor="f-maxprice">
            Precio máximo{' '}
            <output htmlFor="f-maxprice">
              {filters.maxPrice !== null
                ? `${filters.maxPrice.toFixed(2).replace('.', ',')} €/l`
                : 'sin límite'}
            </output>
          </label>
          <input
            id="f-maxprice"
            type="range"
            min={0.5}
            max={MAX_PRICE_CAP}
            step={0.01}
            value={filters.maxPrice ?? MAX_PRICE_CAP}
            onChange={(e) => {
              const v = Number(e.target.value);
              patch({ maxPrice: v >= MAX_PRICE_CAP ? null : Math.round(v * 100) / 100 });
            }}
          />
        </div>

        {location && (
          <fieldset className="field field-radius">
            <legend>Distancia</legend>
            <div className="radio-row" role="group" aria-label="Radio de distancia">
              {RADIUS_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  className={`chip chip-sm ${filters.radiusKm === o.value ? 'chip-active' : ''}`}
                  onClick={() => patch({ radiusKm: o.value })}
                  aria-pressed={filters.radiusKm === o.value}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="filters-foot">
        <div className="view-toggle" role="group" aria-label="Vista de resultados">
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => onView('list')}
            aria-pressed={view === 'list'}
          >
            Lista
          </button>
          <button
            type="button"
            className={view === 'map' ? 'active' : ''}
            onClick={() => onView('map')}
            aria-pressed={view === 'map'}
          >
            Mapa
          </button>
        </div>
        <p className="result-count" role="status">
          <strong>{resultCount.toLocaleString('es-ES')}</strong>{' '}
          {resultCount === 1 ? 'gasolinera' : 'gasolineras'}
        </p>
      </div>
    </section>
  );
}
