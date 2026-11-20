# 🩺 Notificaciones para Diabetes - Guía Completa

## ✅ Funciones que YA tienes

### 1. Notificaciones de Medicinas (MedicinesScreen.js)
**Qué hace:**
- Agregas tus medicinas con nombre y hora (formato HH:MM)
- Presionas "Programar notificaciones"
- Recibes recordatorios automáticos todos los días
- Puedes marcar cuando ya tomaste la medicina

**Ejemplo de uso para diabetes:**
```
Insulina rápida - 07:45  (antes del desayuno)
Metformina 850mg - 08:00  (con desayuno)
Metformina 850mg - 14:00  (con comida)
Metformina 850mg - 20:00  (con cena)
Insulina lenta - 22:00  (antes de dormir)
```

**Cómo programarlas:**
1. Abre la app → Perfil de Salud → Medicinas
2. Escribe nombre de medicina + hora (08:00)
3. Presiona "Agregar"
4. Cuando tengas todas, presiona "Programar notificaciones"
5. ¡Listo! Recibirás recordatorios diarios

---

## 🍽️ Notificaciones de Comidas (PENDIENTE)

### Funciones que podemos agregar:

#### A. Recordatorios de Comidas
```javascript
// Desayuno - 08:00
"🥞 Hora del desayuno - No olvides tu Metformina"

// Comida - 14:00
"🍲 Hora de comer - Revisa tu medicina"

// Cena - 20:00
"🍽️ Hora de cenar - Toma tu Metformina"
```

#### B. Recordatorios de Glucosa
```javascript
// 2 horas después de cada comida
"🩸 Mide tu glucosa - 2 horas después del desayuno"
"🩸 Mide tu glucosa - 2 horas después de la comida"
"🩸 Mide tu glucosa - 2 horas después de la cena"
```

#### C. Recordatorios de Actividad
```javascript
// 30 min después de comidas
"🚶 Camina 10-15 minutos - Ayuda a bajar la glucosa"
```

---

## 🔧 Cómo usar el sistema actual

### Paso 1: Instalar APK
Espera a que termine el build → Desinstala app anterior → Instala nueva

### Paso 2: Configurar Backend
1. Abre CMD (terminal)
2. Escribe: `ipconfig`
3. Busca "Dirección IPv4" (ejemplo: 192.168.1.10)
4. En la app, configura: `http://192.168.1.10:8080`

### Paso 3: Iniciar sesión
- Usuario: test@test.com
- Contraseña: test123

### Paso 4: Agregar medicinas
1. Ve a Perfil de Salud → Medicinas
2. Agrega cada medicina con su hora
3. Presiona "Programar notificaciones"

---

## 📊 Mejoras futuras para diabetes

### 1. Notificaciones inteligentes
- Recordatorio 15 min antes de cada comida
- Recordatorio de medicina ANTES de comer
- Recordatorio de glucosa DESPUÉS de comer

### 2. Integración con comidas
- Si tienes plan de comidas, recordar qué comer
- Avisar cuántos carbohidratos tiene la comida
- Sugerir cantidad de insulina según carbohidratos

### 3. Alertas de emergencia
- Recordatorio si no marcas medicina como tomada
- Alerta si han pasado muchas horas sin registrar comida
- Recordatorio de llevar glucómetro si sales

---

## ⚠️ Importante para diabéticos

### Datos que deberías registrar:
1. **Medicinas**: Todas con horarios exactos
2. **Comidas**: Horarios habituales (8am, 2pm, 8pm)
3. **Glucosa**: Meta antes/después de comidas
4. **Actividad**: Mejor momento para caminar

### Consejos:
- Programa medicinas 15-30 min ANTES de comer
- Mide glucosa 2 horas DESPUÉS de cada comida
- Camina 10-15 min después de comer (ayuda a bajar glucosa)
- Ten snacks para hipoglucemia

---

## 🎯 Plan de acción

1. **Hoy**: Instalar app + Programar medicinas básicas
2. **Mañana**: Agregar notificaciones de comidas
3. **Esta semana**: Agregar recordatorios de glucosa
4. **Próxima**: Integrar con historial de glucosa

---

## 📱 Estado del Build

**Build actual**: En proceso (subiendo archivos)
**Tiempo estimado**: 5-10 minutos para compilar
**Próximo paso**: Te daré el link de descarga cuando esté listo

