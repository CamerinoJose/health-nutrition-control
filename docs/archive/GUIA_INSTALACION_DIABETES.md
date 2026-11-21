# 🩺 Guía de Instalación y Uso - Notificaciones para Diabetes

## 📲 Paso 1: Instalar la APK

### Descargar e Instalar:
1. **Descargar APK**: https://expo.dev/accounts/camerinojose/projects/bienestarapp-mobile/builds/f7f676b7-da7c-4c15-8185-da3a7f5c71ca

2. **Desinstalar app anterior** (si existe):
   - Configuración → Apps → BienestarApp → Desinstalar

3. **Instalar nueva APK**:
   - Abrir archivo descargado
   - Permitir instalación de fuentes desconocidas si pregunta
   - Presionar "Instalar"

---

## 🌐 Paso 2: Configurar Backend

### Obtener tu IP local:
```cmd
ipconfig
```
Busca "Dirección IPv4" (ejemplo: `192.168.1.10`)

### Configurar en la app:
- URL del backend: `http://TU_IP:8080`
- Ejemplo: `http://192.168.1.10:8080`

---

## 🔐 Paso 3: Iniciar Sesión

**Usuario de prueba:**
- Email: `test@test.com`
- Contraseña: `test123`

---

## 💊 Paso 4: Configurar Medicinas

### Desde el menú principal:
1. **Perfil de Salud** → **Medicinas**
2. Agregar cada medicina con su horario exacto

### Ejemplos para diabetes:
```
Medicina: Metformina 850mg
Hora: 08:00
[Agregar]

Medicina: Metformina 850mg  
Hora: 14:00
[Agregar]

Medicina: Metformina 850mg
Hora: 20:00
[Agregar]

Medicina: Insulina rápida
Hora: 07:45
[Agregar]

Medicina: Insulina lenta
Hora: 22:00
[Agregar]
```

3. Presionar **"Programar notificaciones"**

---

## 🍽️ Paso 5: Configurar Notificaciones de Comidas y Glucosa

### Desde el menú principal:
1. **Perfil de Salud** → **Notificaciones de Diabetes**

### Configurar horarios:
- 🥞 **Desayuno**: `08:00`
- 🍲 **Comida**: `14:00`
- 🍽️ **Cena**: `20:00`

### Medicina pre-comida (opcional):
Si tomas insulina rápida o medicina antes de comer:
- Ejemplo: `Insulina rápida`
- Se te recordará 15 minutos antes de cada comida

### Activar recordatorios adicionales:
- ✅ **Medición de glucosa** - 2 horas después de cada comida
- ✅ **Actividad física** - 30 minutos después de cada comida

### Guardar:
Presionar **"💾 Guardar y activar notificaciones"**

---

## 🔔 Tipos de Notificaciones que Recibirás

### 1. Medicinas específicas (desde MedicinesScreen)
```
💊 Recordatorio de medicina: Metformina 850mg
¿Ya tomaste tu medicina? Confirma en la app.
Hora: 08:00, 14:00, 20:00
```

### 2. Medicina pre-comida (15 min antes)
```
💊 Insulina rápida
Toma tu medicina 15 minutos antes de desayuno
Hora: 07:45, 13:45, 19:45
```

### 3. Recordatorio de comida
```
🥞 Hora de desayuno
No olvides revisar tu medicina antes de comer
Hora: 08:00, 14:00, 20:00
```

### 4. Medición de glucosa (2 horas después)
```
🩸 Mide tu glucosa
Han pasado 2 horas desde desayuno. Registra tu nivel de glucosa.
Hora: 10:00, 16:00, 22:00
```

### 5. Actividad física (30 min después)
```
🚶 Hora de caminar
Camina 10-15 minutos para ayudar a controlar tu glucosa
Hora: 08:30, 14:30, 20:30
```

---

## 🧪 Probar el Sistema

### Notificación de prueba inmediata:
1. En la pantalla de **Notificaciones de Diabetes**
2. Presionar **"🧪 Probar notificación"**
3. Deberías ver una notificación inmediata

---

## 📊 Ejemplo de Rutina Diaria Completa

```
07:45 - 💊 Insulina rápida (15 min antes)
08:00 - 🥞 Hora de desayuno + Metformina 850mg
08:30 - 🚶 Camina 10-15 minutos
10:00 - 🩸 Mide tu glucosa

13:45 - 💊 Insulina rápida (15 min antes)
14:00 - 🍲 Hora de comida + Metformina 850mg
14:30 - 🚶 Camina 10-15 minutos
16:00 - 🩸 Mide tu glucosa

19:45 - 💊 Insulina rápida (15 min antes)
20:00 - 🍽️ Hora de cena + Metformina 850mg
20:30 - 🚶 Camina 10-15 minutos
22:00 - 💊 Insulina lenta
22:00 - 🩸 Mide tu glucosa
```

---

## ⚙️ Personalizar Notificaciones

### Cambiar horarios:
- Ve a **Notificaciones de Diabetes**
- Modifica las horas
- Presiona **"Guardar y activar notificaciones"**

### Agregar/quitar medicinas:
- Ve a **Medicinas**
- Agrega o elimina medicinas
- Presiona **"Programar notificaciones"** de nuevo

### Desactivar recordatorios:
- Ve a **Notificaciones de Diabetes**
- Desactiva los switches de:
  - Medición de glucosa
  - Actividad física
- Guarda cambios

---

## ❓ Solución de Problemas

### No recibo notificaciones:
1. Verifica permisos: Configuración → Apps → BienestarApp → Permisos → Notificaciones ✅
2. Verifica que no esté en modo "No molestar"
3. Prueba con el botón "🧪 Probar notificación"

### Quiero cambiar horarios:
- Simplemente modifica los horarios y guarda de nuevo
- Las notificaciones anteriores se cancelan automáticamente

### Quiero solo algunas notificaciones:
- Desactiva los switches de las que no quieras
- Deja solo las medicinas específicas si prefieres

---

## 🎯 Mejores Prácticas para Diabetes

### Medicinas:
✅ Programa cada medicina con hora exacta
✅ Incluye nombre completo (ej: "Metformina 850mg")
✅ Marca como tomada cuando la tomes

### Comidas:
✅ Mantén horarios regulares
✅ Come 15-30 min después de insulina rápida
✅ Camina después de comer

### Glucosa:
✅ Mide 2 horas después de comidas
✅ Registra valores en la app
✅ Observa patrones

### Emergencias:
✅ Siempre lleva snacks para hipoglucemia
✅ Ten tu glucómetro a mano
✅ Informa a alguien de tu condición

---

## 📝 Notas Importantes

- Las notificaciones se repiten TODOS LOS DÍAS
- Puedes modificar la configuración cuando quieras
- La configuración se guarda localmente en tu teléfono
- Si desinstalas la app, deberás configurar de nuevo
- Backend debe estar corriendo para usar otras funciones

---

## 🚀 Próximas Mejoras

- [ ] Sincronizar horarios con backend
- [ ] Historial de medicinas tomadas
- [ ] Gráficas de glucosa
- [ ] Alertas inteligentes según patrones
- [ ] Recordatorios de citas médicas
- [ ] Notificaciones si olvidas marcar medicina

---

## 📞 Soporte

Si tienes problemas o sugerencias, déjame saber para ayudarte a ajustar el sistema a tus necesidades específicas.

**¡Cuida tu salud! 🩺💪**
