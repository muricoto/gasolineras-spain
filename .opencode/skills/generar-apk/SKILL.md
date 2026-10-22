---
name: Generar APK
description: Compila la app Litro Gasolina y genera la APK de Android para probar en el móvil (build web + cap sync + gradlew assembleDebug). Usar cuando se pida generar/compilar/regenerar la APK o un build de Android.
---

# Generar APK (Litro Gasolina)

Compilación completa de la APK de debug en Windows/PowerShell. La raíz del
proyecto es donde está `package.json` (todas las rutas relativas a ella).

## Workflow

1. **NO tocar iconos**: jamás ejecutar `scripts/gen-icons.ps1` ni modificar
   `assets/icon.png`, `public/icon.png` ni nada de `android/**/mipmap-*`
   salvo petición explícita del usuario (son diseños suyos intocables).
2. **Backend**: la APK necesita `VITE_API_URL` apuntando a Northflank
   (`https://site--gasolineras-spain--p6kx65x2kfh6.code.run`). Si `.env` ya
   lo trae, un build a secas sirve; para ser explícito, exportarlo SOLO para
   esa compilación:
   ```powershell
   $env:VITE_API_URL="https://site--gasolineras-spain--p6kx65x2kfh6.code.run"
   ```
3. **Build web** (única verificación del proyecto: `tsc && vite build`; si
   falla el tsc, arreglar antes de continuar):
   ```powershell
   npm run build
   ```
4. **Sync Android** (copia `dist/` a los assets nativos; no toca mipmap ni
   recursos de iconos):
   ```powershell
   npx cap sync android
   ```
5. **APK debug** (~1 min, incremental):
   ```powershell
   Push-Location android
   .\gradlew.bat assembleDebug --console=plain
   Pop-Location
   ```
6. **Salida**:
   `android/app/build/outputs/apk/debug/app-debug.apk`
7. **Verificación mínima**: comprobar tamaño/fecha con `Get-ChildItem` y, si
   se quiere certeza, leer dentro del zip (`System.IO.Compression`):
   - `assets/public/icon.png` presente,
   - bundle JS contiene `site--gasolineras-spain` (Northflank) y NO
     `onrender`,
   - `<title>` de `assets/public/index.html`.

## Notas

- **Debug firmada con la clave de esta máquina**: se instala ENCIMA de la
  versión previa sin desinstalar. Si hay conflicto de firma (otra máquina),
  desinstalar primero.
- Releases para Play Store NO son esta skill: requieren
  `android/keystore.properties` + `gradlew bundleRelease` (AAB).
- Gradle puede decir `UP-TO-DATE`: los binarios ya son idénticos a lo que
  saldría ahora (mismo hash de bundle web). No fuerces reconstrucciones.
- La consola PowerShell muestra mojibake con UTF-8 (`·`, `ñ`); los ficheros
  están bien, es solo la terminal.
- Timeout generoso: `npm run build` ~10 s, `assembleDebug` ~60 s.
- Los servidores locales (3001/5173) NO hace falta que estén para generar
  la APK.

## Errores frecuentes

- `tsc` falla → el build NO continúa; corregir tipos en `src/` y reintentar.
- Gradle exit != 0 → mostrar las últimas líneas de salida (suele ser SDK o
  Java: `JAVA_HOME` apunta a `C:\Program Files\Java\jdk-21`).
- APK pesa raro o falta el icono → verificar que `cap sync` se ejecutó tras
  `npm run build`.
