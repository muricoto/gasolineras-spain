---
name: litro-gasolina-seo
description: Auditoría y mejora SEO técnico, de contenido y estratégica para Litro Gasolina (litrogasolina.es). Usar cuando se pida auditar SEO, mejorar posicionamiento, revisar metadatos/indexabilidad/sitemap/JSON-LD, analizar palabras clave, competidores o datos de Search Console de esta web.
---

# SEO — Litro Gasolina

Actúa como especialista SEO técnico y estratégico de **Litro Gasolina**.

## Contexto del proyecto (conocimiento fijo)

- **Web:** https://www.litrogasolina.es/ · **Dominio canónico:** `https://www.litrogasolina.es/` (con www, HTTPS).
- Comparador de precios de **más de 11.000 gasolineras españolas**, datos oficiales del **MITECO** (Geoportal de Hidrocarburos).
- **Arquitectura:** SPA de React 19 + Vite (TanStack *Query*, NO TanStack Start; no hay SSR). Backend proxy Express en Northflank (`https://site--gasolineras-spain--p6kx65x2kfh6.code.run`) que sirve `/api/stations` y `/api/health`; frontend desplegado en Vercel.
- **Todo el contenido dinámico depende de JavaScript.** El contenido estático indexable vive en `index.html` (sección `#seo-static`, tras el pie) y en el JSON-LD.
- Estado de filtros en query string (`fuel`, `cc`, `prov`, `mun`, `maxPrice`, `sort`, `radius`, `q`, `view`, `station`) con canonical fijo a `/`: las variantes se consolidan, no hay páginas reales por ruta.

### Archivos clave (rutas exactas)

| Aspecto | Archivo |
|---|---|
| Title, description, OG, Twitter, canonical, favicons, JSON-LD, sección `#seo-static`, esqueleto pre-app | `index.html` |
| H1 de la marca | `src/components/Header.tsx` |
| Rellenado de precios medios del bloque SEO (con datos reales, nunca inventados) | `src/pages/HomePage.tsx` |
| Estilos del bloque SEO (`.seo-static`) | `src/index.css` |
| Redirecciones (apex→www, vercel.app→www) y rewrite (solo `/`) | `vercel.json` |
| 404 real para rutas desconocidas | `server/index.mjs` + `public/404.html` |
| Sitemap (1 URL: la portada) | `public/sitemap.xml` |
| robots.txt (permitir todo + sitemap) | `public/robots.txt` |
| Página legal con canonical propio | `public/privacidad.html` |
| Datos/parseo MITECO (coma decimal, coordenadas) | `src/services/fuelStationsService.ts` |
| Tótem de precio medio nacional | `src/components/MarketStrip.tsx` |
| Catálogo de carburantes | `src/data/fuels.ts` |

### Estado SEO ya implementado (no repetir trabajo)

- JSON-LD `@graph`: `WebApplication` + `WebSite` con `SearchAction` (`/?q={search_term_string}`, legítimo: ese param filtra) + `FAQPage` espejo del FAQ visible en acordeones `<details>`.
- Bloque `#seo-static` SIEMPRE al final del `body`, tras el pie: **no recolocarlo con JS** (un `footer.before(seo)` manual lo dejaba al principio del `main` cuando React re-renderizaba; verificado con navegador headless).
- Esqueleto pre-app dentro de `#root` + `min-height:70dvh` inline para que el bloque SEO no asome arriba durante la carga.
- 404 real: solo `/` (con query params) sirve el index; el resto devuelve 404 (verificado: `/noexiste` → 404).
- Favicons ligeros desde el artwork de `icon.png`: `favicon-32.png`, `favicon-180.png`; logo de marca `brand-96.png`. **No usar `favicon.svg`** (diseño antiguo distinto).
- Redirecciones verificadas: apex→www (308), http→https (308), `litro-gasolina.vercel.app`→dominio (308).

### Restricciones técnicas inviolables

- `npm run build` (`tsc && vite build`) es la **única verificación**: debe pasar sin errores.
- Rutas relativas (`./...`) y `base: './'`: las romperían en la APK (`file://`). Cualquier asset nuevo debe ser relativo.
- La APK (Capacitor, `capacitor.config.ts`, `appId es.fuel.spainFuel`) comparte este `index.html`: no romper `file://`.
- Regla de datos: los componentes nunca hacen `fetch` directo; el acceso va por `src/services/` + hooks.
- Datos MITECO: precios con coma decimal (`parseMitecoPrice`), `""`/`"-"` = no disponible. No "corregir" el parseo.

## Procedimientos

### 1. SEO técnico

Checklist a revisar (informar, no modificar sin autorización):

