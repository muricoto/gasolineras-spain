# AGENTS.md — Fuel España

Frontend React 19 + TypeScript + Vite + proxy Express hacia MITECO (precios de carburantes de España). Sin tests, linter, CI ni monorepo.

## Comandos

- `npm install` — instalar (Node >= 18).
- `npm run dev:all` — desarrollo preferido: backend `:3001` + frontend `:5173` a la vez.
- `npm run server` / `npm run dev` — proxy o frontend por separado.
- `npm run build` — **única verificación** (`tsc && vite build`); debe pasar sin errores.
- `npm start` — producción: sirve `dist/` + `/api/*` desde `server/index.mjs`. Requiere `npm run build` antes.
- `npm run preview` — solo previsualiza el build de Vite (sin API); para prueba completa preferir `npm start`.

## Arquitectura

- El navegador no puede llamar a MITECO directamente (sin cabeceras CORS). Flujo: `MITECO → server/index.mjs (caché) → GET /api/stations → src/services/fuelStationsService.ts → hooks/useFuelStations.ts (TanStack Query) → pages/HomePage.tsx → components/`.
- Dev: Vite proxea `/api/*` → `http://localhost:3001` (`vite.config.ts`). Prod: Express sirve el estático `dist/` con fallback SPA.
- Caché del servidor: en memoria, TTL 15 min (`CACHE_TTL_MS`), stale-while-revalidate con una sola petición inflight; precarga al arrancar. Endpoints: `GET /api/stations` (`{ fecha, count, updatedAt, stale, stations }`), `GET /api/health`.
- Regla de datos: los componentes nunca hacen `fetch` directo; añadir acceso vía `src/services/` + hooks. Config de query en `hooks/useFuelStations.ts` (staleTime 10 min, refetch 15 min, retry 2, mantiene datos previos).
- Env (`PORT`, `MITECO_API_URL`, `CACHE_TTL_MS` — ver `.env.example`): se leen con `process.env` en `server/`, sin secretos.
- Entradas: `src/main.tsx`, `src/App.tsx`, `pages/HomePage.tsx`; el mapa es chunk `React.lazy`. Nombres de CCAA: `src/data/territory.ts`; catálogo de combustibles: `src/data/fuels.ts`.

## Datos MITECO (no "corregir")

- Precios/coords con coma decimal: `"1,849"` → número, `""`/`"-"` = no disponible (`parseMitecoPrice`); coords `"39,211417"` → float (`parseCoord` en `fuelStationsService.ts`).
- Forma cruda: `{ Fecha, ListaEESSPrecio[], ... }`, clave `IDEESS`; fecha oficial en `Fecha` (`"27/09/2026 14:06:30"`).
- Feed ~12 MB / ~11.500 estaciones: mantener lista progresiva (48/pág), tarjetas memoizadas, mapa con supercluster y tope (4.000 marcadores), filtrado con `useMemo`.
- Mapa: el punto individual lleva etiqueta permanente con el precio del combustible activo (`Tooltip`, clase `mk-price`, formato corto en `format.ts`).
- El estado de filtros vive en la query string (`fuel`, `prov`, `sort`, `view`, `station`); al tocar `useStationFilters.ts` preservar URLs compartibles.
- Preferencias persistentes: `useStationFilters.ts` guarda en `localStorage` (`fuel-espana-filters`, validado al leer, query con debounce). Prioridad al arrancar: URL con params > localStorage > defecto. Un enlace compartido nunca queda contaminado por lo guardado.
- Favoritas: mismo hook (`fuel-espana-favorites`, `{ id, name, filters }`, sin duplicados exactos). Nombre auto (`"Villarrobledo · Diésel"`) en `FilterPanel.tsx`; aplicar sustituye todos los filtros (saneados).
- Nueva búsqueda de texto (vacío → texto) resetea todos los filtros salvo el combustible (`newSearch` en el hook, usado en `HomePage.tsx`); refinar el texto no toca nada. Botón "Limpiar filtros" en el pie del panel cuando hay filtros activos.

## Responsive / Capacitor (Android)

- Base ya mobile-first (`src/index.css`): grid 1 → 2 → 3 cols, `filter-grid` 2 → 3 → 5, modal como bottom-sheet en móvil, rail horizontal en `cheapest-row`.
- Convenciones a mantener: `viewport-fit=cover` en `index.html`; `100dvh` (con fallback `100vh`) y alturas de mapa en `dvh`; `env(safe-area-inset-*)` en header, `.container` y modal; `font-size: 16px` en inputs/selects (evita zoom en iOS); `touch-action: manipulation` en botones y `pan-x pan-y` en `.map`; targets táctiles ≥ 44px en móvil (ver `@media (max-width: 599px)`).
- En pantallas < 600px el buscador ocupa su propia fila (`order: 3`, 100% ancho); no volver a una sola fila.
- Al añadir Capacitor: hace falta `base: './'` en `vite.config.ts` (hoy es `/` por defecto), `webDir: 'dist'`, y la app usará `navigator.geolocation` del WebView (revisar `hooks/useGeolocation.ts` y permisos en `AndroidManifest.xml`). El proxy Express no viaja en la app: la APK debe apuntar a una URL pública de `/api/stations`, no a `localhost:3001`.
