/**
 * Litro Gasolina — capa backend/proxy.
 *
 * Por qué existe este servidor:
 * el endpoint oficial del MITECO
 * (https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/...)
 * NO envía cabeceras CORS (`Access-Control-Allow-Origin`), por lo que los
 * navegadores bloquean su consumo directo desde el frontend. Este proxy hace
 * la petición en servidor y sirve la respuesta al frontend en el mismo origen.
 *
 * Modelo de caché (optimizado para Northflank Free: 256 MB RAM, 0.1 vCPU):
 * al refrescar (una vez cada TTL), se descarga el feed (~12 MB) y se guarda
 * PRE-SERIALIZADO:
 *   - `arrayBuf`: Buffer con el array de estaciones ya en formato JSON final.
 *   - `headFresh` / `headStale`: Buffer con la cabecera del envelope
 *     (fecha, count, updatedAt, stale[, warning]).
 *   - `gzFresh` / `gzStale`: Buffers gzip precalculados (~0,75 MB).
 * Así cada petición NO serializa 12 MB con JSON.stringify, NO los vuelve a
 * comprimir y NO mantiene el grafo de objetos parseados en memoria: se envían
 * los bytes cacheados (una sola escritura por fragmento). La respuesta HTTP es
 * byte a byte la misma que generaba `res.json()` con el mismo feed.
 *
 * Endpoints:
 *   GET /api/stations  → { fecha, count, updatedAt, stale, stations: [...] }
 *   GET /api/health    → { ok, cache, memory, ... }
 *
 * Env:
 *   MITECO_API_URL (base), PORT, CACHE_TTL_MS,
 *   MITECO_TIMEOUT_MS (timeout de la descarga, 30 s), REVALIDATE_CHECK_MS.
 */
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
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
/** Timeout total de la descarga del feed (conexión + lectura). */
const FETCH_TIMEOUT_MS = Number(process.env.MITECO_TIMEOUT_MS ?? 30 * 1000);
/** Cadencia de comprobación de revalidación programada. */
const REVALIDATE_CHECK_MS = Number(process.env.REVALIDATE_CHECK_MS ?? 60 * 1000);

/**
 * Texto exacto del `warning` en la respuesta caducada (contrato del frontend:
 * mismo texto que el backend original enviaba en la rama STALE).
 */
const STALE_WARNING =
  'No hemos podido actualizar los precios. Los datos mostrados corresponden a la última actualización disponible.';

const app = express();
app.use(cors());
// Compresión solo para el estático y /api/health. /api/stations se sirve con
// gzip precalculado en cada refresco (evita comprimir 12 MB por petición).
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === '/api/stations') return false;
      const ct = res.getHeader('Content-Type');
      if (!ct) return false;
      return /^(?:text\/(?!event-stream)|application\/(?:json|javascript|xml|manifest\+json|rss\+xml|atom\+xml|problem\+json)|image\/svg\+xml)/.test(
        ct,
      );
    },
  }),
);
app.disable('x-powered-by');

/**
 * Caché en memoria del feed completo, en FORMA DE BYTES ya listos para enviar.
 * Los cuatro Buffers grandes se sustituyen juntos en cada refresco: se
 * construyen todos los nuevos primero y solo entonces se sobreescriben los
 * campos (los antiguos quedan liberados; ninguna copia persiste a medias).
 */
const cache = {
  /** Buffer del array de estaciones (JSON exacto que irá tras "stations":). */
  arrayBuf: null,
  /** Cabeceras del envelope: `{"fecha":..,"count":..,"updatedAt":..,"stale":false,"stations":` */
  headFresh: null,
  /** Cabecera de la variante caducada: `{"fecha":..,"count":..,"updatedAt":..,"stale":true,"warning":"..","stations":` */
  headStale: null,
  /** Gzip precalculado de la respuesta completa (fresh y stale). */
  gzFresh: null,
  gzStale: null,
  /** ETags de cada variante (hash del gzip). */
  etagFresh: null,
  etagStale: null,
  /** Fecha oficial del feed (campo `Fecha`, ej. "27/09/2026 14:06:30"). */
  fecha: null,
  /** Cuándo se descargó (ms epoch). */
  fetchedAt: 0,
  /** Promesa de revalidación en curso (evita descargas simultáneas). */
  inflight: null,
};

