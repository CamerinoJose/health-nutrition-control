# 📱 INSTRUCCIONES RÁPIDAS - Instalar App en tu Celular

## ✅ Backend Ya Está Corriendo

Tu backend está funcionando en `localhost:8080` con:
- ✅ SQLite como base de datos
- ✅ Soporte para push tokens
- ✅ Usuarios de prueba creados

---

## 🚀 PASO 1: Instalar APK en tu Celular

### Ya tienes un APK listo en: `mobile/universal.apk`

**Método 1 - USB (Más Rápido):**
1. Conecta tu celular por USB a tu PC
2. Copia `C:\Users\camer\github\mobile\universal.apk` a la carpeta Download de tu celular
3. En tu celular, abre "Archivos" o "Files"
4. Ve a "Descargas" / "Downloads"
5. Toca `universal.apk`
6. Si pide "Instalar apps desconocidas", actívalo
7. Presiona **Instalar**

**Método 2 - Google Drive:**
1. Sube `mobile/universal.apk` a Google Drive
2. Desde tu celular, descárgalo
3. Toca el archivo descargado → Instalar

---

## 📡 PASO 2: Configurar la URL del Backend

### Averigua tu IP local:

En tu PC, ejecuta:
```bash
ipconfig
```

Busca en **"Adaptador de LAN inalámbrica"** o **"Wireless LAN"**:
```
IPv4 Address: 192.168.1.XXX  <-- Esta es tu IP
```

### En la app móvil:

1. Abre la app
2. Cuando intente conectarse y falle, te permitirá configurar la URL
3. Ingresa: `http://TU_IP:8080`
   - Ejemplo: `http://192.168.1.100:8080`
4. Guarda

**IMPORTANTE:** Tu celular y tu PC deben estar en el **mismo WiFi**

---

## 🔐 PASO 3: Hacer Login

Usa cualquiera de estos usuarios de prueba:

**Usuario de Prueba:**
```
Email: test@test.com
Password: Test123!
```

**Admin:**
```
Email: admin@bienestar.test
Password: Admin123!
```

**Nutrióloga:**
```
Email: nutriologa@bienestar.test
Password: Nutri123!
```

---

## 🔔 PASO 4: Activar Notificaciones

1. Al hacer login, la app pedirá permisos para notificaciones
2. Presiona **"Permitir"** / **"Allow"**
3. ✅ Listo! El token se registrará automáticamente

Verás en los logs del backend:
```
[PushToken] ✅ Token registered for user 3 (android)
```

---

## 🧪 PASO 5: Probar Notificaciones

### Crear una Notificación de Prueba:

En el backend, ejecuta:
```bash
cd /c/Users/camer/github/backend
sqlite3 data.db "INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES (3, 'test', 'Prueba', 'Esta es una notificación de prueba', 0, datetime('now'));"
```

La app debería mostrar la notificación en el Dashboard.

### Para Notificación Push:

Tendrías que modificar el backend para enviar push al crear la notificación. Por ahora, las notificaciones in-app funcionan.

---

## 🆕 ¿Generar Nuevo APK con Últimas Actualizaciones?

Si quieres un APK con las mejoras de push notifications:

```bash
cd c:\Users\camer\github\mobile

# Instalar EAS CLI (solo primera vez)
npm install -g eas-cli

# Login a Expo
eas login

# Generar APK (tarda 10-15 min)
eas build --platform android --profile preview
```

Te dará un link para descargar el nuevo APK.

---

## 📊 Verificar que Todo Funciona

**Checklist:**
```
□ APK instalado en el celular
□ App abre correctamente
□ Configurada la URL del backend (http://TU_IP:8080)
□ Login exitoso
□ Dashboard muestra datos
□ Permisos de notificaciones otorgados
□ Token registrado en el backend (ver logs)
□ Puedo navegar por todas las pantallas
```

**Ver tokens registrados:**
```bash
cd /c/Users/camer/github/backend
sqlite3 data.db "SELECT user_id, device_type, substr(token, 1, 50) as token FROM push_tokens;"
```

---

## 🐛 Problemas Comunes

### "No se puede conectar al backend"
- ✅ Verifica que tu celular esté en el mismo WiFi que tu PC
- ✅ Verifica que el backend esté corriendo (debe mostrar logs)
- ✅ Prueba la URL en el navegador del celular: `http://TU_IP:8080/api/recipes`

### "No aparecen notificaciones"
- ✅ Ve a Configuración del celular → Apps → Health & Nutrition Control
- ✅ Verifica que las notificaciones estén activadas
- ✅ Verifica que "Mostrar como ventana emergente" esté activado

### "Backend no responde"
```bash
# Matar procesos anteriores
taskkill /F /IM test.exe

# Reiniciar backend
cd /c/Users/camer/github/backend
set USE_SQLITE=true
set DB_PATH=./data.db
test.exe
```

---

## 💡 Tips

1. **Firewall de Windows:** Si no conecta, puede que Windows Firewall esté bloqueando el puerto 8080. Ve a:
   - Panel de Control → Firewall → Permitir aplicación
   - Busca "Go" o tu app y permite en redes privadas

2. **Ver logs del backend en tiempo real:**
   ```bash
   tail -f /c/Users/camer/github/backend.log
   ```

3. **Backend siempre accesible:** Si quieres que el backend esté disponible siempre, déjalo corriendo en una terminal separada

---

## ✅ ¡Listo para Probar!

1. Instala el APK
2. Configura la URL
3. Haz login
4. ¡Disfruta tu app con notificaciones! 🎉
