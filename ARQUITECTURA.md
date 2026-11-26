# 🏗️ ARQUITECTURA DEL PROYECTO

## Dirección multifuncional de producto

BienestarApp se organiza como una plataforma de salud con módulos compartidos
por cuenta: perfil médico, contacto, alimentación, medicinas, indicadores,
progreso, citas, mensajes, reportes y recordatorios. Android y web usan el
mismo backend PostgreSQL; la información clínica debe mantenerse separada por
usuario y disponibilidad profesional controlada por roles.

Gemini es una asistencia informativa. No sustituye diagnóstico, dosis,
decisiones médicas ni atención profesional.

## Pruebas y continuidad

El repositorio incluye pruebas unitarias, integración PostgreSQL, Playwright,
Maestro y un modo de pruebas dentro de móvil/web. Cualquier conversación futura
debe comenzar por `TAREAS_PENDIENTES.md`, revisar el estado de CI y seguir el
orden maestro sin marcar tareas como completadas por implementaciones propuestas.

## Revisión automática

GitHub Actions ejecuta `go vet`, las pruebas y la compilación del backend,
las pruebas y compilación web, y las pruebas móviles en cada pull request y
push a `main`. La prueba de PostgreSQL usa una base temporal con credenciales
de prueba, sin acceder a datos reales. Los resultados aparecen en **Actions**.
Las ejecuciones consumen minutos de GitHub Actions según el plan disponible.

```
BienestarApp/
│
├── 📁 backend/ ✅ COMPLETO
│   ├── main.go                          (Servidor Gin)
│   ├── oauth_handlers.go                (Google OAuth)
│   ├── nutritionist_handlers.go         (Endpoints nutricionista)
│   ├── data.db                          (SQLite)
│   └── README.md
│
├── 📁 frontend/ ✅ COMPLETO (+ Gemini pendiente)
│   ├── src/
│   │   ├── App.jsx                      (Componente principal)
│   │   ├── Login.jsx                    (Autenticación)
│   │   ├── Dashboard.jsx                (Panel principal)
│   │   ├── MealPlan.jsx                 (Plan de comidas)
│   │   ├── Progress.jsx                 (Gráficas)
│   │   ├── Recipes.jsx                  (Catálogo de recetas)
│   │   ├── Achievements.jsx             (Badges/Logros)
│   │   ├── Appointments.jsx             (Gestión de citas)
│   │   ├── Messages.jsx                 (Chat)
│   │   ├── Settings.jsx                 (Configuración)
│   │   ├── Support.jsx                  (FAQ)
│   │   ├── GeminiChat.jsx               (🚧 PENDIENTE)
│   │   ├── api.js                       (Cliente HTTP)
│   │   ├── auth.js                      (Gestión de tokens)
│   │   └── i18n.js                      (Multiidioma)
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── 📁 mobile/ ✅ COMPLETO (+ Gemini pendiente)
│   ├── src/
│   │   ├── App.js                       (Componente principal)
│   │   ├── DashboardScreen.js           (Panel)
│   │   ├── MealPlanScreen.js            (Comidas)
│   │   ├── ProgressScreen.js            (Progreso)
│   │   ├── RecipesScreen.js             (Recetas)
│   │   ├── AchievementsScreen.js        (Logros)
│   │   ├── AppointmentsScreen.js        (Citas)
│   │   ├── MessagesScreen.js            (Mensajes)
│   │   ├── SettingsScreen.js            (Configuración)
│   │   ├── SupportScreen.js             (Soporte)
│   │   ├── GeminiChatScreen.js          (🚧 PENDIENTE)
│   │   ├── api.js                       (Cliente HTTP)
│   │   ├── auth.js                      (JWT Storage)
│   │   ├── i18n.js                      (Multiidioma)
│   │   └── locales/                     (Traducciones)
│   ├── android/                         (Configuración Android)
│   ├── package.json
│   ├── app.json
│   └── README.md
│
├── 📄 PROJECT_STATUS.md                 (Este archivo actualizado)
├── 📄 TAREAS_PENDIENTES.md              (Lista de TODOs)
├── 📄 ARQUITECTURA.md                   (Este archivo)
├── 📄 package.json                      (Root)
└── 📄 README.md

```

---

## 🔄 FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────┐
│              USUARIO (Mobile / Web)                     │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │   Frontend/     │
        │   Mobile App    │
        └────────┬────────┘
                 │
         ┌───────▼────────┐
         │   axios/API    │
         │   (JWT Token)  │
         └───────┬────────┘
                 │
    ┌────────────▼──────────────┐
    │   Backend (Go + Gin)      │
    │  - Auth Handler           │
    │  - API Endpoints          │
    │  - OAuth Google           │
    └────────────┬──────────────┘
                 │
       ┌─────────▼──────────┐
       │   SQLite DB        │
       │  (data.db)         │
       └────────────────────┘

    ┌─────────────────────┐
    │  Google OAuth       │
    │  Gemini AI (pronto) │
    └─────────────────────┘