/* ------------------------------------------------------------------ */
/* Descarga del feed                                                    */
/* ------------------------------------------------------------------ */

/**
 * Descarga el feed del MITECO como ArrayBuffer (bytes, sin string de 12 MB
 * en el heap de V8). Con timeout total de FETCH_TIMEOUT_MS
 * (AbortSignal.timeout cancela conexión y lectura) para que nunca quede una
 * promesa bloqueada indefinidamente.
 */
async function fetchFeed() {
  const url = `${MITECO_BASE}/EstacionesTerrestres/`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FuelEspana/1.0 (+proxy; datos MITECO)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`MITECO no respondió en ${Math.round(FETCH_TIMEOUT_MS / 1000)} s`);
    }
    throw new Error(`No se pudo conectar con MITECO: ${err.message}`);
  }
  if (!res.ok) {
    // Consumir el cuerpo para liberar el socket aunque sea un error.
    res.text().catch(() => {});
    throw new Error(`MITECO respondió ${res.status} ${res.statusText}`);
  }
  try {
    return Buffer.from(await res.arrayBuffer()); // vista sobre los bytes; sin copia
  } catch (err) {
    throw new Error(`No se pudo leer la respuesta del MITECO: ${err.message}`);
  }
}

/**
 * Camino rápido (extracción SIN parsear todo el feed): localiza el array de
 * estaciones sobre los bytes, su token `Fecha` y el número de elementos,
 * y produce el Buffer final en una pasada (reemplaza las barras escapadas
 * `\/` del MITECO por `/`, que es como JSON.stringify las serializa: el
 * resultado es byte a byte el mismo que generaba res.json()).
 * Devuelve null si el formato no es el esperado → el invocador cae al camino
 * de compatibilidad (parse completo, igual que el backend original).
 */
