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

## Responsive

- Mobile-first: grid 1 → 2 → 3 cols, cabecera en grid <600px (buscador en fila propia), `100dvh`, `env(safe-area-inset-*)`, inputs a 16px, targets ≥44px.

## Capacitor (Android)

- Integrado: `@capacitor/core`, `cli`, `android`; `capacitor.config.ts` (`appId es.fuel.spainFuel`, `webDir dist`); plataforma en `android/` (permisos de ubicación en `AndroidManifest.xml`).
- `vite.config.ts` usa `base: './'` (no volver a `/`: rompe en `file://`). Favicon relativo en `index.html`.
- La API es configurable: `src/services/fuelStationsService.ts` antepone `VITE_API_URL` (vacío en web → relativo). Compilar la APK con `VITE_API_URL=https://<backend-público>`; sin backend público la APK abre pero sin datos.
- Flujo: `npm run build` → `npx cap sync android` → abrir `android/` en Android Studio → Run. Emulador contra backend local: `http://10.0.2.2:3001`; dispositivo físico: `http://<IP-del-PC>:3001`.
- Build para APK con datos reales: `$env:VITE_API_URL="https://fuel-espana.onrender.com"; npm run build` (PowerShell, solo esa compilación; no guardar en `.env` para no romper el proxy local en dev).
