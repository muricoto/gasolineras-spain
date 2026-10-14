import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { UserLocation } from '../types/fuel';

type Status = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported';

const GEO_HIGH: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 10000,
};

/** Segundo intento: sin alta precisión (en PC sin GPS el primero suele expirar). */
const GEO_LOW: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 60000,
};

/**
 * Geolocalización bajo demanda: solo se solicita tras una acción explícita
 * del usuario ("Ubicación"). La posición nunca se envía al servidor;
 * los cálculos de distancia son locales (ver utils/geo).
 *
 * Estrategia (igual que la app de monumentos, que sí funciona):
 * vía web primero —`navigator.geolocation` también resuelve dentro del
 * WebView de Capacitor— y plugin nativo como respaldo.
 * Nota: el `config.xml` con `GeoBroker` de ese proyecto es Cordova legacy;
 * Capacitor lo ignora, no hace falta aquí.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    const insecure =
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      !Capacitor.isNativePlatform();
    if (insecure) {
      setStatus('denied');
      setError(
        'La ubicación necesita HTTPS: en local solo funciona en localhost (PC); en el móvil abre la versión desplegada (Vercel o Northflank).',
      );
      return;
    }
    setStatus('locating');
    setError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setStatus('granted');
        },
        (err) => {
          // Expiró (típico en PC sin GPS con alta precisión): reintentar
          // sin alta precisión antes de rendirse.
          if (err.code === err.TIMEOUT) {
            console.log('[geo] alta precisión expiró, reintento sin ella');
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setStatus('granted');
              },
              (err2) => {
                console.log('[geo] web falló, respaldo nativo:', err2.code, err2.message);
                void requestNativeFallback(setLocation, setStatus, setError);
              },
              GEO_LOW,
            );
            return;
          }
          // Permiso bloqueado: decirlo claro (el respaldo nativo no sirve en web).
          if (err.code === err.PERMISSION_DENIED) {
            console.log('[geo] permiso denegado por el usuario/navegador');
            setStatus('denied');
            setError(
              'Permiso de ubicación denegado: actívalo en el icono de la barra del navegador y vuelve a pulsar «Ubicación».',
            );
            return;
          }
          console.log('[geo] web falló, respaldo nativo:', err.code, err.message);
          void requestNativeFallback(setLocation, setStatus, setError);
        },
        GEO_HIGH,
      );
    } else {
      void requestNativeFallback(setLocation, setStatus, setError);
    }
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { location, status, error, request, clear };
}

/** Plan B: plugin nativo de Capacitor (solo existe dentro de la APK). */
async function requestNativeFallback(
  setLocation: (l: UserLocation | null) => void,
  setStatus: (s: Status) => void,
  setError: (e: string | null) => void,
) {
  if (!Capacitor.isNativePlatform()) {
    setStatus('denied');
    setError('No se pudo obtener tu ubicación.');
    return;
  }
  try {
    const checked = await Geolocation.checkPermissions();
    let state = permissionState(checked);
    if (state !== 'granted') {
      state = permissionState(await Geolocation.requestPermissions());
    }
    if (state !== 'granted') throw new Error(`permiso ${state ?? 'desconocido'}`);
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 10000,
    });
    setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    setStatus('granted');
  } catch (err) {
    console.log('[geo] nativo falló:', err instanceof Error ? err.message : err);
    setStatus('denied');
    setError(
      'No se pudo obtener tu ubicación. Revisa el GPS y el permiso en Ajustes → Aplicaciones → Mi Gasolinera → Permisos.',
    );
  }
}

/** Extrae 'granted' | 'denied' | ... del PermissionStatus (objeto o array). */
function permissionState(perm: unknown): string | undefined {
  if (Array.isArray(perm)) return permissionState(perm[0]);
  if (perm && typeof perm === 'object' && 'location' in perm) {
    const v = (perm as { location?: unknown }).location;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}
