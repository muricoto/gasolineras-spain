import { useEffect, useState } from 'react';
import { formatRelativeTime, formatUpdatedAt } from '../utils/format';

interface Props {
  updatedAt: string | null;
  count: number;
  stale: boolean;
  warning?: string;
  isFetching: boolean;
  onRefresh: () => void;
}

/** Barra de estado: frescura de los datos + actualización manual. */
export function StatusBar({ updatedAt, count, stale, warning, isFetching, onRefresh }: Props) {
  const [, tick] = useState(0);

  // Re-render cada 30 s para que "hace X min" siga siendo cierto.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="statusbar" role="status">
      <div className="statusbar-info">
        <span className={`pulse ${stale ? 'pulse-stale' : ''}`} aria-hidden="true" />
        <span>
          {updatedAt ? (
            <>
              <strong>Actualizado {formatRelativeTime(updatedAt)}</strong>
              <span className="statusbar-sub">
                {' '}
                {count.toLocaleString('es-ES')} estaciones. Fuente MITECO,{' '}
                {formatUpdatedAt(updatedAt)}
              </span>
            </>
          ) : (
            'Cargando datos…'
          )}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Actualizar precios ahora"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={isFetching ? 'spin' : undefined}
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isFetching ? 'Actualizando…' : 'Actualizar ahora'}
      </button>
      {stale && (
        <p className="stale-warning">
          {warning ?? 'Los datos mostrados corresponden a la última actualización disponible.'}
        </p>
      )}
    </div>
  );
}
