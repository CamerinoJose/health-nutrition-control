# 🔔 Sistema de Notificaciones Push - Configuración Completa

## ✅ Lo que se ha configurado

### Backend (Go)
1. ✅ **Nueva tabla `push_tokens`** en la base de datos
2. ✅ **Endpoint POST `/api/push-token`** - Registra el token del dispositivo
3. ✅ **Endpoint DELETE `/api/push-token`** - Elimina el token
4. ✅ **Función `sendPushNotification()`** - Envía notificaciones vía Expo API

### Mobile (React Native)
1. ✅ **Módulo `pushNotifications.js`** con funciones completas:
   - `registerForPushNotificationsAsync()` - Obtiene token de Expo
   - `sendPushTokenToBackend()` - Envía token al servidor
   - `scheduleTestNotification()` - Prueba local
   - `scheduleMealReminder()` - Recordatorios de comida
   - Listeners para notificaciones

2. ✅ **Configuración en `app.json`**:
   - Canal de notificaciones Android
   - Permisos necesarios
   - Iconos y colores

---

## 🚀 Pasos para Instalar en tu Celular

### Opción 1: Usar APK Existente (5 minutos)

Tu directorio `mobile/` ya tiene un `universal.apk`. Para instalarlo:

**Método A - Transferir por USB:**
```bash
# Conecta tu celular por USB
# Copia el archivo a tu celular
copy c:\Users\camer\github\mobile\universal.apk "D:\Download\"
# (Cambia D: por la letra de tu celular)
```

**Método B - Google Drive:**
1. Sube `mobile/universal.apk` a Google Drive
2. Descárgalo desde tu celular
3. Toca el archivo para instalar

**En el celular:**
1. Ve a **Configuración** → **Seguridad**
2. Activa **"Instalar apps desconocidas"** para tu navegador/Files
3. Toca el APK descargado
4. **Instalar** ✅

---

### Opción 2: Generar Nuevo APK (30 minutos)

Si quieres las últimas actualizaciones con notificaciones mejoradas:

```bash
cd c:\Users\camer\github\mobile

# Ejecuta el script automático
build-apk.bat
```

O manualmente:
```bash
# 1. Instalar EAS CLI (solo la primera vez)
npm install -g eas-cli

# 2. Login en Expo
eas login

# 3. Generar APK
eas build --platform android --profile preview
```

El build tarda 10-15 minutos. Te dará un link para descargar el APK cuando esté listo.

---

## 🔧 Configurar Backend URL

La app necesita saber dónde está tu backend.

### Opción A: Backend Local (Mismo WiFi)

1. **Averigua tu IP local:**
```bash
ipconfig
# Busca "IPv4" en tu WiFi (ej: 192.168.1.100)
```

2. **Inicia el backend:**
```bash
cd c:\Users\camer\github\backend
set USE_SQLITE=true
set DB_PATH=./data.db
go run main.go oauth_handlers.go nutritionist_handlers.go
```

3. **En la app móvil**, configurar:
```
http://192.168.1.100:8080
```
(Reemplaza con tu IP)

### Opción B: Backend en la Nube (Render)

Si ya tienes el backend desplegado en Render:
```
https://health-nutrition-control.onrender.com
```

---

## 📱 Probar Notificaciones

### 1. Primera Vez: Obtener Token

1. Abre la app en tu celular
2. Haz login
3. La app pedirá permisos para notificaciones → **Permitir**
4. El token se registrará automáticamente en el backend
5. Verás en los logs del backend:
```
[PushToken] ✅ Token registered for user 3 (android)
```

### 2. Probar Notificación Local

En la app, ejecuta:
```javascript
import { scheduleTestNotification } from './src/pushNotifications';

// Botón para probar
<Button 
  title="Probar Notificación" 
  onPress={scheduleTestNotification}
/>
```

Deberías ver una notificación en 2 segundos: "🎉 ¡Notificaciones funcionando!"

### 3. Probar Notificación desde Backend

Usa curl o Postman para enviar una notificación:

```bash
# 1. Haz login para obtener tu token JWT
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'

# Copia el token del response

# 2. Envía una notificación de prueba
# (Esto lo puedes hacer desde cualquier endpoint que cree notificaciones)
# Por ejemplo, crea una cita y debería enviarse notificación automática
```

---

## 🎯 Tipos de Notificaciones Implementadas

### 1. Recordatorios de Citas (Automático)
El backend ya tiene un worker que revisa citas cada hora:
- 24 horas antes de una cita → Envía notificación
- Se guarda en tabla `notifications`
- **TODO:** Agregar llamada a `sendPushNotification()` en el worker

