# 📱 Guía de Instalación y Notificaciones - App Móvil

## 🎯 Objetivo
Instalar la app en tu celular Android y configurar notificaciones push.

---

## ✅ Pre-requisitos Verificados

Tu proyecto ya tiene:
- ✅ `expo-notifications` instalado (v0.32.16)
- ✅ Configuración de notificaciones en `app.json`
- ✅ Proyecto EAS configurado
- ✅ APK existente (`universal.apk`)

---

## 📦 OPCIÓN 1: Instalar APK Existente (RÁPIDO - 5 minutos)

### Paso 1: Transferir APK a tu celular

**Método A - USB:**
```bash
# Conecta tu celular por USB
# Asegúrate de tener "Transferencia de archivos" activada en el celular

# Copia el APK
adb push c:\Users\camer\github\mobile\universal.apk /sdcard/Download/bienestar.apk
```

**Método B - Google Drive/Email:**
1. Sube el archivo `mobile/universal.apk` a Google Drive
2. Descárgalo desde tu celular
3. Toca el archivo para instalarlo

### Paso 2: Instalar en el celular

1. En tu celular, ve a **Configuración** → **Seguridad**
2. Activa **"Fuentes desconocidas"** o **"Instalar apps desconocidas"**
3. Abre el APK descargado
4. Toca **"Instalar"**
5. ✅ Listo, la app estará instalada

### Paso 3: Configurar la URL del backend

La app necesita saber dónde está tu backend. Tienes 2 opciones:

**A) Backend en tu computadora (mismo WiFi):**
```bash
# 1. Averigua tu IP local
ipconfig
# Busca "IPv4" en tu WiFi (ej: 192.168.1.100)

# 2. Inicia el backend
cd c:\Users\camer\github\backend
SET USE_SQLITE=true
SET DB_PATH=./data.db
go run main.go oauth_handlers.go nutritionist_handlers.go
```

Luego en la app móvil, configurar: `http://TU_IP:8080` (ej: `http://192.168.1.100:8080`)

**B) Backend en Render (cloud):**
Ya tienes PostgreSQL en Render, así que usa:
```
https://bienestarapp-backend.onrender.com
```

---

## 🔨 OPCIÓN 2: Generar Nuevo APK con Notificaciones Actualizadas (30 min)

Si quieres las últimas actualizaciones y notificaciones mejoradas:

### Paso 1: Instalar EAS CLI

```bash
npm install -g eas-cli

# Login (usa tu cuenta de Expo)
eas login
```

### Paso 2: Configurar el proyecto

```bash
cd c:\Users\camer\github\mobile

# Verificar configuración
eas build:configure
```

### Paso 3: Generar APK

```bash
# Build APK (tarda ~10-15 minutos en el servidor de Expo)
eas build --platform android --profile preview

# O si quieres uno de producción:
eas build --platform android --profile production
```

El comando te dará un link donde podrás descargar el APK cuando esté listo.

### Paso 4: Descargar e instalar

1. El comando mostrará un link como: `https://expo.dev/accounts/[tu-cuenta]/projects/bienestarapp-mobile/builds/[id]`
2. Abre ese link en tu celular
3. Descarga el APK
4. Instálalo (igual que en Opción 1, Paso 2)

---

## 🔔 Configurar Notificaciones Push

### Paso 1: Obtener Push Token

La app está configurada para obtener el token automáticamente. Cuando inicies sesión, verás en los logs:

```javascript
// En src/App.js o donde gestiones notificaciones
console.log('Push Token:', expoPushToken);
```

### Paso 2: Actualizar backend para enviar notificaciones

El backend ya tiene la tabla `notifications`, pero necesitamos agregar el token del dispositivo.

Vamos a crear una nueva tabla para almacenar tokens de push:

```sql
-- Ejecutar en SQLite o PostgreSQL
CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    device_type TEXT,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### Paso 3: Endpoint para registrar token

Agregaremos en el backend un endpoint para guardar el token:

```go
// POST /api/push-token
// Body: { "token": "ExponentPushToken[xxx]" }
```

### Paso 4: Enviar notificaciones desde backend

Usaremos la API de Expo para enviar notificaciones:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxx]",
    "sound": "default",
    "title": "Nueva Cita",
    "body": "Tienes una cita mañana a las 10:00"
  }'
```

---

## 🧪 Probar Notificaciones Locales

Primero probemos notificaciones locales (sin necesidad de servidor):

### En la app móvil:

```javascript
// Añade un botón para probar
import * as Notifications from 'expo-notifications';

async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "¡Prueba exitosa! 🎉",
      body: "Las notificaciones funcionan correctamente",
      data: { data: 'test notification' },
    },
    trigger: { seconds: 2 }, // En 2 segundos
  });
}
```

### Permisos necesarios:

La app debe pedir permisos al iniciar:

```javascript
const { status } = await Notifications.requestPermissionsAsync();
if (status !== 'granted') {
  alert('No se otorgaron permisos para notificaciones');
}
```

---

## 🔧 Configuración de Notificaciones en el Código

### Archivo: `mobile/src/notifications.js` (CREAR)

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configurar comportamiento de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Obtener token de push
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9b59b6',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('📱 Push Token:', token);
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

// Enviar token al backend
export async function sendTokenToBackend(token, authToken) {
  try {
    const response = await fetch('http://TU_IP:8080/api/push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });
    
    if (response.ok) {
      console.log('✅ Token enviado al backend');
    }
  } catch (error) {
    console.error('❌ Error enviando token:', error);
  }
}
```

---

## 📋 Checklist de Implementación

```
□ APK instalado en el celular
□ App abre correctamente
□ Puedo hacer login
□ Permisos de notificaciones otorgados
□ Token de push obtenido
□ Token enviado al backend
□ Backend almacena el token
□ Prueba de notificación local exitosa
□ Notificación desde backend funciona
```

---

## 🐛 Solución de Problemas

### ❌ Error: "App no se instala"

**Solución:**
1. Verifica que "Fuentes desconocidas" esté activado
2. Desinstala versiones anteriores de la app
3. Reinicia el celular

### ❌ Error: "Notificaciones no aparecen"

**Solución:**
1. Ve a **Configuración** → **Apps** → **Bienestar App**
2. Verifica que las notificaciones estén **activadas**
3. Prueba una notificación local primero

### ❌ Error: "Cannot connect to backend"

**Solución:**
1. Verifica que tu celular esté en el **mismo WiFi** que tu PC
2. En Windows Firewall, permite conexiones al puerto 8080
3. Prueba la IP en el navegador del celular: `http://TU_IP:8080/api/recipes`

---

## 🚀 Siguiente Nivel: Notificaciones Programadas

Una vez que funcionen las notificaciones básicas, puedes implementar:

1. **Recordatorios de comidas** (basados en `meal_times` del usuario)
2. **Recordatorios de medicinas** (desde la tabla `medicines`)
3. **Alertas de citas** (24h antes, como ya tienes en el backend)
4. **Notificaciones de chat** (cuando llega un mensaje nuevo)

---

## 💡 Tips Pro

1. **Testing rápido:** Usa notificaciones locales mientras desarrollas
2. **Logs detallados:** Agrega `console.log` en cada paso de notificaciones
3. **Permisos primero:** Pide permisos al hacer login, no después
4. **Fallback:** Si falla el token, la app debe seguir funcionando

---

¿Listo para empezar? 🎉

**Recomendación:** Comienza con la **Opción 1** (instalar APK existente) para probar rápido.
