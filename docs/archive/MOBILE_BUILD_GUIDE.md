# Guía de Build y Deployment - Mobile App

## Estado Actual

- ✅ App configurada con Expo SDK 54
- ✅ React Native 0.81.5
- ✅ Google OAuth funcionando
- ✅ EAS Build configurado
- ✅ Desarrollo de cliente (development builds) habilitado

---

## Opciones de Deployment

### Opción 1: Expo Go (Solo para Testing) ⚠️ LIMITADO

**Limitaciones:**
- ❌ No soporta notificaciones push nativas
- ❌ No soporta todas las APIs nativas
- ❌ No puede publicarse en Play Store así

**Uso:**
```bash
cd mobile
npx expo start
# Escanear QR con Expo Go app
```

---

### Opción 2: Development Build (Recomendado para Testing)

**Ventajas:**
- ✅ Todas las features nativas funcionan
- ✅ Notificaciones push
- ✅ Google OAuth completo
- ✅ Instalable en dispositivos físicos

**Pasos:**

1. **Instalar EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Login a Expo**
   ```bash
   eas login
   ```

3. **Configurar proyecto**
   ```bash
   cd mobile
   eas build:configure
   ```

4. **Build para Android (APK)**
   ```bash
   eas build --platform android --profile preview
   ```
   - Selecciona "Build for Android"
   - Espera 10-15 minutos
   - Descarga el APK cuando termine

5. **Instalar en dispositivo**
   - Descarga el APK a tu teléfono
   - Activa "Instalar apps desconocidas"
   - Instala el APK

---

### Opción 3: Production Build (Para Play Store)

**Pasos:**

1. **Crear cuenta de Google Play Developer**
   - Costo: $25 USD una vez
   - https://play.google.com/console/signup

2. **Generar Keystore**
   ```bash
   cd mobile
   eas credentials
   ```
   - Selecciona "Android"
   - "Generate new keystore"
   - Guarda las credenciales

3. **Build AAB (Android App Bundle)**
   ```bash
   eas build --platform android --profile production
   ```

4. **Subir a Play Store**
   ```bash
   eas submit --platform android
   ```
   O manualmente:
   - Ve a Play Console
   - Crea nueva app
   - Sube el .aab
   - Completa la información
   - Envía a revisión

---

### Opción 4: iOS Build (Requiere Mac + Apple Developer)

**Requisitos:**
- Mac con Xcode
- Apple Developer Account ($99/año)
- Certificados y provisioning profiles

**Pasos:**

1. **En Mac con Xcode:**
   ```bash
   cd mobile
   eas build --platform ios --profile production
   ```

2. **Submit a App Store:**
   ```bash
   eas submit --platform ios
   ```

---

## Configuración Previa al Build

### 1. Variables de Entorno

Crear `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=https://tu-backend.onrender.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID=tu-google-client-id
EXPO_PUBLIC_GEMINI_API_KEY=tu-gemini-api-key
```

### 2. Actualizar app.json

Verificar en `mobile/app.json`:

```json
{
  "expo": {
    "name": "Health & Nutrition Control",
    "slug": "bienestarapp-mobile",
    "version": "1.0.0",
    "android": {
      "package": "com.bienestarappmobile",
      "versionCode": 1
    },
    "ios": {
      "bundleIdentifier": "com.bienestarappmobile",
      "buildNumber": "1"
    }
  }
}
```

### 3. Actualizar eas.json

Archivo `mobile/eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## Scripts Útiles

### Build APK Local (sin EAS)
```bash
cd mobile
npm run android
# O con script existente:
./build-apk.bat
```

### Test en Emulador
```bash
cd mobile
npm run android  # Para emulador Android
npm run ios      # Para simulador iOS (solo Mac)
```

### Limpiar y Rebuild
```bash
cd mobile
rm -rf node_modules
npm install
npx expo prebuild --clean
```

---

## Configuración Google OAuth para Builds

### Para Development/Preview Builds:

En Google Cloud Console, agregar SHA-1:

```bash
# Obtener SHA-1 del keystore de Expo
eas credentials
```

### Para Production:

1. Generar keystore de producción
2. Obtener SHA-1
3. Agregar en Google Console:
   - Credentials → Android → OAuth Client
   - Agregar SHA-1 fingerprint

---

## Checklist Pre-Build

- [ ] `npm install` ejecutado sin errores
- [ ] Variables de entorno configuradas
- [ ] app.json actualizado (versión, package name)
- [ ] eas.json configurado
- [ ] Google OAuth configurado con SHA-1
- [ ] Backend funcionando y accesible
- [ ] EAS CLI instalado y logged in

---

## Troubleshooting

### Error: "No suitable version of Gradle was found"
```bash
cd mobile/android
./gradlew clean
cd ../..
```

### Error: "Unable to resolve module"
```bash
cd mobile
rm -rf node_modules
npm install
npx expo prebuild --clean
```

### Error: Google OAuth no funciona
- Verificar SHA-1 fingerprint en Google Console
- Verificar package name coincide
- Verificar Client ID en .env

### Build muy lento
- EAS builds pueden tardar 10-20 minutos
- Primera vez es más lento
- Builds subsecuentes usan cache

---

## Monitoreo de Builds

### Ver builds en progreso:
```bash
eas build:list
```

### Ver detalles de un build:
```bash
eas build:view [BUILD_ID]
```

### Descargar build:
```bash
eas build:download [BUILD_ID]
```

---

## Testing después del Build

1. **Instalar APK en dispositivo físico**
2. **Verificar funcionalidades:**
   - [ ] Login con email/password
   - [ ] Login con Google OAuth
   - [ ] Navegación entre pantallas
   - [ ] Notificaciones push
   - [ ] Llamadas a API backend
   - [ ] Gemini Chat
   - [ ] Perfiles de salud
   - [ ] Citas
   - [ ] Mensajes

---

## Actualizaciones OTA (Over The Air)

Con Expo, puedes actualizar la app sin nuevo build:

```bash
cd mobile
eas update --branch production --message "Bug fixes"
```

**Limitación:** Solo funciona para código JavaScript, no para cambios nativos.

---

## Costos

| Servicio | Costo |
|----------|-------|
| **EAS Build** | Gratis: 30 builds/mes (Android + iOS) |
| **Expo Push Notifications** | Gratis hasta 600,000 notificaciones/mes |
| **Google Play Developer** | $25 USD una vez |
| **Apple Developer** | $99 USD/año |

---

## Archivos Importantes

- `mobile/app.json` - Configuración de la app
- `mobile/eas.json` - Configuración de builds
- `mobile/package.json` - Dependencias
- `mobile/.env` - Variables de entorno
- `mobile/build-apk.bat` - Script de build local

---

## Próximos Pasos

1. ✅ Testing local completo
2. ⚠️ Build development con EAS
3. ⚠️ Testing en dispositivos físicos
4. ⚠️ Build production cuando esté listo
5. ⚠️ Submit a Play Store
6. ⚠️ (Opcional) Build y submit a App Store

---

## Recursos

- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Submit to App Stores](https://docs.expo.dev/submit/introduction/)
- [Google Play Console](https://play.google.com/console/)
- [App Store Connect](https://appstoreconnect.apple.com/)
