# 🔔 Sistema de Notificaciones para Diabetes - Flujo Visual

## 📱 ESTRUCTURA DE LA APP

```
BienestarApp Mobile
│
├── 🏠 Dashboard (Inicio)
│
├── 👤 Perfil de Salud ← AQUÍ ESTÁN LAS NUEVAS FUNCIONES
│   │
│   ├── 🩺 Herramientas para Diabetes (NUEVA SECCIÓN)
│   │   │
│   │   ├── 💊 Medicinas
│   │   │   ├── Agregar medicina + hora
│   │   │   ├── Marcar como tomada
│   │   │   └── Programar notificaciones diarias
│   │   │
│   │   └── 🔔 Notificaciones de Diabetes (NUEVA ⭐)
│   │       ├── Configurar horarios de comidas
│   │       ├── Medicina pre-comida (opcional)
│   │       ├── Activar recordatorios de glucosa
│   │       ├── Activar recordatorios de actividad
│   │       └── Guardar y activar
│   │
│   └── ℹ️ Información del perfil
│
├── 🍱 Plan de Comidas
├── 📅 Citas
├── 📊 Progreso
├── 💬 Mensajes
└── ⚙️ Ajustes
```

---

## ⏰ LÍNEA DE TIEMPO DIARIA - NOTIFICACIONES

```
┌─────────────────────────────────────────────────────────────┐
│                     DÍA TÍPICO CON DIABETES                  │
└─────────────────────────────────────────────────────────────┘

07:45 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃
         ┃  💊 NOTIFICACIÓN: Insulina rápida
         ┃  "Toma tu medicina 15 minutos antes de desayuno"
         ┃
         ┃  [Medicina pre-comida programada]
         ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

08:00 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃
         ┃  🥞 NOTIFICACIÓN: Hora de desayuno
         ┃  "No olvides revisar tu medicina antes de comer"
         ┃
         ┃  💊 NOTIFICACIÓN: Metformina 850mg
         ┃  "¿Ya tomaste tu medicina? Confirma en la app"
         ┃
         ┃  [Horario de comida + Medicina específica]
         ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

08:30 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃
         ┃  🚶 NOTIFICACIÓN: Hora de caminar
         ┃  "Camina 10-15 minutos para ayudar a controlar tu glucosa"
         ┃
         ┃  [Actividad física post-comida - 30 min después]
         ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10:00 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃
         ┃  🩸 NOTIFICACIÓN: Mide tu glucosa
         ┃  "Han pasado 2 horas desde desayuno. Registra tu nivel"
         ┃
         ┃  [Medición de glucosa - 2 horas después]
         ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13:45 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  💊 Insulina rápida (15 min antes)
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14:00 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  🍲 Comida + 💊 Metformina 850mg
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14:30 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  🚶 Camina 10-15 minutos
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

16:00 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  🩸 Mide tu glucosa
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

19:45 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  💊 Insulina rápida (15 min antes)
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20:00 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  🍽️ Cena + 💊 Metformina 850mg
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20:30 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃  🚶 Camina 10-15 minutos
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

22:00 ━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ┃
         ┃  💊 NOTIFICACIÓN: Insulina lenta
         ┃  "¿Ya tomaste tu medicina? Confirma en la app"
         ┃
         ┃  🩸 NOTIFICACIÓN: Mide tu glucosa
         ┃  "Han pasado 2 horas desde cena. Registra tu nivel"
         ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         Total: 17 notificaciones diarias
```

---

## 🔄 FLUJO DE CONFIGURACIÓN

```
┌─────────────────────────────────────────────────────────────┐
│                 PASO 1: MEDICINAS ESPECÍFICAS                │
└─────────────────────────────────────────────────────────────┘

Perfil de Salud → Medicinas
    ↓
┌─────────────────────────────────┐
│ Agregar medicina:               │
│ ┌─────────────────────────────┐ │
│ │ Nombre: Metformina 850mg    │ │
│ │ Hora: 08:00                 │ │
│ │ [Agregar]                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Medicinas agregadas:            │
│ • Metformina 850mg - 08:00 ✓    │
│ • Metformina 850mg - 14:00 ✓    │
│ • Metformina 850mg - 20:00 ✓    │
│ • Insulina rápida - 07:45 ✓     │
│ • Insulina lenta - 22:00 ✓      │
│                                 │
│ [Programar notificaciones]      │
└─────────────────────────────────┘
    ↓
✅ Notificaciones de medicinas activadas
   (5 notificaciones diarias)


┌─────────────────────────────────────────────────────────────┐
│            PASO 2: NOTIFICACIONES DE DIABETES                │
└─────────────────────────────────────────────────────────────┘

Perfil de Salud → Notificaciones de Diabetes
    ↓
┌─────────────────────────────────┐
│ 🍽️ Horarios de comidas:        │
│ • Desayuno: 08:00               │
│ • Comida: 14:00                 │
│ • Cena: 20:00                   │
│                                 │
│ 💊 Medicina pre-comida:         │
│ • Insulina rápida               │
│                                 │
│ ⚙️ Recordatorios:               │
│ • Glucosa (2h después) ☑        │
│ • Actividad (30min después) ☑   │
│                                 │
│ [Guardar y activar]             │
└─────────────────────────────────┘
    ↓
✅ Notificaciones de diabetes activadas
   (12 notificaciones adicionales)

    ↓
┌─────────────────────────────────┐
│ TOTAL: 17 notificaciones/día    │
│                                 │
│ • 5 medicinas específicas       │
│ • 3 comidas                     │
│ • 3 medicina pre-comida         │
│ • 3 medición glucosa            │
│ • 3 actividad física            │
└─────────────────────────────────┘
```

