# FEATURE: Capacitor + Android

## Objetivo

Empaquetar la app como APK Android instalable, con lista, filtros, favoritas,
mapa y geolocalización funcionando como en web.

## Contexto

- CONSTITUTION §1 (flujo vía proxy propio), §5 (responsive/app) y §6.
- `appId`: `es.fuel.spainFuel`. Nombre: "Fuel España". `webDir`: `dist`.
- El equipo dispone de Android Studio (compilación final de la APK allí).

## Alcance

- Incluye:
  - `@capacitor/core` + `@capacitor/cli`, `capacitor.config.ts`, plataforma `android/`.
  - `base: './'` en `vite.config.ts` (el `/` por defecto rompe en `file://`).
  - URL de la API configurable (`VITE_API_URL`): en web sigue el relativo
    `/api/stations` (proxy Vite); en la APK debe apuntar al backend desplegado.
  - Permisos de ubicación en `AndroidManifest.xml` (fino + aproximado).
  - Favicon relativo (`./favicon.svg`) para que cargue en `file://`.
- Excluye explícitamente:
  - Desplegar el backend en un servidor público (requisito previo externo;
    sin él la APK abre pero sin datos).
  - Firmado release / publicación en Play Store.
  - Plugins Capacitor de geolocalización (se usa `navigator.geolocation`,
    funciona en el WebView).

## Cambios propuestos

| Archivo | Cambio |
|---|---|
| `package.json` | deps `@capacitor/core`, `@capacitor/cli` |
| `vite.config.ts` | `base: './'` |
| `capacitor.config.ts` | nuevo (`appId`, `webDir: 'dist'`) |
| `android/` | plataforma generada (`npx cap add android`) + permisos |
| `src/services/fuelStationsService.ts` | `API_BASE = import.meta.env.VITE_API_URL ?? ''` |
| `.env.example` | documentar `VITE_API_URL` |
| `index.html` | favicon relativo |
| `AGENTS.md` | comandos `npx cap sync`, nota de API pública |

## Criterios de aceptación

- [ ] `npm run build` en verde y `npx cap sync` copia `dist/` a `android/`.
- [ ] APK debug instalada desde Android Studio abre la lista de estaciones.
- [ ] Filtros, favoritas y etiquetas de precio del mapa funcionan en la APK.
- [ ] "Cerca de mí" pide permiso de ubicación y ordena por distancia.

## Verificación

```bash
npm run build
npx cap sync
# Android Studio → abrir carpeta android/ → Run 'app' en emulador o dispositivo
```

Para probar contra el backend local desde un dispositivo físico en la misma
red: compilar con `VITE_API_URL=http://<IP-del-PC>:3001` (con el `npm run server`
arrancado). En emulador: `http://10.0.2.2:3001`.

## Riesgos y decisiones abiertas

- Sin backend público, la APK release no tiene datos. Decisión pendiente:
  dónde desplegar `server/index.mjs` (VPS, Render, Fly…).
- Primera sincronización descarga dependencias Gradle (lento la primera vez).
