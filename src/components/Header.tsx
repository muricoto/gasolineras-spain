interface Props {
  query: string;
  onQuery: (q: string) => void;
  locationStatus: string;
  hasLocation: boolean;
  onUseLocation: () => void;
  onClearLocation: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function PumpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 21h11M15 9h2a2 2 0 0 1 2 2v7a1.5 1.5 0 0 0 3 0V9.8a2 2 0 0 0-.6-1.4L19 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h6v4H7z" strokeLinejoin="round" />
    </svg>
  );
}

/** Cabecera: marca, buscador en tiempo real, ubicación y tema. */
export function Header({
  query,
  onQuery,
  locationStatus,
  hasLocation,
  onUseLocation,
  onClearLocation,
  theme,
  onToggleTheme,
}: Props) {
  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="Fuel España, inicio">
          <span className="brand-icon" aria-hidden="true">
            <PumpIcon />
          </span>
          <span className="brand-text">
            Fuel <strong>España</strong>
          </span>
        </a>

        <div className="search-wrap">
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
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => onQuery('')}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
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