```

---

## 📱 PANTALLAS POR MÓDULO

### Mobile App (9 + 1 pendiente)
| Pantalla | Estado | Componente |
|----------|--------|-----------|
| Dashboard | ✅ | DashboardScreen.js |
| Meal Plan | ✅ | MealPlanScreen.js |
| Progress | ✅ | ProgressScreen.js |
| Recipes | ✅ | RecipesScreen.js |
| Achievements | ✅ | AchievementsScreen.js |
| Appointments | ✅ | AppointmentsScreen.js |
| Messages | ✅ | MessagesScreen.js |
| Settings | ✅ | SettingsScreen.js |
| Support | ✅ | SupportScreen.js |
| Gemini Chat | 🚧 | GeminiChatScreen.js |

### Web (10 + 1 pendiente)
| Página | Estado | Componente |
|--------|--------|-----------|
| Dashboard | ✅ | Dashboard.jsx |
| Meal Plan | ✅ | MealPlan.jsx |
| Progress | ✅ | Progress.jsx |
| Recipes | ✅ | Recipes.jsx |
| Achievements | ✅ | Achievements.jsx |
| Appointments | ✅ | Appointments.jsx |
| Messages | ✅ | Messages.jsx |
| Settings | ✅ | Settings.jsx |
| Support | ✅ | Support.jsx |
| Profile | ✅ | Profile.jsx |
| Gemini Chat | 🚧 | GeminiChat.jsx |

---

## 🔐 AUTENTICACIÓN

```
Usuario
  │
  ├─ Email/Password ────→ Backend JWT ────→ Stored (AsyncStorage/LocalStorage)
  │
  └─ Google OAuth ────→ Browser ────→ Backend ────→ JWT Token
                        (WebBrowser API)

Cada request:
  Authorization: Bearer <JWT_TOKEN>
```

---

## 📦 DEPENDENCIAS PRINCIPALES

### Backend
- `gin` - Framework HTTP
- `sqlite` - Base de datos
- `jwt` - Autenticación

### Frontend Web
- `react` - UI Framework
- `vite` - Build tool
- `axios` - HTTP Client
- `react-i18next` - Internacionalización
- `chart.js` - Gráficas
- Gemini mediante el endpoint autenticado del backend

### Mobile
- `react-native` - Framework móvil
- `expo` - Plataforma
- `axios` - HTTP Client
- `async-storage` - Local storage
- `expo-web-browser` - OAuth
- Gemini mediante el endpoint autenticado del backend

---

## 🌐 ENDPOINTS PRINCIPALES

### Autenticación
```
POST   /register              (Crear cuenta)
POST   /login                 (Login email/password)
GET    /me                    (Perfil actual)
POST   /auth/logout           (Logout)

GET    /auth/google           (Google OAuth init)
GET    /auth/google/callback  (Google OAuth callback)
GET    /auth/google/success   (OAuth success page)
```

### Datos del Usuario
```
GET    /profile               (Perfil completo)
PUT    /profile               (Actualizar perfil)
GET    /history               (Historial de peso)
POST   /history               (Agregar medición)
```

### Meal Plan
```
GET    /meal-plan             (Plan semanal)
POST   /meal-plan/upload      (Subir PDF)
GET    /recipes               (Todas las recetas)
```

### Citas
```
GET    /appointments          (Listar citas)
POST   /appointments          (Crear cita)
PUT    /appointments/:id      (Editar cita)
DELETE /appointments/:id      (Cancelar cita)
```

### Mensajes
```
GET    /messages              (Chat history)
POST   /messages              (Enviar mensaje)
GET    /messages/conversations (Lista de chats)
```

### Gemini
```
POST   /gemini/chat           (Enviar mensaje; requiere JWT)
```

---

## 🎨 ESTRUCTURA DE CARPETAS RECOMENDADA

```
frontend/
├── src/
│   ├── components/          (Componentes reutilizables)
│   ├── pages/               (Páginas principales)
│   ├── styles/              (CSS)
│   ├── api.js               (HTTP client)
│   ├── auth.js              (Auth logic)
│   └── App.jsx

mobile/
├── src/
│   ├── screens/             (Cada pantalla)
│   ├── api.js
│   ├── auth.js
│   └── i18n.js

backend/
├── handlers/                (Controladores)
├── middleware/              (Middleware)
├── models/                  (Structs)
└── main.go
```

---

## 🚀 CÓMO EJECUTAR TODO

### 1. Backend
```bash
cd backend
go run main.go
# Escucha en :8080
```

### 2. Frontend Web
```bash
cd frontend
npm install
npm run dev
# Abre http://localhost:5174
```

### 3. Mobile (Local)
```bash
cd mobile
npm install
npm start
# Escanea QR con Expo Go
```

### 4. Mobile (Android APK)
```bash
cd mobile/android
./gradlew assembleDebug
# APK en: app/build/outputs/apk/debug/app-debug.apk
```

---

## 📊 ESTADO ACTUAL

| Componente | Líneas de Código | Status |
|-----------|-----------------|--------|
| Backend | ~1500 | ✅ Completo |
| Frontend | ~5000 | ✅ + Gemini |
| Mobile | ~3000 | ✅ + Gemini |
| **Total** | **~9500** | **95%** |

---

## 🎯 PRÓXIMA FASE

**Gemini AI Integration:**
1. Obtener API Key (2 min)
2. Implementar en mobile (1-2h)
3. Implementar en web (1-2h)
4. Testing (1h)
5. Deploy (1h)

**Total:** ~6-7 horas desde que tenemos la API Key ⚡
