import { useCallback, useState } from 'react';
import type { UserLocation } from '../types/fuel';

type Status = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported';

/**
 * Geolocalización bajo demanda: solo se solicita tras una acción explícita
 * del usuario ("Usar mi ubicación"). La posición nunca se envía al servidor;
 * los cálculos de distancia son locales (ver utils/geo).
 */
export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setError('Tu navegador no soporta geolocalización.');
      return;
    }
    setStatus('locating');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus('granted');
      },
      (err) => {
        setStatus('denied');
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado.'
            : 'No se pudo obtener tu ubicación.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { location, status, error, request, clear };
}