---

## 🧩 ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                        CAPA DE UI                            │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌───────────────────────┐
    │   MedicinesScreen     │   │ DiabetesNotifications │
    │                       │   │      Screen           │
    │ • Lista medicinas     │   │ • Config horarios     │
    │ • Agregar/eliminar    │   │ • Medicina pre-comida │
    │ • Marcar tomadas      │   │ • Switches opciones   │
    │ • Programar alerts    │   │ • Guardar config      │
    └───────────┬───────────┘   └───────────┬───────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE LÓGICA                            │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌───────────────────────┐
    │  Notifications        │   │  diabetesNotifications│
    │  (expo-notifications) │   │      Module           │
    │                       │   │                       │
    │ • scheduleNotification│   │ • scheduleMealRem..   │
    │ • cancelNotification  │   │ • scheduleGlucoseRem. │
    │ • getScheduled        │   │ • scheduleActivity..  │
    │ • requestPermissions  │   │ • scheduleMedicine..  │
    └───────────┬───────────┘   │ • setupDiabetes..     │
                │               └───────────┬───────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE ALMACENAMIENTO                     │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌───────────────────────┐
    │    Backend (Go)       │   │   AsyncStorage        │
    │                       │   │   (Local)             │
    │ • GET /medicines      │   │                       │
    │ • POST /medicines     │   │ • diabetesConfig      │
    │ • PUT /medicines/:id  │   │ • mealTimes           │
    │ • DELETE /medicines   │   │ • preferences         │
    └───────────────────────┘   └───────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 SISTEMA OPERATIVO (Android)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Notificaciones Nativas
                    • Aparecen incluso con app cerrada
                    • Se repiten diariamente
                    • Sonido + vibración
                    • Persisten en barra de estado
```

---

## 📊 TIPOS DE NOTIFICACIONES - COMPARACIÓN

```
┌─────────────────────────────────────────────────────────────┐
│              NOTIFICACIONES DE MEDICINAS                     │
│              (MedicinesScreen)                               │
└─────────────────────────────────────────────────────────────┘

Características:
✓ Específicas para cada medicina
✓ Hora exacta configurada por medicina
✓ Mensaje personalizado con nombre de medicina
✓ Requiere confirmación manual (marcar como tomada)
✓ Historial de medicinas tomadas

Ejemplo:
┌─────────────────────────────────┐
│ 💊 Recordatorio de medicina:    │
│ Metformina 850mg                │
│                                 │
│ ¿Ya tomaste tu medicina?        │
│ Confirma en la app.             │
│                                 │
│ 🕐 08:00                        │
└─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│         NOTIFICACIONES DE COMIDAS Y GLUCOSA                  │
│         (DiabetesNotificationsScreen)                        │
└─────────────────────────────────────────────────────────────┘

Características:
✓ Basadas en horarios de comidas
✓ Calculadas automáticamente (pre/post comida)
✓ Incluye actividad física
✓ Recordatorios de medición de glucosa
✓ Configuración única para todas

Ejemplos:

┌─────────────────────────────────┐
│ 💊 Insulina rápida              │
│                                 │
│ Toma tu medicina 15 minutos     │
│ antes de desayuno               │
│                                 │
│ 🕐 07:45 (auto-calculado)       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🥞 Hora de desayuno             │
│                                 │
│ No olvides revisar tu medicina  │
│ antes de comer                  │
│                                 │
│ 🕐 08:00                        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🚶 Hora de caminar              │
│                                 │
│ Camina 10-15 minutos para       │
│ ayudar a controlar tu glucosa   │
│                                 │
│ 🕐 08:30 (30min después)        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🩸 Mide tu glucosa              │
│                                 │
│ Han pasado 2 horas desde        │
│ desayuno. Registra tu nivel.    │
│                                 │
│ 🕐 10:00 (2h después)           │
└─────────────────────────────────┘
```

---

## 🎯 VENTAJAS DEL SISTEMA DUAL

```
┌──────────────────────────────────┬──────────────────────────────────┐
│     MEDICINAS ESPECÍFICAS        │    NOTIFICACIONES DIABETES       │
├──────────────────────────────────┼──────────────────────────────────┤
│ ✓ Control preciso por medicina   │ ✓ Rutina completa automatizada   │
│ ✓ Historial individual            │ ✓ Cálculos automáticos           │
│ ✓ Confirmación de toma            │ ✓ Múltiples recordatorios        │
│ ✓ Flexible (agregar/quitar)      │ ✓ Contexto de comidas            │
│ ✓ Backend sincronizado            │ ✓ Local (sin internet)           │
└──────────────────────────────────┴──────────────────────────────────┘
                              │
                              ▼
                    SISTEMA COMPLETO
                    
        ┌─────────────────────────────┐
        │  Control total de diabetes  │
        │                             │
        │  • Medicinas ✓              │
        │  • Comidas ✓                │
        │  • Glucosa ✓                │
        │  • Actividad ✓              │
        │  • Rutina completa ✓        │
        └─────────────────────────────┘
