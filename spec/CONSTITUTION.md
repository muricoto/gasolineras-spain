# CONSTITUTION — Litro Gasolina (SDD)

Fuente de verdad de cómo se construye este proyecto. Toda FEATURE debe
respetarla; si una tarea la contradice, se actualiza primero este archivo.

## 1. Stack y flujo de datos

- Frontend: React 19 + TypeScript + Vite. Backend: proxy Express (`server/index.mjs`).
- El navegador no puede llamar a MITECO (sin CORS). Flujo obligatorio:
  `MITECO → server/index.mjs → GET /api/stations → services/fuelStationsService.ts → hooks → pages → components`.
- Los componentes **nunca** hacen `fetch` directo. Nuevo acceso a datos =
  función en `src/services/` + hook que la consuma.
- TanStack Query: `staleTime` 10 min, `gcTime` 60 min, refetch 15 min solo con
  pestaña visible, `retry` 2, se conservan datos previos si falla el refetch.

## 2. Datos MITECO (no "corregir")

- Precios y coordenadas con coma decimal: `"1,849"` → número; `""`/`"-"` = no
  disponible (`parseMitecoPrice`, `parseCoord` en `fuelStationsService.ts`).
- Forma cruda `{ Fecha, ListaEESSPrecio[] }`, clave `IDEESS`, fecha oficial en
  `Fecha`. Feed ~12 MB / ~11.500 estaciones.

## 3. Rendimiento (límites duros)

- Lista progresiva (48/pág + "Mostrar más"), `StationCard` memoizada.
- Mapa: supercluster + tope 4.000 marcadores con aviso; chunk `React.lazy`.
- Búsqueda con debounce 250 ms; filtrado/orden con `useMemo`.

## 4. Estado, URL y persistencia

- Filtros compartibles por query string (`fuel`, `prov`, `sort`, `view`, `station`).
- Prioridad al arrancar: URL con params > `localStorage` (`fuel-espana-filters`,
  `fuel-espana-favorites`) > defecto. Lo guardado se valida al leer.
- `newSearch` (texto vacío → texto) resetea todo salvo combustible.
- Combustible por defecto e inicial: `gasoline95`.

## 5. Responsive / app

- Mobile-first. Cabecera en grid (`brand actions` / `search search`) en <600px.
- `100dvh` con fallback, alturas de mapa en `dvh`, `env(safe-area-inset-*)`,
  `font-size: 16px` en inputs/selects, `touch-action: manipulation`,
  targets táctiles ≥44px.
- Etiquetas de precio del mapa: `Tooltip` permanente, clase `mk-price`.

## 6. Puertas de calidad y repo

- Verificación: `npm run build` (`tsc && vite build`) en verde.
- No versionar: `node_modules/`, `dist/`, `.env` (ver `.env.example`).
- Commits en español, título ≤72 car. + cuerpo breve. Comando `/subir`.
