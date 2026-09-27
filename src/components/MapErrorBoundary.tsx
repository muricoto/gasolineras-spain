import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Si el mapa (Leaflet, clustering) falla en un dispositivo concreto,
 * muestra un estado recuperable en vez de romper la página.
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="state" role="alert">
          <h2 className="state-title">El mapa no se pudo cargar</h2>
          <p className="state-text">
            El listado sigue disponible. Comprueba tu conexión e inténtalo de nuevo.
          </p>
          <button type="button" className="btn btn-secondary" onClick={this.retry}>
            Reintentar mapa
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
