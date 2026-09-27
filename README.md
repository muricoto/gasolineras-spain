# ⛽ Fuel España

**El sitio para encontrar y comparar el precio de las gasolineras de España.**

Aplicación web (React + TypeScript + Vite) que consulta **todas las gasolineras de España
(~11.500) y sus precios actualizados** usando como única fuente los datos abiertos oficiales del
**MITECO** (Ministerio para la Transición Ecológica y el Reto Demográfico).

- 🔍 Búsqueda en tiempo real (nombre, dirección, municipio, provincia)
- ⛽ Filtros por combustible, comunidad autónoma, provincia, municipio y precio máximo
- 📍 Geolocalización opcional: distancia, orden y radio (5/10/25/50 km)
- 🏆 Sección "Las más baratas" (siempre comparando el mismo carburante)
- 🗺️ Vista de mapa con clustering + vista de lista con carga progresiva
- 🔄 Actualización automática + botón "Actualizar ahora" + indicador "Actualizado hace X min"
- 🌙 Modo oscuro, responsive mobile-first, accesible, filtros compartibles por URL

## Fuente de datos

Geoportal de Hidrocarburos / **Precios de carburantes en las gasolineras españolas (MITECO)**.

| Concepto | Valor |
|---|---|
| Endpoint oficial | `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/` |
| Catálogo de provincias | `.../PreciosCarburantes/Listados/Provincias/` (usado para verificar el mapeo `IDCCAA → nombre`) |
| Catálogo de productos | `.../PreciosCarburantes/Listados/ProductosPetroliferos/` |
| Formato | JSON: `{ Fecha, ListaEESSPrecio[], Nota, ResultadoConsulta }` |
| Registros | ~11.500 estaciones (`IDEESS` como identificador) |
| Precios | Texto con coma decimal (`"1,849"`); cadena vacía = no disponible |
| Coordenadas | `Latitud` / `Longitud (WGS84)` con coma decimal (`"39,211417"`) |
| Territorio | `Municipio`, `Provincia`, `IDProvincia`, `IDCCAA` (el nombre de CCAA se mapea en `src/data/territory.ts`) |
| Horario | `Horario` (ej. `"L-D: 07:00-22:00"`, `"24H"`); se interpreta en `src/utils/schedule.ts` |
| Actualización | Campo `Fecha` del feed (ej. `"27/09/2026 14:06:30"`); el Ministerio actualiza varias veces al día |

> **CORS:** el dominio del MITECO no envía `Access-Control-Allow-Origin`, por lo que el navegador
> bloquea su consumo directo. Este proyecto **no** hace trucos en cliente: incluye un pequeño
> backend/proxy (`server/index.mjs`, Express) que descarga el feed, lo cachea en memoria
> (TTL 15 min + `stale-while-revalidate`) y lo sirve al frontend en el mismo origen con gzip en
> `GET /api/stations`.

## Requisitos

- Node.js ≥ 18
- npm

## Instalación y ejecución

```bash
npm install

# Desarrollo: backend (puerto 3001) + frontend (puerto 5173) a la vez
npm run dev:all

# O por separado:
npm run server   # proxy MITECO → http://localhost:3001/api/stations
npm run dev      # frontend → http://localhost:5173 (proxea /api al backend)
```

En desarrollo, Vite reenvía `/api/*` a `http://localhost:3001` (ver `vite.config.ts`).

## Producción

```bash
npm run build    # compila el frontend a dist/
npm start        # Express sirve /api/* + el frontend estático (dist/)
```

## Variables de entorno

Ver `.env.example`:

```env
MITECO_API_URL=https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes
PORT=3001
CACHE_TTL_MS=900000
```

Sin secretos: todo es configuración pública.

## Arquitectura

```text
MITECO API
   ↓  (servidor, con caché 15 min + stale-while-revalidate)
GET /api/stations          → server/index.mjs
   ↓
services/fuelStationsService.ts   → fetch + normalizeFuelStation()
   ↓
hooks/useFuelStations.ts          → TanStack Query (staleTime 10 min,
                                    gcTime 60 min, refetch cada 15 min)
hooks/useStationFilters.ts        → filtros + URL + orden + distancias
   ↓
pages/HomePage.tsx
   ↓
components/ (Header, FilterPanel, StationCard, StationList,
             StationMap, StationDetail, CheapestSection, StatusBar, States)
```

```text
src/
  components/   UI (sin llamadas HTTP directas)
  pages/        HomePage
  hooks/        datos, filtros, geolocalización, debounce
  services/     comunicación con el backend + normalización
  types/        FuelStation, filtros, respuesta del API
  utils/        geo (Haversine), formato, horarios
  data/         catálogo de combustibles, mapeo de CCAA
server/         proxy Express al MITECO
```

### Decisiones de rendimiento

- El listado **no** renderiza miles de tarjetas: carga progresiva (48 por página, scroll infinito + botón "Mostrar más") y `StationCard` memoizada.
- El mapa agrupa con **supercluster** y limita a 4.000 marcadores con aviso.
- Búsqueda con debounce (250 ms); filtrado/ordenación con `useMemo`.
- Mapa en chunk separado (`React.lazy`): no se descarga hasta abrir la vista.
- TanStack Query: `staleTime` 10 min, `gcTime` 60 min, `refetchInterval` 15 min (solo con la pestaña visible), `retry` 2. Si un refetch falla, se conservan los datos anteriores; si el proxy sirve caché caducada, solo el punto de estado se vuelve rojo (sin banner).

## URLs compartibles

Los filtros viven en la query string, p. ej.:

```text
/?fuel=diesel&prov=02&sort=price        lista diésel en Albacete, de barato a caro
/?fuel=gasoline95&view=map              mapa de gasolina 95
/?station=4375                          ficha directa de una estación
```

## Calidad

```bash
npm run build   # tsc + vite build, debe compilar sin errores
```
