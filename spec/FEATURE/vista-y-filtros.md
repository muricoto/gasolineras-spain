# FEATURE: Interruptor de vista + filtros alegres

## Objetivo

Que el cambio Lista/Mapa se vea a simple vista justo encima de los
resultados, y que el formulario de filtros se sienta más vivo sin
rediseñarlo.

## Contexto

- CONSTITUTION §5. El toggle vivía dentro del pie del panel y pasaba
  desapercibido.

## Alcance

- Incluye: `ViewSwitch.tsx` entre filtros y listado; acento amarillo en el
  panel, chips activos en verde, etiquetas en tinta, foco amarillo en selects.
- Excluye: cambios de lógica de filtros o de vista.

## Cambios propuestos

| Archivo | Cambio |
|---|---|
| `src/components/ViewSwitch.tsx` | nuevo (segmentado Lista/Mapa) |
| `src/pages/HomePage.tsx` | lo monta entre panel y resultados |
| `src/components/FilterPanel.tsx` | fuera `view`/`onView` y el toggle viejo |
| `src/index.css` | `.view-switch`, acentos, sin `.view-toggle` |

## Criterios de aceptación

- [ ] El interruptor aparece entre filtros y listado, a ancho completo.
- [ ] La opción activa se distingue a simple vista (amarilla sobre asfalto).
- [ ] El panel muestra filete amarillo, chips verdes y etiquetas oscuras.

## Verificación

`npm run build` + visual en escritorio y 360px, ambos temas.

## Riesgos y decisiones abiertas

- Ninguno.
