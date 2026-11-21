# 🔧 Solución: Error "Conflicto con un paquete"

## ❌ El Error

```
No se instaló la app debido a un conflicto con un paquete
```

## ✅ Causa

Ya tienes una versión de la app instalada con una **firma de certificado diferente**. Android no permite reemplazarla sin desinstalar primero.

---

## 🚀 SOLUCIÓN RÁPIDA (2 minutos)

### Paso 1: Desinstalar versión anterior

**En tu celular Android:**

1. Ve a **Configuración** (⚙️)
2. Toca **Apps** o **Aplicaciones**
3. Busca y toca **"Health & Nutrition Control"** o **"bienestarapp-mobile"**
4. Toca **Desinstalar**
5. Confirma

**O desde la pantalla de inicio:**
- Mantén presionada el ícono de la app
- Arrastra a **"Desinstalar"** o toca el ícono de basura
- Confirma

### Paso 2: Reinstalar

Ahora vuelve a instalar el APK:
1. Busca el archivo `universal.apk` en Descargas
2. Tócalo para instalar
3. Si pide "Instalar apps desconocidas" → **Permitir**
4. **Instalar**

✅ ¡Listo!

---

## 🆕 SOLUCIÓN ALTERNATIVA: Nuevo APK (Generando ahora)

Estoy generando un APK completamente nuevo con:
- ✅ Las últimas actualizaciones
- ✅ Notificaciones push integradas
- ✅ Sin conflictos de firma

**Estado del build:**
El APK se está generando en los servidores de Expo (tarda 10-15 min).

Cuando termine, te daré el link para descargarlo directamente en tu celular.

---

## 📱 Después de Instalar

### 1. Abre la app
### 2. Configura el backend

Necesitas averiguar tu IP local:

**En tu PC:**
```bash
ipconfig
```

Busca en "Adaptador de LAN inalámbrica Wi-Fi":
```
IPv4 Address: 192.168.X.XXX  <-- Anota esta IP
```

**En la app:**
- Ingresa: `http://192.168.X.XXX:8080`
- (Reemplaza con tu IP real)

### 3. Haz Login

Usuarios de prueba:
```
Email: test@test.com
Password: Test123!
```

O:
```
Email: admin@bienestar.test
Password: Admin123!
```

### 4. Permite Notificaciones

Cuando pida permisos → **Permitir**

---

## 🐛 Si Sigue Sin Funcionar

### Opción 1: Limpiar caché de instalación

1. Ve a **Configuración** → **Apps** → **Administrador de paquetes** (o similar)
2. Menú (⋮) → **Mostrar sistema**
3. Busca **"Instalador de paquetes"** o **"Package Installer"**
4. Toca **Almacenamiento** → **Borrar caché** → **Borrar datos**
5. Reinicia el celular
6. Intenta instalar de nuevo

### Opción 2: Instalar vía ADB

Si tienes USB debugging activado:

```bash
# En tu PC
adb install -r c:\Users\camer\github\mobile\universal.apk
```

La opción `-r` reemplaza la app existente.

---

## ⏱️ Mientras esperas el nuevo APK...

### Verificar que el backend está corriendo:

```bash
cd /c/Users/camer/github/backend
ls test.exe
```

Si existe, ejecútalo:
```bash
./test.exe
```

O inicia el backend de nuevo:
```bash
cd /c/Users/camer/github/backend
set USE_SQLITE=true
set DB_PATH=./data.db
go run main.go oauth_handlers.go nutritionist_handlers.go
```

---

## 📊 Progreso del Nuevo APK

El build está en curso. Cuando termine:

1. Te daré el **link de descarga**
2. Ábrelo en tu celular
3. Descarga el APK
4. Instálalo (desinstala la anterior primero)
5. ¡Listo!

---

**Tiempo estimado total:** 
- Solución rápida: 2 minutos
- Nuevo APK: ~15 minutos (generando...)