function scanFeedFast(src) {
  const key = Buffer.from('"ListaEESSPrecio":', 'latin1');
  const keyIdx = src.indexOf(key);
  if (keyIdx === -1 || keyIdx === 0 || keyIdx > 4096) return null;

  let i = keyIdx + key.length;
  while (i < src.length && (src[i] === 32 || src[i] === 9 || src[i] === 10 || src[i] === 13)) i++;
  if (i >= src.length || src[i] !== 0x5b) return null; // '['
  const arrStart = i;

  // Token `Fecha` en la cabecera previa al array (trozo pequeño y acotado).
  const m = src
    .subarray(0, keyIdx)
    .toString('utf8')
    .match(/"Fecha"\s*:\s*(null|"(?:[^"\\]|\\.)*")/);
  if (!m) return null;
  let fecha;
  try {
    fecha = m[1] === 'null' ? null : JSON.parse(m[1]);
  } catch {
    return null;
  }

  // Escaneo por profundidad hasta el `]` que cierra el array (respeta
  // cadenas y escapes). `count`: objetos del primer nivel del array.
  let depth = 0;
  let count = 0;
  let arrEnd = -1;
  let inStr = false;
  let esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 92) esc = true; // backslash
      else if (c === 34) inStr = false; // comilla
      continue;
    }
    if (c === 34) { inStr = true; continue; } // comilla
    if (c === 91) { depth++; continue; } // [
    if (c === 93) { // ]
      depth--;
      if (depth === 0) { arrEnd = i; break; }
      continue;
    }
    if (c === 123) { // {
      if (depth === 1) count++;
      depth++;
      continue;
    }
    if (c === 125) { depth--; continue; } // }
  }
  if (arrEnd === -1 || count === 0) return null;

  // Pasada 1 — validación estricta de la región del array + conteo de los
  // pares `\/` que la reescritura convertirá en `/`. Los escapes se consumen
  // en UNIDADES (5c + byte siguiente), lo que resuelve la paridad de las
  // barras invertidas por construcción (`\\` nunca se lee como `\/`).
  // Se rechaza (→ camino de compatibilidad) y así el backend original
  // garantiza los bytes exactos ante:
  //   - `\uXXXX`  → el original lo serializaría distinto (no canónico),
  //   - escapes inválidos (p. ej. `\d`),
  //   - caracteres de control crudos,
  //   - estructura rota (string sin cerrar a mitad del array).
  let pairs = 0;
  {
    let j = arrStart + 1;
    let inStr = false;
    let bad = false;
    while (j < arrEnd && !bad) {
      const c = src[j];
      if (!inStr) {
        if (c === 0x22) { inStr = true; j++; continue; } // abre string
        // fuera de los strings solo estructura y whitespace JSON
        if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0x20) { bad = true; break; }
        j++;
        continue;
      }
      if (c === 0x22) { inStr = false; j++; continue; } // cierra string
      if (c === 0x5c) { // inicia un escape: se consume la unidad completa
        const n = j + 1 < src.length ? src[j + 1] : -1;
        if (n === 0x2f) { pairs++; j += 2; continue; } // \/ → se compactará
        if (
          n === 0x22 || n === 0x5c || n === 0x62 || n === 0x66 ||
          n === 0x6e || n === 0x72 || n === 0x74
        ) { j += 2; continue; } // " \ b f n r t → unidades canónicas
        bad = true; break; // \uXXXX u otro escape no canónico/inválido
      }
      if (c < 0x20) { bad = true; break; } // control crudo dentro de string
      j++;
    }
    if (bad || inStr) return null; // no es el JSON canónico esperado
  }

  // Pasada 2 — copia con las mismas unidades de escape: cada `\/` genuino
  // (y solo él) pasa de 2 bytes a la barra simple `/` que JSON.stringify
  // produce; las demás unidades se copian literalmente.
  const out = Buffer.allocUnsafe(arrEnd - arrStart + 1 - pairs);
  out[0] = 0x5b; // arco '['
  let w = 1;
  for (let j = arrStart + 1; j < arrEnd; ) {
    const c = src[j];
    if (c === 0x5c) { // unidad de escape (ya validada en la pasada 1)
      const n = j + 1 < arrEnd ? src[j + 1] : -1;
      if (n === 0x2f) { out[w++] = 0x2f; j += 2; continue; } // \/ → /
      out[w++] = c;
      out[w++] = n;
      j += 2;
      continue;
    }
    out[w++] = c;
    j++;
  }
  out[w++] = 0x5d; // arco ']'
  if (w !== out.length) return null; // paranoia: dimensiones exactas

  // Comprobación de muestra: si el primer objeto no es byte-idéntico a su
  // JSON.stringify, el pequeño formato no es el clásico → camino completo.
  if (out.length > 2) {
    const first = 1; // tras '[' viene '{'
    if (out[first] !== 0x7b) return null; // '{'
    let d = 0;
    let str = false;
    let escq = false;
    let end = -1;
    for (let j = first; j < out.length; j++) {
      const c = out[j];
      if (str) {
        if (escq) escq = false;
        else if (c === 92) escq = true;
        else if (c === 34) str = false;
        continue;
      }
      if (c === 34) { str = true; continue; }
      if (c === 123) d++;
      else if (c === 125) {
        d--;
        if (d === 0) { end = j; break; }
      }
    }
    if (end === -1) return null;
    try {
      const sample = out.subarray(first, end + 1).toString('utf8');
      if (JSON.stringify(JSON.parse(sample)) !== sample) return null;
    } catch {
      return null;
    }
  }
  return { arrayBuf: out, count, fecha };
}

/** Gzip por streaming de una lista de Buffers (sin concatenar 12 MB). */
function gzipPieces(pieces) {
  return new Promise((resolve, reject) => {
    const gz = zlib.createGzip();
    const chunks = [];
    gz.on('data', (c) => chunks.push(c));
    gz.on('error', reject);
    gz.on('end', () => resolve(Buffer.concat(chunks)));
    for (const piece of pieces) gz.write(piece);
    gz.end();
  });
}

/** Weak-ETag barato y estable por refresco (hash del gzip, 0,75 MB). */
function makeEtag(buf) {
  return `W/"${crypto.createHash('sha1').update(buf).digest('hex')}"`;
}

/** Cabecera del envelope hasta <"stations":, en el mismo orden de claves
 * (fecha, count, updatedAt, stale[, warning]) que usaba res.json(). */
function envelopeHead(base, stale) {
  const obj = stale
    ? { ...base, stale: true, warning: STALE_WARNING }
    : { ...base, stale: false };
  // JSON.stringify(obj) termina en `}`; se sustituye por `,"stations":`.
  return Buffer.from(JSON.stringify(obj).slice(0, -1) + ',"stations":');
}

