# 🧪 Guía de Testeo Local - BienestarApp

## 🎯 Objetivo
Testear la aplicación completa en tu computadora antes de subir a producción.

---

## 📋 Checklist Rápido

```
□ Backend corriendo en localhost:8080
□ Frontend corriendo en localhost:5174  
□ Base de datos SQLite con datos de prueba
□ Puedo hacer login
□ Puedo ver el dashboard
□ Puedo crear/ver recetas
□ API responde correctamente
```

---

## 🚀 PASO 1: Iniciar Backend (Con SQLite Local)

### Opción A: Con Script (Más Fácil)

**Windows:**
```bash
cd c:\Users\camer\github
start-backend.bat
```

El script ya:
- Compila el backend
- Usa SQLite automáticamente
- Inicia el servidor en :8080

### Opción B: Manual

```bash
cd c:\Users\camer\github\backend

# Configurar para usar SQLite
set USE_SQLITE=true
set DB_PATH=./data.db

# Compilar
go build -o app.exe

# Ejecutar
app.exe
```

### ✅ Verificar que funciona

Deberías ver en la terminal:
```
Successfully connected to SQLite database!
Created table: users
Created table: histories
...
Server running on :8080
```

### 🧪 Test rápido del backend

Abre otra terminal y ejecuta:
```bash
curl http://localhost:8080/api/health
```

Debería responder: `{"status":"healthy"}`

---

## 🌐 PASO 2: Iniciar Frontend

### En una NUEVA terminal:

```bash
cd c:\Users\camer\github\frontend
npm install
npm run dev
```

Deberías ver:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5174/
➜  Network: use --host to expose
```

### ✅ Verificar que funciona

Abre tu navegador en: http://localhost:5174

Deberías ver la página de login.

---

## 👤 PASO 3: Crear Usuario de Prueba

El backend tiene usuarios de prueba automáticos. Usa estos:

### Usuario Paciente:
```
Email: user@test.com
Password: password123
```

### Usuario Nutrióloga:
```
Email: nutritionist@test.com  
Password: password123
```

### Usuario Admin:
```
Email: admin@test.com
Password: password123
```

---

## 🧪 PASO 4: Tests Funcionales

### Test 1: Login
1. Ve a http://localhost:5174
2. Ingresa: `user@test.com` / `password123`
3. Click "Iniciar Sesión"
4. ✅ Deberías ver el Dashboard

### Test 2: Dashboard
1. Después del login, verifica:
   - ✅ Se muestra tu nombre
   - ✅ Hay estadísticas (peso, grasa, etc.)
   - ✅ Hay gráficas

### Test 3: Recetas
1. Click en "Recetas" en el sidebar
2. ✅ Deberías ver 10+ recetas predefinidas
3. Click en una receta
4. ✅ Se muestran ingredientes y preparación

### Test 4: Crear Perfil de Salud
1. Ve a "Perfil de Salud" o "Settings"
2. Ingresa datos:
   - Altura: 170 cm
   - Peso actual: 70 kg
   - Objetivo: Mantenimiento
3. ✅ Los datos se guardan

### Test 5: API directa

En una terminal:

```bash
# Test 1: Health check
curl http://localhost:8080/api/health

# Test 2: Login
curl -X POST http://localhost:8080/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"user@test.com\",\"password\":\"password123\"}"

# Deberías recibir un token JWT
```

---

## 🔧 PASO 5: Verificar Base de Datos

### Ver las tablas creadas:

```bash
cd c:\Users\camer\github\backend
sqlite3 data.db ".tables"
```

Deberías ver:
```
appointments              medicines
deleted_messages          messages  
food_logs                 notifications
health_profiles           plan_meals
histories                 recipes
meal_plans                user_settings
nutritionist_availability users
```

### Ver usuarios de prueba:

```bash
sqlite3 data.db "SELECT id, name, email, role FROM users;"
```

Deberías ver al menos 3 usuarios.

### Ver recetas:

```bash
sqlite3 data.db "SELECT COUNT(*) FROM recipes;"
```

Debería mostrar 10 o más recetas.

---

## 🐛 Solución de Problemas

### ❌ Error: "port 8080 already in use"

**Solución:**
```bash
# Windows - Matar proceso en puerto 8080
netstat -ano | findstr :8080
taskkill /PID [número_del_pid] /F
```

### ❌ Error: "Cannot connect to backend"

**Verificar:**
1. ¿Backend está corriendo? (verifica terminal)
2. ¿Puerto correcto? (debería ser 8080)
3. ¿CORS configurado? (debería permitir localhost:5174)

**Fix rápido:**
```bash
# Reinicia ambos servidores
# 1. Ctrl+C en backend y frontend
# 2. Vuelve a iniciar backend
# 3. Vuelve a iniciar frontend
```

### ❌ Error: "Login failed"

**Solución:**
```bash
# Verifica que el usuario exista
cd backend
sqlite3 data.db "SELECT * FROM users WHERE email='user@test.com';"

# Si existe pero el login igual falla, revisa el esquema (en bases viejas el id podía quedar NULL)
sqlite3 data.db ".schema users"

# Si ves un esquema incorrecto o IDs raros/NULL, haz reset de la DB local:
# 1) Detén el backend (Ctrl+C)
# 2) Borra la base
#    Git Bash / macOS / Linux:
#    rm -f backend/data.db
#
#    Windows (CMD):
#    del backend\data.db
#
#    Windows (PowerShell):
#    Remove-Item backend\data.db -Force
# 3) Inicia el backend otra vez para que recree tablas + usuarios de prueba

# Si no existe, el backend debería crearlo automáticamente
# Reinicia el backend
```

### ❌ Frontend no carga (pantalla blanca)

**Solución:**
```bash
# Limpia caché y reinstala
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📊 Logs y Debugging

### Ver logs del backend:
El backend muestra logs en la terminal donde lo ejecutaste.
Busca errores en rojo.

### Ver logs del frontend:
Abre DevTools en el navegador (F12) → Pestaña Console

### Ver requests de API:
En DevTools → Pestaña Network → Filtra por "XHR"

---

## ✅ Checklist Final de Testing

Antes de dar por terminado el testing local:

```
□ Backend inicia sin errores
□ Frontend inicia sin errores  
□ Puedo hacer login
□ Dashboard muestra datos
□ Puedo navegar entre páginas
□ Recetas se muestran correctamente
□ Puedo crear/editar perfil de salud
□ API responde en todos los endpoints
□ No hay errores en consola del navegador
□ Base de datos tiene datos
```

---

## 🚀 Siguientes Pasos

Una vez que el testeo local funcione perfectamente:

1. ✅ **Confirmar que todo funciona**
2. 📱 **Testear Mobile** (opcional)
3. ☁️ **Deploy a Render** (cuando estés listo)
4. 🌐 **Compartir con usuarios beta**

---

## 💡 Consejos Pro

### Usar dos terminales:
- Terminal 1: Backend
- Terminal 2: Frontend

### Mantener SQLite para desarrollo:
- Es más rápido que PostgreSQL
- No necesitas configurar nada
- Perfecto para testing

### Usar PostgreSQL solo en producción:
- Render/Neon para la app desplegada
- SQLite para desarrollo local

---

## 📞 ¿Problemas?

Si encuentras algún error que no está en esta guía:
1. Copia el mensaje de error completo
2. Nota en qué paso ocurrió
3. Pídeme ayuda con los detalles

---

**¡Listo para testear! 🎉**