```

---

## 🔐 CONFIGURACIÓN DE PERMISOS

```
┌─────────────────────────────────────────────────────────────┐
│                    AL INSTALAR LA APP                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
    ┌───────────────────────────────────────────┐
    │ ¿Permitir que BienestarApp envíe         │
    │ notificaciones?                           │
    │                                           │
    │        [Permitir]    [No permitir]        │
    └───────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            [Permitir]            [No permitir]
                    │                   │
                    ▼                   ▼
        ✅ Funcionará         ❌ No recibirás notificaciones
           perfectamente
                              
                              
┌─────────────────────────────────────────────────────────────┐
│              SI NO RECIBES NOTIFICACIONES                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
            Configuración → Apps → BienestarApp
                              │
                              ▼
                        Notificaciones
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌───────────────────┐   ┌─────────────────┐
        │ Permitir          │   │ Mostrar en      │
        │ notificaciones ☑  │   │ pantalla de     │
        │                   │   │ bloqueo ☑       │
        └───────────────────┘   └─────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ✅ Listo para usar
```

---

## 📱 INTERFAZ VISUAL (Wireframe)

```
┌─────────────────────────────────────────────────────────────┐
│  ☰  BIENESTAR                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 Perfil de Salud                                         │
│  ═══════════════                                            │
│                                                             │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║  🩺 Herramientas para Diabetes                        ║ │
│  ╠═══════════════════════════════════════════════════════╣ │
│  ║                                                       ║ │
│  ║  ┌─────────────────────────────────────────────────┐ ║ │
│  ║  │ 💊  Medicinas                                   │ ║ │
│  ║  │     Administra tus medicamentos y programa      │ ║ │
│  ║  │     recordatorios                         ›     │ ║ │
│  ║  └─────────────────────────────────────────────────┘ ║ │
│  ║                                                       ║ │
│  ║  ┌─────────────────────────────────────────────────┐ ║ │
│  ║  │ 🔔  Notificaciones de Diabetes                  │ ║ │
│  ║  │     Configura recordatorios de comidas,         │ ║ │
│  ║  │     glucosa y actividad                   ›     │ ║ │
│  ║  └─────────────────────────────────────────────────┘ ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│                                                             │
│  Información del perfil                                     │
│  ─────────────────────                                      │
│  Edad: ...                                                  │
│  Peso: ...                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘


AL PRESIONAR "💊 Medicinas":

┌─────────────────────────────────────────────────────────────┐
│  ← Medicinas                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┬──────┬──────────┐                        │
│  │ Nombre       │ HH:MM│ [Agregar]│                        │
│  └──────────────┴──────┴──────────┘                        │
│                                                             │
│  Medicinas programadas:                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Metformina 850mg (08:00)     [Confirmar]           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Metformina 850mg (14:00)     [Confirmar]           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Metformina 850mg (20:00)     [Confirmar]           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Programar notificaciones]                                 │
│  [Volver]                                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘


AL PRESIONAR "🔔 Notificaciones de Diabetes":

┌─────────────────────────────────────────────────────────────┐
│  ← Configuración para Diabetes                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🍽️ Horarios de comidas                                    │
│  ─────────────────────────                                  │
│  🥞 Desayuno:  [08:00]                                      │
│  🍲 Comida:    [14:00]                                      │
│  🍽️ Cena:      [20:00]                                      │
│                                                             │
│  💊 Medicina pre-comida (opcional)                          │
│  ────────────────────────────────────                       │
│  Si tomas insulina rápida...                                │
│  [Insulina rápida          ]                                │
│                                                             │
│  ⚙️ Recordatorios adicionales                               │
│  ───────────────────────────                                │
│  🩸 Medición de glucosa      ☑                              │
│     2 horas después de cada comida                          │
│                                                             │
│  🚶 Actividad física         ☑                              │
│     30 minutos después de cada comida                       │
│                                                             │
│  [💾 Guardar y activar notificaciones]                      │
│  [🧪 Probar notificación]                                   │
│  [← Volver]                                                 │
│                                                             │
│  ℹ️ Importante:                                             │
│  • Las notificaciones se repiten todos los días             │
│  • Puedes modificar los horarios cuando quieras             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**🎯 TODO LISTO PARA USAR**

**Descarga APK**: https://expo.dev/accounts/camerinojose/projects/bienestarapp-mobile/builds/f7f676b7-da7c-4c15-8185-da3a7f5c71ca
