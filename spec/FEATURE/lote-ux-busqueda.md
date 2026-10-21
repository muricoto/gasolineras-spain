# FEATURE: Lote UX búsqueda y mapa

## Objetivo

Búsquedas por localidad exactas y con feedback visible, app en claro por
defecto, sin ruido del aviso de caché caducada y etiquetas de mapa
distinguibles de los clusters.

## Contexto

- CONSTITUTION §4 (filtros/URL/storage), §5 (responsive), §3 (debounce 250 ms).
- Peticiones de usuario encadenadas; se implementan en orden 0→4.

## Alcance

- Incluye:
  1. Eliminar el banner `stale-warning` (queda el punto rojo como señal).
  2. Autocompletado de localidades **en la cabecera** (el campo Municipio de
     abajo se elimina; CCAA/provincia quedan como contexto). Elegir fija
     municipio+provincia+CCAA y muestra el nombre en la caja; editar el texto
     suelta el candado.
  3. "Buscando…" durante el debounce + pulso en el contador + scroll a resultados al elegir localidad.
  4. Tema inicial claro (se respeta lo guardado).
  5. Etiquetas `.mk-price` blancas, clusters sin cambios.
  6. Al conceder ubicación: resetea la búsqueda anterior; el orden queda
     siempre de menor a mayor. Al desactivarla, si ordenaba por distancia
     vuelve a precio.
- Excluye: nueva API de localidades (se usan los municipios del feed),
  spinners falsos, modo oscuro por defecto.

## Cambios propuestos

| Archivo | Cambio |
|---|---|
| `src/components/StatusBar.tsx` | fuera banner + prop `warning` |
| `src/pages/HomePage.tsx` | fuera `warning`; pasa `pendingQuery`; ancla `id="resultados"` |
| `src/hooks/useStationFilters.ts` | faceta `places[]` (municipio→provincia+CCAA) |
| `src/components/FilterPanel.tsx` | combobox municipio; "Buscando…"; pulso contador |
| `src/components/StationList.tsx` | ancla para scroll (si falta) |
| `src/App.tsx` | tema inicial claro |
| `src/index.css` | combobox, pulso, `.mk-price` blancas |
| `README.md` | ajusta línea del aviso de caché caducada |

## Criterios de aceptación

- [ ] Con caché caducada no hay banner; el punto se vuelve rojo.
- [ ] "villa" sugiere localidades en la cabecera; Enter elige la primera,
      ↑/↓ navegan; elegir fija pueblo+provincia sin hacer scroll.
- [ ] Al escribir se lee "Buscando…"; editar el texto suelta el candado.
- [ ] Primera visita abre en claro aunque el SO esté en oscuro.
- [ ] Etiqueta blanca con nombre + precio; número verde = más barata de su
      ciudad, rojo = más cara, naranja = intermedias (sin diferencia, neutro).
- [ ] Pestaña, cabecera y app Android se llaman "Litro Gasolina - Gasolineras
      baratas".
- [ ] Al conceder ubicación se resetea; el orden queda de menor a mayor.

## Verificación

`npm run build` + prueba manual: caducada, combobox, debounce, tema limpio
(`localStorage` vacío), mapa con zoom.

## Riesgos y decisiones abiertas

- Nombres de municipio duplicados entre provincias: se muestra "Municipio,
  Provincia" y se fijan ambos. Decidido.
