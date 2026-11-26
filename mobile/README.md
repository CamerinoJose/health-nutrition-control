# BienestarApp - Mobile (React Native / Expo)

Proyecto inicial con Expo (recomendado) y soporte i18n (es / en).

Pasos rápidos para ejecutar:

1. Instalar Expo CLI globalmente (si no lo tienes):

```bash
npm install -g expo-cli
```

2. En la carpeta `mobile` ejecutar:

```bash
npm install
npm start
```

3. Usa Expo Go en tu teléfono o un emulador para ver la app.

Notas:
- Traducciones en `src/locales`.
- Reemplaza las imágenes en `assets` por tus placeholders reales si quieres.
- Si prefieres no usar Expo, puedo generar una configuración para React Native CLI.

## Prueba básica con Maestro (Android)

Instala [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)
y usa un emulador de prueba con una APK de BienestarApp instalada. Esta prueba
abre la app y comprueba el menú; no verifica inicio de sesión, recordatorios ni
la versión del código que contiene la APK. Usa datos ficticios: los artefactos
de prueba pueden contener capturas o información visible en pantalla.

Desde `mobile`, con Maestro y Android SDK en el PATH:

```powershell
$env:MAESTRO_CLI_NO_ANALYTICS = 'true'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
maestro test --device emulator-5554 .\.maestro\smoke-android.yaml
```

Sustituye `emulator-5554` por el identificador de tu emulador (`adb devices`).
La prueba no borra los datos de la app. Verifica siempre que el emulador y la
versión instalada sean los deseados antes de ejecutarla.
