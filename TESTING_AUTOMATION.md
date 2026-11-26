# Automatización de pruebas

## Web

```powershell
cd frontend
npm.cmd ci
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

El reporte queda en `frontend/playwright-report/`.

## Móvil Android

```powershell
cd mobile
npm.cmd ci
npm.cmd test -- --ci --runInBand
```

Maestro necesita un emulator o teléfono con el APK instalado:

```powershell
adb devices
maestro test .maestro
```

Los flujos viven en `mobile/.maestro/`. Usa cuentas y datos ficticios; no
agregues usuarios reales, PDFs médicos reales ni secretos a los archivos.

## CI

GitHub Actions ejecuta:

- pruebas Go con PostgreSQL;
- pruebas unitarias web y móvil;
- Playwright en Chromium;
- compilación Android y Maestro sobre un emulator.