/**
 * Descarga, prepara y sobreescribe la caché. Nunca toca los campos actuales
 * hasta que TODAS las piezas nuevas están listas: si algo falla, la caché
 * anterior sigue intacta (se sigue sirviendo stale según la ruta).
 */
async function updateCache() {
  const src = await fetchFeed();

  let arrayBuf;
  let count;
  let fecha;
  let fast;

  const scan = scanFeedFast(src);
  if (scan) {
    arrayBuf = scan.arrayBuf;
    count = scan.count;
    fecha = scan.fecha;
    fast = true;
  } else {
    console.warn('[proxy] formato del feed no reconocido por el camino rápido; usando parse completo');
    // Camino de compatibilidad: exactamente la validación y la serialización
    // del backend original (produce bytes idénticos).
    const json = JSON.parse(src.toString('utf8'));
    if (!json || !Array.isArray(json.ListaEESSPrecio)) {
      throw new Error('Respuesta inesperada del MITECO (sin ListaEESSPrecio)');
    }
    arrayBuf = Buffer.from(JSON.stringify(json.ListaEESSPrecio), 'utf8');
    count = json.ListaEESSPrecio.length;
    fecha = json.Fecha ?? null;
  }

  // Los bytes descargados ya no se necesitan: liberarlos antes del gzip.
  void src;

  const fetchedAt = Date.now();
  const base = { fecha, count, updatedAt: new Date(fetchedAt).toISOString() };
  const headFresh = envelopeHead(base, false);
  const headStale = envelopeHead(base, true);
  const gzFresh = await gzipPieces([headFresh, arrayBuf, '}']);
  const gzStale = await gzipPieces([headStale, arrayBuf, '}']);

  // Sustitución de la caché: los Buffers precedentes dejan de estar
  // referenciados y quedan liberados para el GC (ninguna copia diluida).
  cache.arrayBuf = arrayBuf;
  cache.headFresh = headFresh;
  cache.headStale = headStale;
  cache.gzFresh = gzFresh;
  cache.gzStale = gzStale;
  cache.etagFresh = makeEtag(gzFresh);
  cache.etagStale = makeEtag(gzStale);
  cache.fecha = fecha;
  cache.count = count;
  cache.fetchedAt = fetchedAt;

  return {
    count,
    fecha,
    fast,
    gzBytes: gzFresh.length,
    arrayBytes: arrayBuf.length,
  };
}

/**
 * Revalidación con reintento y backoff. Descargas simultáneas no existen:
 * si ya hay una `inflight` se devuelve. Cada intento tiene timeout propio y,
 * si todos fallan, la caché anterior queda intacta.
 */
function refreshCache(opts = {}) {
  const { attempts = 1, backoffMs = 2000 } = opts;
  if (cache.inflight) return cache.inflight;
  const run = (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** (attempt - 2)));
      }
      try {
        return await updateCache();
      } catch (err) {
        lastErr = err;
        if (attempt < attempts) {
          console.error(`[proxy] intento ${attempt}/${attempts} falló:`, err.message);
        }
      }
    }
    throw lastErr;
  })();
  const wrapped = run.finally(() => {
    if (cache.inflight !== null && cache.inflight !== wrapped) return;
    cache.inflight = null;
  });
  cache.inflight = wrapped;
  return wrapped;
}

/**
 * Revalidación programada: cada REVALIDATE_CHECK_MS se comprueba si toca;
 * nunca lanza descargas simultáneas (inflight), respeta el TTL y no se
 * ejecuta si hay datos frescos. `unref()` no impide cerrar el proceso.
 */
const revalidationTimer = setInterval(() => {
  if (cache.inflight) return;
  // Sin datos (precarga fallida al arrancar) también se reintenta.
  const due = cache.arrayBuf === null || Date.now() - cache.fetchedAt >= TTL_MS;
  if (!due) return;
  refreshCache({ attempts: 2, backoffMs: 2000 }).catch((err) => {
    console.error('[proxy] revalidación programada fallida:', err.message);
  });
}, REVALIDATE_CHECK_MS);
revalidationTimer.unref();

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

/**
 * Negociación gzip simplificada: exactamente lo que este endpoint puede
 * ofrecer (gzip precalculado vs identidad). `*` equivale a gzip, como
 * hacía el middleware `compression` antes.
 */
