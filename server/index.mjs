/**
 * Fuel España — capa backend/proxy.
 *
 * Por qué existe este servidor:
 * el endpoint oficial del MITECO
 * (https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/...)
 * NO envía cabeceras CORS (`Access-Control-Allow-Origin`), por lo que los
 * navegadores bloquean su consumo directo desde el frontend. Este proxy hace
 * la petición en servidor, cachea la respuesta (el feed pesa ~12 MB y cubre
 * toda España) y la sirve al frontend en el mismo origen con gzip + caché.
 *
 * Endpoints:
 *   GET /api/stations  → { fecha, count, updatedAt, stale, stations: [...] }
 *   GET /api/health    → { ok, cache, ... }
 *
 * Env:
 *   MITECO_API_URL (base), PORT, CACHE_TTL_MS
 */
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MITECO_BASE =
  process.env.MITECO_API_URL ??
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const PORT = Number(process.env.PORT ?? 3001);
const TTL_MS = Number(process.env.CACHE_TTL_MS ?? 15 * 60 * 1000);

const app = express();
app.use(cors());
app.use(compression());
app.disable('x-powered-by');

/** Caché en memoria del feed completo. */
const cache = {
  /** Payload crudo del MITECO (objeto parseado). */
  data: null,
  /** Cuándo se descargó (ms epoch). */
  fetchedAt: 0,
  /** Fecha oficial del feed (campo `Fecha`, ej. "27/09/2026 14:06:30"). */
  fecha: null,
  /** Promesa de revalidación en curso (evita tormentas de peticiones). */
  inflight: null,
};

async function fetchMiteco() {
  const url = `${MITECO_BASE}/EstacionesTerrestres/`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FuelEspana/1.0 (+proxy; datos MITECO)',
    },
  });
  if (!res.ok) {
    throw new Error(`MITECO respondió ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!json || !Array.isArray(json.ListaEESSPrecio)) {
    throw new Error('Respuesta inesperada del MITECO (sin ListaEESSPrecio)');
  }
  return json;
}

function refreshCache() {
  if (!cache.inflight) {
    cache.inflight = fetchMiteco()
      .then((json) => {
        cache.data = json;
        cache.fecha = json.Fecha ?? null;
        cache.fetchedAt = Date.now();
        return json;
      })
      .finally(() => {
        cache.inflight = null;
      });
  }
  return cache.inflight;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'fuel-espana-proxy',
    mitecoBase: MITECO_BASE,
    cache: {
      hasData: cache.data !== null,
      fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
      feedFecha: cache.fecha,
      ttlMs: TTL_MS,
    },
  });
});

app.get('/api/stations', async (_req, res) => {
  const age = Date.now() - cache.fetchedAt;
  const fresh = cache.data !== null && age < TTL_MS;

  // 1) Caché fresca → servir directamente.
  if (fresh) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({
      fecha: cache.fecha,
      count: cache.data.ListaEESSPrecio.length,
      updatedAt: new Date(cache.fetchedAt).toISOString(),
      stale: false,
      stations: cache.data.ListaEESSPrecio,
    });
  }

  // 2) Caché caducada pero existente → servir stale y revalidar en fondo.
  if (cache.data !== null) {
    res.setHeader('X-Cache', 'STALE');
    res.setHeader('Cache-Control', 'public, max-age=60');
    refreshCache().catch((err) => console.error('[proxy] revalidación fallida:', err.message));
    return res.json({
      fecha: cache.fecha,
      count: cache.data.ListaEESSPrecio.length,
      updatedAt: new Date(cache.fetchedAt).toISOString(),
      stale: true,
      warning:
        'No hemos podido actualizar los precios. Los datos mostrados corresponden a la última actualización disponible.',
      stations: cache.data.ListaEESSPrecio,
    });
  }

  // 3) Sin caché → esperar a la descarga.
  try {
    const json = await refreshCache();
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({
      fecha: json.Fecha ?? null,
      count: json.ListaEESSPrecio.length,
      updatedAt: new Date(cache.fetchedAt).toISOString(),
      stale: false,
      stations: json.ListaEESSPrecio,
    });
  } catch (err) {
    console.error('[proxy] MITECO no disponible:', err.message);
    return res.status(502).json({
      error: 'UPSTREAM_UNAVAILABLE',
      message:
        'No hemos podido actualizar los precios (MITECO no responde). Inténtalo de nuevo en unos minutos.',
    });
  }
});

// En producción sirve el frontend compilado (dist/) con fallback SPA.
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[proxy] escuchando en http://localhost:${PORT}`);
  console.log(`[proxy] MITECO base: ${MITECO_BASE}`);
  // Precalienta la caché al arrancar para que la primera visita sea rápida.
  refreshCache()
    .then((json) => console.log(`[proxy] caché inicial: ${json.ListaEESSPrecio.length} estaciones`))
    .catch((err) => console.error('[proxy] precarga fallida (se reintentará bajo demanda):', err.message));
});