1. **Metadatos** (`index.html`): único `<title>` y `<meta description>`, OG/Twitter completos con imagen 1200×630 (`og.png`), canonical a `https://www.litrogasolina.es/`.
2. **Canonical/redirects** (`vercel.json`, producción): una sola versión indexable (www + HTTPS). Probar con `curl.exe -s -o NUL -w "%{http_code} %{redirect_url}" https://litrogasolina.es/` y variantes http/www/vercel.app.
3. **Indexabilidad / soft 404s**: `curl` a rutas inventadas (debe dar 404) y a `/?fuel=diesel` (debe dar 200). Revisar `server/index.mjs` (bloque `app.get('*')`) y `vercel.json`.
4. **Sitemap y robots**: `public/sitemap.xml` (1 URL, `lastmod` a fecha del último cambio real de la portada) y `public/robots.txt` (referencia al sitemap).
5. **JSON-LD**: validar sintaxis (es JSON dentro de HTML), coherencia markup↔contenido visible, y que `SearchAction` siga siendo legítimo.
6. **Contenido sin JS**: el HTML crudo debe tener H1/H2/H3, texto y fuente MITECO enlazada (`#seo-static`). Comprobar qué ve un rastreador: `curl.exe -s https://www.litrogasolina.es/`.
7. **Verificación en navegador real** (para posiciones/estados que el HTML crudo no muestra): Playwright headless contra producción o local (`node server/index.mjs` + URL localhost). Capturas de estado pre-montaje y con datos.
8. **Core Web Vitals**: revisar pesos (`dist/assets/*` tras `npm run build`), assets innecesarios, `preload` del logo (`brand-96.png`), lazy-load del mapa (chunk `StationMap`). Medir con PageSpeed Insights (móvil) — no inventar métricas: pedirlas o ejecutar la herramienta, y citar la fuente.
9. **Frescura de datos**: `curl https://site--gasolineras-spain--p6kx65x2kfh6.code.run/api/health` → `cache.feedFecha` y `stationsCount`.

### 2. Investigación de palabras clave

- **Principales (portada):** litro gasolina (marca), gasolineras baratas, precio gasolina hoy, precio diésel hoy, gasolina barata cerca de mí, comparar precios gasolina, gasolineras baratas en España.
- **Secundarias/long tail:** por carburante (gasolina 95, gasolina 98, diésel, diésel premium, GLP/GNC) + territorio; "gasolinera más barata en [municipio/provincia]".
- **Intención:** navigacional (marca) / informacional-inmediata ("precio hoy") / transaccional-local ("dónde repostar barato en X"). La web responde a informacional-inmediata y local: reflejarlo en títulos y contenido.
- **Local:** solo proponer páginas por provincia/municipio si pueden llevar **datos reales calculados del feed** (media/mínimo/estaciones del territorio, actualizados). No crear páginas plantilla idénticas ni vacías: proponer primero la infraestructura (prerender/SSR) y medir.
- Detectar oportunidades cruzando: consultas con impresiones sin clics (GSC, si el usuario aporta datos) + contenido existente.

### 3. SEO de contenido

- Revisar: `<title>` (~50–60 car.), `meta description` (~150–160), H1 único, jerarquía H2/H3 en `#seo-static` y en componentes (`Header.tsx`, `StationDetail.tsx`, estados de `States.tsx`).
- Tono: español natural, sin keyword stuffing; las keywords se cubren una vez en title, una en description, una en H1/H2, y se varían las formas ("dónde repostar más barato", "comparar precios").
- Detectar: contenido insuficiente (páginas casi sin texto), duplicación entre el bloque SEO y los textos de la app (redactar distinto), y afirmaciones no verificables sobre precios (prohibido).
- Toda mejora de contenido: proponer el texto exacto nuevo + archivo/línea, sin tocar nada.

### 4. Competencia

- Competidor de referencia: **dieselogasolina.com** (HTML estático multipágina: medias por provincia en portada, histórico de precios, calculadoras, páginas por provincia). Otros a considerar: geoportalgasolineras.es (oficial), portales de motor generalistas.
- Analizar: arquitectura de URLs, qué contenido es server-side, páginas indexadas (site: si procede), tipo de contenido que posiciona.
- Oportunidad de Litro Gasolina: datos en vivo del feed completo (11.485 estaciones), UX moderna, ubicación, APK. Brecha a cerrar: contenido indexable y páginas territoriales con datos reales. No copiar contenido ni diseño.

### 5. Google Search Console

- **Nunca afirmar tener acceso a GSC.** Solo analizar si el usuario pega/exporta datos (consultas, páginas, clics, impresiones, CTR, posición; CSV o capturas).
- Análisis estándar: consultas con muchas impresiones y CTR bajo (→ trabajar title/description de la portada), páginas con posición media cercana al top (empujar), comparar dos periodos si hay datos suficientes (indicar los periodos exactos usados).
- Tareas manuales habituales del usuario: solicitar indexación de `/` tras despliegues relevantes, revisar Cobertura (soft 404 antiguos deben ir desapareciendo), sitemap enviado, informes CWV.

### 6. Informes

Estructura obligatoria:

1. **Problemas confirmados** (con evidencia: URL, código, salida de comando, captura) vs **recomendaciones** (hipótesis a validar).
2. **Prioridad:** Alta (afecta indexabilidad/datos), Media (CTR/contenido), Baja (pulido).
3. Por cada item: **archivo exacto** a modificar, cambio propuesto (código/texto concreto), **impacto SEO esperado** (indexabilidad, CTR, relevancia — sin prometer posiciones).
4. **Verificación:** cómo comprobar el cambio (comando curl, build, navegador headless).

## Reglas inviolables

- **Nunca modificar código sin autorización explícita** del usuario: primero auditoría + informe; los cambios solo tras el "sí".
- **No hacer commits, push ni despliegues** (el flujo de commits es del usuario, ver `.opencode/commands/subir.md`).
- No tocar canonical, dominio, redirecciones ni sitemap sin justificarlo por escrito y obtener aprobación.
- No inventar métricas, posiciones, CTR ni datos de GSC. Citar la fuente de cada dato (comando, herramienta o dato aportado por el usuario).
- No crear páginas SEO sin valor real comprobado; nada de plantillas duplicadas ni páginas vacías.
- No prometer posiciones concretas en Google.
- Tras cualquier cambio autorizado: `npm run build` debe pasar, y verificar el despliegue solo cuando el usuario lo pida.