function acceptsGzip(req) {
  const raw = req.headers['accept-encoding'];
  if (!raw) return false;
  let wants = false;
  for (const part of raw.split(',')) {
    const [tok, ...params] = part.trim().split(';');
    let q = 1;
    for (const p of params) {
      const m = /^\s*q=([\d.]+)/i.exec(p);
      if (m) q = Number.parseFloat(m[1]);
    }
    const t = tok.trim().toLowerCase();
    if (q <= 0 || Number.isNaN(q)) {
      if (t === 'gzip') return false; // el cliente excluye gzip explícitamente
    } else if (t === 'gzip' || t === '*') {
      wants = true;
    }
  }
  return wants;
}

/** Si-None-Match → ¿el etag cacheado lo satisface? */
function ifNoneMatch(req, etag) {
  const inm = req.headers['if-none-match'];
  if (!inm) return false;
  const list = inm.split(',').map((s) => s.trim());
  return list.includes('*') || list.includes(etag);
}

/** Envía /api/stations leyendo los Buffers precalculados (sin serializar). */
function sendStations(req, res, mode /* 'HIT' | 'STALE' | 'MISS' */) {
  const fresh = mode !== 'STALE';
  const head = fresh ? cache.headFresh : cache.headStale;
  const gz = fresh ? cache.gzFresh : cache.gzStale;
  const etag = fresh ? cache.etagFresh : cache.etagStale;
  const bytes = head.length + cache.arrayBuf.length + 1; // + '{' final

  res.setHeader('X-Cache', mode);
  res.setHeader('Cache-Control', mode === 'STALE' ? 'public, max-age=60' : 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('ETag', etag);

  if (req.method === 'HEAD') return res.end();

  if (ifNoneMatch(req, etag)) return res.status(304).end();

  if (acceptsGzip(req)) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', gz.length);
    return res.end(gz);
  }
  res.setHeader('Content-Length', bytes);
  res.write(head);
  res.write(cache.arrayBuf);
  return res.end('}');
}

app.get('/api/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    service: 'fuel-espana-proxy',
    mitecoBase: MITECO_BASE,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      arrayBufferBytes: mem.arrayBuffers,
    },
    cache: {
      hasData: cache.arrayBuf !== null,
      fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
      feedFecha: cache.fecha,
      ttlMs: TTL_MS,
      stationsCount: cache.count,
      stationsBytes: cache.arrayBuf ? cache.arrayBuf.length : null,
      gzipBytes: cache.gzFresh ? cache.gzFresh.length : null,
    },
  });
});

app.get('/api/stations', async (req, res) => {
  const age = Date.now() - cache.fetchedAt;
  const hasData = cache.arrayBuf !== null;

  let mode;
  if (hasData && age < TTL_MS) {
    // 1) Caché fresca → servir directamente (cero CPU de serialización).
    mode = 'HIT';
  } else if (hasData) {
    // 2) Caché caducada pero existente → servir stale y revalidar en fondo
    //    con reintentos; si MITECO falla, estos datos siguen respondiendo.
    mode = 'STALE';
    refreshCache({ attempts: 2, backoffMs: 2000 }).catch((err) => {
      console.error('[proxy] revalidación en segundo plano fallida:', err.message);
    });
  } else {
    // 3) Sin caché → esperar a la descarga (con timeout del propio fetch).
    mode = 'MISS';
    try {
      await refreshCache();
    } catch (err) {
      console.error('[proxy] MITECO no disponible:', err.message);
      return res.status(502).json({
        error: 'UPSTREAM_UNAVAILABLE',
        message:
          'No hemos podido actualizar los precios (MITECO no responde). Inténtalo de nuevo en unos minutos.',
      });
    }
  }

  sendStations(req, res, mode);
});

// En producción sirve el frontend compilado (dist/) con fallback SPA.
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[proxy] escuchando en http://localhost:${PORT}`);
  console.log(`[proxy] MITECO base: ${MITECO_BASE} (timeout ${Math.round(FETCH_TIMEOUT_MS / 1000)} s)`);
  // Precalienta la caché al arrancar para que la primera visita sea rápida.
  refreshCache()
    .then((json) =>
      console.log(`[proxy] caché inicial: ${json.count} estaciones, gzip ${json.gzBytes} B (${json.arrayBytes} B sin comprimir, modo ${json.fast ? 'rápido' : 'compatibilidad'})`),
    )
    .catch((err) => console.error('[proxy] precarga fallida (se reintentará bajo demanda):', err.message));
});