### 2. Recordatorios de Comida
Desde la app móvil:
```javascript
import { scheduleMealReminder } from './src/pushNotifications';

// Programar recordatorio de almuerzo a las 2pm
const lunchTime = new Date();
lunchTime.setHours(14, 0, 0);

scheduleMealReminder('lunch', lunchTime);
```

### 3. Notificaciones de Chat
Cuando llegue un mensaje nuevo, el backend puede enviar push.

### 4. Notificaciones Personalizadas
Desde cualquier parte del backend:
```go
// Ejemplo: Al crear una cita
appointmentID := 123
userID := 5

// Crear notificación en DB
db.Exec(`INSERT INTO notifications ...`)

// Enviar push notification
sendPushNotification(
    userID, 
    "Nueva Cita",
    "Tu cita ha sido confirmada para mañana a las 10:00",
    map[string]interface{}{
        "type": "appointment",
        "appointment_id": appointmentID,
    },
)
```

---

## 🔗 Integración Completa: Backend → Push

Para que el backend envíe push automáticamente cuando crea una notificación:

### Modificar `checkUpcomingAppointments()` en main.go

Encuentra esta función y agrega después de crear la notificación:

```go
// Crear reminder notification
message := fmt.Sprintf("Recordatorio: Tienes una cita mañana '%s' el %s a las %s", 
    title, aptDate, aptTime)
    
_, err = db.Exec(`
    INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
    VALUES (?, 'appointment_reminder', 'Recordatorio de Cita', ?, ?, 0, datetime('now'))
`, userID, message, aptID)

if err == nil {
    // ✅ AGREGAR ESTO: Enviar push notification
    go sendPushNotification(
        userID,
        "Recordatorio de Cita",
        message,
        map[string]interface{}{
            "type": "appointment_reminder",
            "appointment_id": aptID,
        },
    )
}
```

---

## 📊 Monitoreo y Debug

### Ver tokens registrados:
```sql
-- SQLite
sqlite3 backend/data.db "SELECT user_id, device_type, substr(token, 1, 50) as token FROM push_tokens;"

-- PostgreSQL
SELECT user_id, device_type, substring(token, 1, 50) as token FROM push_tokens;
```

### Logs importantes:
```
[PushToken] ✅ Token registered for user X
[PushNotification] ✅ Push notification sent to user X: Title
[PushNotification] ⚠️ No token found for user X
```

---

## 🐛 Solución de Problemas

### ❌ "No se otorgaron permisos para notificaciones"
**Solución:**
1. Desinstala la app
2. Reinstala
3. Cuando pida permisos, presiona **Permitir**

### ❌ "Push token no se registra"
**Solución:**
1. Verifica que estés usando un **dispositivo físico** (no emulador)
2. Verifica que `projectId` esté en `app.json` → `extra.eas.projectId`
3. Mira los logs de la app: `console.log` debería mostrar el token

### ❌ "Backend no envía notificaciones"
**Solución:**
1. Verifica que el token esté en la tabla:
   ```sql
   SELECT * FROM push_tokens WHERE user_id = YOUR_USER_ID;
   ```
2. Revisa logs del backend para ver si hay errores
3. Prueba manualmente con curl a la API de Expo:
   ```bash
   curl -X POST https://exp.host/--/api/v2/push/send \
     -H "Content-Type: application/json" \
     -d '{
       "to": "ExponentPushToken[XXX]",
       "title": "Test",
       "body": "Testing manual push"
     }'
   ```

### ❌ "Notificaciones no aparecen en el celular"
**Solución:**
1. Ve a **Configuración** del celular → **Apps** → **Health & Nutrition Control**
2. Verifica que las notificaciones estén **activadas**
3. Verifica que "Mostrar como ventana emergente" esté activado
4. Prueba primero una notificación local con `scheduleTestNotification()`

---

## ✨ Próximos Pasos

1. ✅ **Instalar APK en tu celular**
2. ✅ **Hacer login y permitir notificaciones**
3. ✅ **Probar notificación local**
4. ✅ **Ver que el token se registró en el backend**
5. ✅ **Modificar `checkUpcomingAppointments()` para enviar push**
6. ✅ **Crear una cita de prueba para mañana**
7. ✅ **Esperar a que el worker envíe la notificación**
8. 🎉 **¡Notificaciones funcionando!**

---

## 📚 Recursos

- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification Tool](https://expo.dev/notifications)
- [MOBILE_INSTALL_GUIDE.md](MOBILE_INSTALL_GUIDE.md) - Guía detallada de instalación

---

**¿Listo para empezar?** 🚀

1. Instala el APK en tu celular
2. Inicia el backend local
3. Haz login en la app
4. ¡Prueba las notificaciones!
