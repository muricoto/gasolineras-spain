/** Skeletons, empty states y error states con el mismo layout que el contenido. */

export function StationCardSkeleton() {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
      <div className="sk sk-price" />
      <div className="sk sk-price" />
      <div className="sk sk-btn" />
    </div>
  );
}

export function StationListSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid" role="status" aria-label="Cargando gasolineras">
      {Array.from({ length: count }, (_, i) => (
        <StationCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="state" role="status">
      <div className="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="state-title">Sin resultados</h2>
      <p className="state-text">
        Ninguna gasolinera coincide con esos filtros. Prueba a ampliar el radio,
        subir el precio máximo o buscar otra zona.
      </p>
      <button type="button" className="btn btn-secondary" onClick={onReset}>
        Limpiar filtros
      </button>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {

  console.log('ERROR', message);
  return (
    <div className="state" role="alert">
      <div className="state-icon state-icon-error" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="state-title">No hemos podido actualizar los precios</h2>
      <p className="state-text">{message}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  );
}
