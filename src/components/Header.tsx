import { useEffect, useMemo, useRef, useState } from 'react';
import type { Place } from '../hooks/useStationFilters';
import { normalizeSearchText } from '../utils/format';

interface Props {
  query: string;
  /** Pulsar la X: reset completo (query + filtros, conserva el combustible). Escribir no filtra, solo sugiere. */
  onClearText: () => void;
  places: Place[];
  onPickPlace: (p: Place) => void;
  locationStatus: string;
  hasLocation: boolean;
  onUseLocation: () => void;
  onClearLocation: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

/** Cabecera: marca, buscador (texto libre + sugerencias de localidades), ubicación y tema. */
export function Header({
  query,
  onClearText,
  places,
  onPickPlace,
  locationStatus,
  hasLocation,
  onUseLocation,
  onClearLocation,
  theme,
  onToggleTheme,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Borrador de la caja: escribir solo filtra las SUGERENCIAS, nunca los
  // resultados. Se sincroniza cuando la búsqueda aplicada cambia fuera
  // (elegir ciudad, limpiar, favoritas, atrás/adelante, URL compartida).
  const [text, setText] = useState(query);
  useEffect(() => {
    setText(query);
  }, [query]);

  const matches = useMemo(() => {
    const q = normalizeSearchText(text.trim());
    if (!q) return [];
    const out: Place[] = [];
    for (const p of places) {
      if (normalizeSearchText(p.name).includes(q)) {
        out.push(p);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [places, text]);

  // Al cambiar el texto o los datos, la selección vuelve a la primera.
  useEffect(() => {
    setActive(0);
  }, [text, places]);

  // Mantiene visible la opción activa al navegar con el teclado.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Cierra las sugerencias al pulsar fuera (pointerdown llega antes que el click).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open ]);

  const pick = (p: Place) => {
    setOpen(false);
    onPickPlace(p);
  };

  const showSuggest = open && text.trim() !== '' && matches.length > 0;

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="Litro Gasolina, inicio">
          <img className="brand-icon" src="./icon.png" alt="" width={38} height={38} />
          <h1 className="brand-text">
            Litro Gasolina <strong className="brand-sub">- Gasolineras baratas</strong>
          </h1>
        </a>

        <div className="search-wrap" ref={wrapRef}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="search-icon">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <label htmlFor="search" className="sr-only">
            Buscar gasolinera, ciudad o provincia
          </label>
          <input
            id="search"
            type="search"
            className="search"
            placeholder="Buscar gasolinera, ciudad o provincia…"
            value={text}
            onChange={(e) => { setText(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && matches.length > 0) {
                e.preventDefault();
                setOpen(true);
                setActive((a) => (a + 1) % matches.length);
              } else if (e.key === 'ArrowUp' && matches.length > 0) {
                e.preventDefault();
                setOpen(true);
                setActive((a) => (a - 1 + matches.length) % matches.length);
              } else if (e.key === 'Enter' && matches.length > 0) pick(matches[active] ?? matches[0]);
              else if (e.key === 'Escape') setOpen(false);
            }}
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggest}
            aria-controls="search-places"
            aria-autocomplete="list"
          />
          {text && (
            <button
              type="button"
              className="search-clear"
              onClick={() => { setText(''); onClearText(); }}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
          {showSuggest && (
            <ul id="search-places" role="listbox" className="combo-list" aria-label="Localidades coincidentes">
              {matches.map((p, i) => (
                <li key={`${p.name}|${p.provinceId}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    aria-label={`${p.name}, ${p.province}`}
                    className={i === active ? 'active' : undefined}
                    ref={i === active ? activeRef : undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(p)}
                  >
                    <strong>{p.name}</strong>
                    <span>{p.province}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="header-actions">
          {hasLocation ? (
            <button
              type="button"
              className="btn btn-location active"
              onClick={onClearLocation}
              aria-label="Desactivar mi ubicación"
              title="Ubicación activada — pulsa para desactivar"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="btn-label">Cerca de mí</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-location"
              onClick={onUseLocation}
              disabled={locationStatus === 'locating'}
              aria-label="Usar mi ubicación"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="btn-label">
                {locationStatus === 'locating' ? 'Localizando…' : 'Ubicación'}
              </span>
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
