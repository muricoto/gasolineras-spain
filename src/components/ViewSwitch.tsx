interface Props {
  view: 'list' | 'map';
  onView: (v: 'list' | 'map') => void;
}

/** Interruptor Lista/Mapa: bloque propio entre filtros y resultados. */
export function ViewSwitch({ view, onView }: Props) {
  return (
    <div id="vista" className="view-switch" role="group" aria-label="Vista de resultados">
      <button
        type="button"
        className={view === 'list' ? 'active' : ''}
        onClick={() => onView('list')}
        aria-pressed={view === 'list'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
        Lista
      </button>
      <button
        type="button"
        className={view === 'map' ? 'active' : ''}
        onClick={() => onView('map')}
        aria-pressed={view === 'map'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" strokeLinejoin="round" />
        </svg>
        Mapa
      </button>
    </div>
  );
}
