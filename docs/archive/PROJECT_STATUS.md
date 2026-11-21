# Estado del Proyecto - BienestarApp / WellnessApp
**Última actualización:** 8 de Enero, 2026 - 23:40

## 🗃️ Migración a PostgreSQL (25 Ene 2026)

- Se inició la migración de la base de datos de SQLite a PostgreSQL para producción.
- Se generaron los scripts de creación de tablas en PostgreSQL (`create_tables_postgres.sql`).
- Se exportaron los datos de todas las tablas principales a archivos CSV.
- Se crearon todas las tablas en PostgreSQL exitosamente.
- Se importaron los datos de `users.csv`, `recipes.csv`, `nutritionist_availability.csv`, `deleted_messages.csv`, `health_profiles.csv` sin errores.
- Se detectaron los siguientes problemas durante la importación:
   - ❗ Errores de llave foránea: Algunos registros referencian IDs que no existen en la tabla padre (ej. user_id, appointment_id, etc.).
   - ❗ Errores de codificación: Algunos archivos CSV están en formato WIN1252 y deben convertirse a UTF-8 antes de importar.
   - ❗ Columnas extra: Algunos CSV tienen más columnas que las definidas en la tabla destino.
- Próximos pasos:
   - Convertir todos los CSV problemáticos a UTF-8.
   - Revisar y limpiar los datos para asegurar integridad referencial (IDs válidos en todas las FK).
   - Corregir los archivos CSV con columnas extra para que coincidan con la estructura de la tabla.
- El backend ya puede conectarse a PostgreSQL, pero la migración de datos requiere limpieza adicional antes de estar 100% operativa.


### 🔄 Cambios recientes (8 Ene 2026 - Sesión Tarde)
- **Navegación de Notificaciones:** Al hacer clic en una notificación, el usuario ahora es redirigido a la página correspondiente (citas, mensajes, planes de comida, etc.) según el tipo de notificación (8 tipos soportados)
- **Manejo de Errores Mejorado:** Notificaciones que no pertenecen al usuario (403) o no existen (404) se manejan silenciosamente sin mostrar errores en consola
- **Conectividad API Corregida:** Resuelto problema de CORS cambiando de URLs directas (`http://localhost:8080/api`) a URLs relativas (`/api`) en `api.js` para aprovechar el proxy de Vite
- **Datos de Disponibilidad:** Creado y ejecutado script `backend/seed_availability.sql` para poblar horarios de la nutrióloga ID 8 (lunes a viernes, 6 slots/día: 9-10, 10-11, 11-12, 14-15, 15-16, 16-17)
- **Estabilidad del Sistema:** Backend y frontend reiniciados múltiples veces para reflejar cambios; gestión de procesos Windows mejorada
- **Servidores Activos:** Backend en :8080, Frontend en :5176 (puertos 5174/5175 ocupados)

### 🔄 Cambios recientes (8 Ene 2026 - Sesión Mañana)
- **Selección de Nutrióloga:** Sistema completo para que pacientes elijan su nutrióloga asignada (web + mobile)
- **Reserva de Citas Guiada:** Endpoint `/api/available-slots` para obtener slots disponibles de la nutrióloga asignada; componentes web `ChooseNutritionist.jsx` y `BookAppointment.jsx`; pantalla mobile `NutritionistSelectionScreen.js`
- **Validación de Asignación:** Las citas ahora se crean automáticamente con la nutrióloga asignada (ya no hardcoded a ID 5); usuarios deben asignar nutrióloga antes de reservar
- **API Backend:** Nuevas rutas `/api/nutritionists`, `/api/assign-nutritionist`, `/api/available-slots` (usuario) en lugar de `/nutritionist/available-slots` (nutrióloga-only)
- Notificaciones: recordatorios automáticos 24h antes de la cita y notificación al crear cita; tipos nuevos `appointment` y `appointment_reminder`.
- Planes personalizados: endpoints para que la nutrióloga cree planes de comida por paciente con notificación automática; API frontend añadida.
- Autenticación: botón de Google actualizado con branding oficial (“Continuar con Google”, logo G, borde y sombra estilo Google).

## 📊 Resumen General
Aplicación COMPLETA de seguimiento nutricional con:
- ✅ Backend Go con OAuth Google completamente funcional
- ✅ Frontend Web React 100% implementado
- ✅ Mobile App React Native con 9 pantallas completas + Google OAuth
- ✅ Gemini AI para chat nutricional (mobile + web) - COMPLETADO

### 📝 Nota Importante de Mantenibilidad
**Todos los cambios realizados en Web pueden ser adaptados para Mobile de ser necesario, y viceversa.** La estructura está diseñada para ser escalable:

---

## 🚨 Troubleshooting & Known Errors

For a list of common errors, warnings, and their solutions, see:

- [KNOWN_ERRORS_AND_SOLUTIONS.md](KNOWN_ERRORS_AND_SOLUTIONS.md)

If you encounter a runtime, build, or Expo error, check that file first for step-by-step solutions. Add new issues and fixes as they are discovered.
- Componentes Web (React) y Mobile (React Native) comparten lógica de negocio
- Estilos separados por plataforma (CSS para web, StyleSheet para mobile)
- API calls centralizadas en ambas plataformas
- Idiomas sincronizados (i18n) entre ambas
- Cambios en UX/UI pueden replicarse fácilmente en la otra plataforma

### Stack Tecnológico
- **Backend:** Go 1.25.5, Gin Framework, SQLite (data.db), OAuth integrado
- **Frontend Web:** React 18 + Vite, react-i18next, axios, Chart.js, @google/generative-ai
- **Mobile App:** React Native 0.81.5, Expo 54.0.30 ✅ FUNCIONAL, @google/generative-ai
- **AI:** Google Gemini API ✅ INTEGRADA Y FUNCIONANDO
- **Base de datos:** SQLite con 14 tablas principales
- **Autenticación:** JWT (tokens de 24 horas) + Google OAuth
- **Puertos:** Backend :8080, Frontend :5174, Mobile: Expo

---

## ✅ Funcionalidades Completadas

### 0. Aplicación Móvil (React Native + Expo) 🆕 EN DESARROLLO
- [x] Configuración inicial del proyecto Expo
- [x] Estructura de carpetas mobile/
- [x] Dependencias instaladas:
  - React Native 0.81.5
  - Expo SDK 54.0.30
  - React 19.1.0
  - Axios para API calls
  - i18next para internacionalización
  - AsyncStorage para almacenamiento local

# Project Status

## Current State (as of 2026-01-17)

### Mobile App
- Refactored for modularity and best practices (separated screens/components, improved error handling, modern UI/UX)
- JWT authentication and token storage with AsyncStorage
- Centralized API logic with axios and JWT interceptor
- Robust medicine logic, notifications, and appointment handling
- All major warnings/errors resolved (SafeAreaView, Platform import, property names, etc.)
- Login flow and view state transitions confirmed working (see logs)
- **Expo Go is no longer supported for push notifications and advanced features**
- **Development builds are now required for full functionality**

### Backend
- Go (Gin) API with JWT, SQLite
- Endpoints for authentication, profile, medicines, appointments, etc.
- All endpoints tested and integrated with mobile app

### Deployment
- Render deployment guides and scripts available
- GitHub integration and deployment instructions provided

## Next Steps
- Always use a development build for mobile testing (Expo Go is deprecated for this project)
- Continue excluding Expo Go-specific features and limitations
- Focus on development build workflow for all future mobile work

## How to Create a Development Build (Expo)

1. **Install EAS CLI (Expo Application Services):**
   ```sh
   npm install -g eas-cli
   ```
2. **Login to Expo account:**
   ```sh
   eas login
   ```
3. **Configure EAS for your project:**
   ```sh
   eas build:configure
   ```
   - Follow prompts to set up Android/iOS builds.
4. **Build a development client:**
   ```sh
   eas build --profile development --platform android
   # or for iOS:
   eas build --profile development --platform ios
   ```
5. **Install the build on your device:**
   - Download the .apk (Android) or .ipa (iOS) from the Expo dashboard or build output.
   - Install on your device (for Android, you can use adb or open the .apk directly).
6. **Run your app:**
   - Open the installed development build app on your device.
   - Scan the QR code or use the app as you would in production.

**Note:**
- Development builds support all native modules and push notifications.
- Expo Go is no longer recommended for this project.

---

## Recent Changes
- Added robust logging to login and navigation flows
- Confirmed login and dashboard transitions work as expected
- Updated all medicine and appointment logic for reliability
- Removed Expo Go-specific code and warnings
- Updated documentation for development build workflow

---

*Always refer to this file for the latest project status and workflow instructions.*
  - Búsqueda por nombre
  - Filtros por categoría
  - Modal con detalles completos
  - Información nutricional (macros)
- [x] **Citas (Appointments)** ⭐ MEJORADO
  - **Seleccionar Nutrióloga:** Página "Elegir Nutriólogo" para listar y asignar nutrióloga
    - Lista de nutriólogas disponibles
    - Asignación permanente al usuario (guardada en DB)
    - Validación: se requiere asignar antes de reservar
  - **Reserva de Citas Guiada:** Página "Reservar Cita" con flujo completo
    - Seleccionar fecha
    - Ver slots disponibles de nutrióloga asignada
    - Pre-seleccionar slot para crear cita
    - Redirige a Appointments tras éxito
  - **Quick Scheduler en Appointments:** Panel para seleccionar fecha y slot sin abrir modal
  - Crear citas con nutrióloga asignada
  - Ver citas programadas
  - Estados: scheduled, completed, cancelled
  - Editar y cancelar citas
- [x] **Mensajes** ✅ COMPLETO
  - Chat bidireccional con nutrióloga
  - Lista de conversaciones con avatar y rol
  - Polling automático cada 5 segundos (conversaciones y mensajes)
  - Indicadores de leído/no leído (✓ y ✓✓)
  - Burbujas de chat diferenciadas (propio vs otros)
  - Badges de contador de mensajes no leídos
  - Timestamps relativos (Ahora, Hace Xmin, Hace Xh, fecha)
  - Separadores de fecha en el historial
  - Panel de conversaciones con búsqueda visual
  - Botón para iniciar nueva conversación
  - Interfaz responsive con dos paneles
  - Auto-scroll al cargar nuevos mensajes
  - Marcado automático como leído al cargar
- [x] **Soporte**
  - FAQ con accordion
  - Formulario de contacto
  - Enlaces rápidos
  - Información de contacto
- [x] **Configuración (Settings)**
  - Horarios de comidas
  - Recordatorios de comidas
  - Notificaciones del navegador
  - Internacionalización (ES/EN)

### 3. Panel de Nutrióloga ⭐ ACTUALIZADO
- [x] **Vista de Pacientes**
  - Lista completa de todos los pacientes
  - Información general (email, número de citas)
  - Última fecha de visita
  - Selección de paciente para ver detalles
   - Búsqueda y filtros por estado (activos/inactivos)
  - Panel de detalles completo:
    - Información personal y de salud
    - Última medición (peso, % grasa, % músculo)
    - Historial completo de progreso (tabla)
    - Recomendaciones anteriores
      - Gráfica de progreso (peso, % grasa, % músculo) con Chart.js
  - **Formulario de Nueva Recomendación:**
    - Campo de recomendación general
    - Cambios en la dieta
    - Plan de ejercicio
    - Próximas metas
    - Asociación opcional con cita
   - Exportar reporte TXT del paciente (perfil, historial, recomendaciones)
    
- [x] **Vista de Citas ⭐ MEJORADO**
  - Lista de todas las citas programadas
   - Calendario mensual con indicadores por estado
   - Estadísticas mensuales (total, programadas, completadas, canceladas)
  - Filtros por estado (scheduled, completed, cancelled)
  - Información del paciente en cada cita
  - Fecha y hora
  - Descripción y notas
  - **Botones de acción:**
    - **Proponer Cambio** ⭐ NUEVO - Proponer nueva fecha/hora al paciente
    - Completar cita (con notas)
    - Cancelar cita (con motivo)
  - Badge visual según estado
  
- [x] **CRUD de Recetas**
  - Crear recetas nuevas
  - Editar recetas existentes
  - Eliminar recetas
  - Vista de recetas existentes con grid cards
  - Formulario completo con validación
  
- [x] **Sistema de Disponibilidad** ⭐ NUEVO
  - Configurar horarios disponibles por día
  - Ver slots disponibles para citas
  - Backend con calendario de disponibilidad

- [x] **Planes de comida personalizados** ⭐ NUEVO
   - Crear plan para paciente (nombre, fecha inicio, snacks, comidas por día/tipo)
   - Notificación automática al paciente al crear plan
   - Endpoints dedicados para nutrióloga

### 4. Panel de Administrador
- [x] Gestión de usuarios
- [x] Ver historial de cualquier usuario
- [x] Cambiar roles de usuario
- [x] Eliminar usuarios
- [x] Exportar datos

### 5. Backend - Endpoints REST API

#### Autenticación (Público)
- `POST /api/register` - Registro de usuarios
- `POST /api/login` - Login con JWT

#### Usuario Autenticado
- `GET /api/me` - Obtener perfil
- `POST /api/history` - Crear entrada de historial
- `GET /api/history` - Listar historial
- `POST /api/ocr` - Procesar PDF/imagen OCR
- `POST /api/health-profile` - Crear perfil de salud
- `GET /api/health-profile` - Obtener perfil de salud
- `PUT /api/health-profile` - Actualizar perfil
- `POST /api/meal-plan/upload` - Subir plan de comidas (PDF)
- `GET /api/meal-plan` - Obtener plan actual
- `POST /api/food-log` - Registrar comida completada
- `GET /api/food-log` - Obtener registros de comidas
- `PUT /api/settings` - Actualizar configuración
- `GET /api/settings` - Obtener configuración
- `POST /api/appointments` - Crear cita
- `GET /api/appointments` - Listar citas
- `PUT /api/appointments/:id` - Actualizar cita
- `DELETE /api/appointments/:id` - Eliminar cita
- `GET /api/recipes` - Listar recetas
- `GET /api/recipes/:id` - Obtener receta específica
- `POST /api/messages` - Enviar mensaje
- `GET /api/messages` - Obtener mensajes
- `GET /api/messages/conversations` - Listar conversaciones
- `PUT /api/messages/:id/read` - Marcar como leído
- `GET /api/nutritionists` - Listar nutriólogas disponibles ⭐ NUEVO
- `POST /api/assign-nutritionist` - Asignar nutrióloga al usuario ⭐ NUEVO
- `GET /api/available-slots` - Obtener slots disponibles de nutrióloga asignada ⭐ NUEVO

#### Nutrióloga (Requiere rol `nutritionist` o `admin`) ⭐ NUEVO
- `GET /api/nutritionist/patients` - Listar todos los pacientes
- `GET /api/nutritionist/patients/:id` - Detalles de un paciente
- `GET /api/nutritionist/patients/:id/history` - Historial de un paciente
- `POST /api/nutritionist/patients/:patient_id/meal-plan` - Crear plan personalizado para paciente
- `GET /api/nutritionist/patients/:patient_id/meal-plan` - Obtener plan más reciente del paciente
- `POST /api/nutritionist/recipes` - Crear nueva receta
- `PUT /api/nutritionist/recipes/:id` - Actualizar receta
- `DELETE /api/nutritionist/recipes/:id` - Eliminar receta
- `POST /api/nutritionist/recommendations` - Crear recomendación
- `GET /api/nutritionist/recommendations/:patient_id` - Ver recomendaciones de paciente
- `GET /api/nutritionist/appointments` - Ver todas las citas
- `PUT /api/nutritionist/appointments/:id/notes` - Actualizar notas de cita
- `GET /api/nutritionist/available-slots` - Obtener slots de la nutrióloga autenticada (nutrióloga-only)
- `GET /api/nutritionist/availability` - Ver disponibilidad configurada (nutrióloga-only)
- `POST /api/nutritionist/availability` - Configurar disponibilidad (nutrióloga-only)

#### Admin (Requiere rol `admin`)
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/users/:id/history` - Ver historial de usuario
- `PUT /api/admin/users/:id/role` - Cambiar rol
- `DELETE /api/admin/users/:id` - Eliminar usuario
- `GET /api/admin/export` - Exportar datos

### 6. Base de Datos - Tablas

1. **users** - Usuarios del sistema
   - Campos: id, name, email, password (bcrypt), role, nutritionist_id ⭐
   - nutritionist_id: FK a nutrióloga asignada
   
2. **health_profiles** - Perfiles de salud
   - Datos: edad, sexo, altura, peso, peso objetivo
   - Composición corporal: % grasa, % músculo
   - Info médica: condiciones, medicamentos, alergias
   - Laboratorios: glucosa, HbA1c, colesterol, triglicéridos
   - Estilo de vida: nivel actividad, horario comidas, horas sueño
   
3. **histories** - Historial de mediciones
   - Campos: user_id, date, weight, fat_percentage, muscle_percentage
   
4. **meal_plans** - Planes de comidas
   - Campos: user_id, name, start_date, snacks, created_at
   
5. **plan_meals** - Comidas individuales del plan
   - Campos: plan_id, day_of_week, meal_type, name, ingredients, preparation
   
6. **food_logs** - Registro de comidas completadas
   - Campos: user_id, date, meal_type, completed, notes
   - Constraint UNIQUE: (user_id, date, meal_type)
   
7. **user_settings** - Configuración de usuario
   - Campos: user_id, meal_times (JSON), enable_reminders
   
8. **appointments** - Citas con nutrióloga
   - Campos: user_id, title, description, appointment_date, appointment_time
   - Estado: status (scheduled/completed/cancelled)
   - Notas: notes, created_at
   
9. **recipes** - Catálogo de recetas
   - Info básica: name, category, prep_time, servings
   - Nutrición: calories, protein, carbs, fat
   - Contenido: ingredients, instructions, image_url
   
10. **messages** - Sistema de mensajería
    - Campos: sender_id, recipient_id, content, is_read, created_at
    
11. **recommendations** - Recomendaciones de nutrióloga
    - Campos: nutritionist_id, patient_id, appointment_id
    - Contenido: recommendation_text, diet_changes, exercise_plan, next_goals
    - created_at

12. **appointment_changes** - Propuestas de cambio de cita ⭐ NUEVO
    - Campos: appointment_id, proposed_by, new_date, new_time, reason
    - Estado: status (pending/accepted/rejected)
    - Timestamps: created_at, responded_at
    
13. **notifications** - Notificaciones del sistema ⭐ NUEVO
    - Campos: user_id, type, title, message, related_id
    - is_read, created_at
   - Tipos: appointment_change, appointment_accepted, appointment_rejected, new_message, recommendation, appointment, appointment_reminder, meal_plan
    
14. **nutritionist_availability** - Disponibilidad de nutrióloga ⭐ NUEVO
    - Campos: nutritionist_id, day_of_week, start_time, end_time
    - is_available

### 7. Funcionalidades Técnicas
- [x] Internacionalización (i18n) - Español e Inglés
- [x] Sistema de notificaciones del navegador
- [x] **Sistema de Notificaciones In-App** ⭐ NUEVO
  - Bell icon con contador de no leídas
  - Dropdown con últimas 50 notificaciones
  - Marcar como leída individualmente
  - Marcar todas como leídas
  - Auto-refresh cada 30 segundos
   - Tipos: appointment_change, appointment_accepted, appointment_rejected, new_message, recommendation, appointment, appointment_reminder, meal_plan
- [x] **Gestión Avanzada de Citas** ⭐ NUEVO
  - Propuestas de cambio de cita
  - Aceptar/Rechazar cambios
  - Notificaciones automáticas al proponer/aceptar/rechazar
  - Historial de cambios por cita
   - Recordatorios automáticos 24h antes de la cita
- [x] Recordatorios automáticos de comidas
- [x] Responsive design (mobile-friendly)
- [x] OCR con Tesseract (procesamiento de PDFs médicos)
- [x] Gráficas interactivas con Chart.js
- [x] Sistema de polling para mensajes en tiempo real
- [x] Middleware de autenticación por roles
- [x] CORS configurado
- [x] Validación de datos en backend
- [x] Manejo de errores consistente

---

## 🔧 Archivos Principales

### Backend (Go)
```
backend/
├── main.go (2,426 líneas)
│   ├── Configuración de servidor Gin
│   ├── Middleware de autenticación y roles
│   ├── Todas las rutas y handlers principales
│   └── Funciones de OCR y seed de datos
│
├── nutritionist_handlers.go (442 líneas) ⭐ NUEVO
│   ├── listPatientsHandler
│   ├── getPatientDetailsHandler
│   ├── getPatientHistoryHandler
│   ├── createRecipeHandler
│   ├── updateRecipeHandler
│   ├── deleteRecipeHandler
│   ├── createRecommendationHandler
│   ├── getRecommendationsHandler
│   ├── getNutritionistAppointmentsHandler
│   └── updateAppointmentNotesHandler
│
├── data.db (Base de datos SQLite)
├── app.exe (Ejecutable compilado)
└── uploads/ (Archivos subidos)
```

### Frontend (React)
```
frontend/src/
├── App.jsx (187 líneas)
│   ├── Routing principal
│   ├── Detección de rol de usuario
│   └── Conditional rendering por rol
│
├── NutritionistDashboard.jsx (631 líneas) ⭐ NUEVO
│   ├── Sistema de tabs (Pacientes/Citas/Recetas)
│   ├── Vista de pacientes con detalles
│   ├── Formulario de recomendaciones
│   ├── Gestión de citas
│   └── CRUD completo de recetas
│
├── ChooseNutritionist.jsx ⭐ NUEVO
│   ├── Listar nutriólogas disponibles
│   ├── Seleccionar y asignar nutrióloga
│   └── Refrescar perfil tras asignación
│
├── BookAppointment.jsx ⭐ NUEVO
│   ├── Selector de fecha
│   ├── Visualizar slots disponibles
│   ├── Pre-seleccionar y crear cita
│   └── Redirigir a Appointments tras éxito
│
├── Messages.jsx (321 líneas)
├── Progress.jsx (280 líneas)
├── Achievements.jsx (320 líneas)
├── Recipes.jsx (240 líneas)
├── Support.jsx (170 líneas)
├── Dashboard.jsx
├── MealPlan.jsx
├── Profile.jsx
├── Settings.jsx
├── Appointments.jsx ⭐ MEJORADO (quick scheduler panel)
├── AdminPanel.jsx
├── Login.jsx
├── Register.jsx
├── OCRUpload.jsx
├── Sidebar.jsx ⭐ ACTUALIZADO (nuevas opciones de menú)
│
├── api.js ⭐ ACTUALIZADO
│   ├── listNutritionists ⭐ NUEVO
│   ├── assignNutritionist ⭐ NUEVO
│   ├── getAvailableSlots ⭐ NUEVO (usa /api/available-slots)
│   ├── getPatients
│   ├── getPatientDetails
│   ├── getPatientHistory
│   ├── getNutritionistAppointments
│   ├── updateAppointmentNotes
│   ├── createRecommendation
│   ├── getRecommendations
│   ├── createRecipe
│   ├── updateRecipe
│   └── deleteRecipe
│
├── auth.js
├── i18n.js
├── notifications.js
│
└── Estilos CSS:
    ├── styles.css (principal)
    ├── nutritionist.css (730 líneas)
    ├── bookings.css ⭐ NUEVO
    ├── messages.css (483 líneas)
    ├── progress.css (280 líneas)
    ├── achievements.css (260 líneas)
    ├── recipes.css (560 líneas)
    ├── support.css (240 líneas)
    ├── mealplan.css
    ├── admin.css
    └── otros...
```

---

## 👥 Usuarios de Prueba

### Usuario Regular (Paciente)
- **Email:** test@test.com
- **Password:** test123
- **Rol:** user
- **Permisos:** Acceso a todas las funciones de paciente

### Usuario Camerino (Paciente con Cita Pendiente) ⭐
- **Email:** Camerinojose@gmail.com
- **Password:** 123456789
- **Rol:** user
- **Nota:** Este usuario tiene una propuesta de cambio de cita pendiente para probar el sistema

### Nutrióloga ⭐ NUEVO
- **Email:** nutriologa@bien.com
- **Password:** demo123
- **Rol:** nutritionist
- **Permisos:** 
  - Todo lo de usuario regular
  - Panel de Nutrióloga completo
  - Ver todos los pacientes
  - Crear/editar/eliminar recetas
  - Crear recomendaciones
  - Gestionar citas
  - Proponer cambios de cita

### Administrador
- **Email:** admin@admin.com
- **Password:** admin123
- **Rol:** admin
- **Permisos:** Acceso total al sistema + panel admin

---

## 🚧 Pendientes / Mejoras Futuras

### Funcionalidades NO Implementadas
- [ ] **Productos** - Catálogo de productos recomendados
  - Tienda virtual
  - Suplementos nutricionales
  - Equipamiento fitness
  - Sistema de recomendaciones personalizadas

### Mejoras Propuestas
  - Bell icon con contador
  - Dropdown con notificaciones recientes
  - Marcadores de leído/no leído
  
  - Estadísticas generales (total pacientes activos, citas del día)
  - Gráficas de progreso general
  - Alertas de pacientes que requieren atención
  - Calendario visual para citas
  
  - Integración con servicio de video
  - Citas virtuales
  - Grabación de sesiones (opcional)
  
  - Generar PDF con reporte de progreso
  - Comparativas mensuales
  - Exportar datos a Excel
  
  - Sistema de puntos
  - Niveles de usuario
  - Desafíos semanales
  - Tabla de clasificación (leaderboard)
  
  - Fitbit / Apple Health
  - Google Fit
  - Balanzas inteligentes
  
  - Autenticación de 2 factores (2FA)
  - Recuperación de contraseña por email
  - Límite de intentos de login
  - Sesiones concurrentes controladas

- [ ] **IA para Análisis Nutricional de Imágenes**
   - Permitir al usuario tomar o subir una foto de su comida
   - Analizar la imagen usando IA para estimar calorías, macronutrientes y tipo de alimento
   - Mostrar información nutricional estimada y recomendaciones
   - Integrar resultados al registro de comidas del usuario

- [ ] **Registro Integral del Paciente (Onboarding Mejorado)**
   - Formulario inicial completo para nuevos pacientes
   - Recopilar historial médico, enfermedades, medicamentos, alergias y preferencias alimenticias
   - Permitir registrar gustos y restricciones para personalizar la dieta
   - Visualización y edición del perfil completo del paciente
   - Validaciones y experiencia de usuario mejorada

---

## 🐛 Problemas Conocidos y Soluciones

### 1. ✅ RESUELTO: Error SQL en getConversationsHandler
**Problema:** "SQL logic error: no such column: other_user_id"
**Causa:** SQLite no permite referenciar aliases de columnas en subqueries dentro del mismo SELECT
**Solución:** Simplificada la query para usar DISTINCT sin subqueries complejos
**Estado:** Funcionando correctamente

### 2. ✅ RESUELTO: Port 5173 en uso
**Problema:** Vite no podía iniciar en puerto 5173
**Solución:** Vite automáticamente cambió a puerto 5174
**Estado:** Frontend corriendo en :5174

---

## 🚀 Cómo Ejecutar el Proyecto

### Prerequisitos
- Go 1.25+ instalado
- Node.js 18+ instalado
- Tesseract OCR instalado (para función de OCR)

### Backend
```bash
cd backend
go build -o app.exe
./app.exe
# Servidor corriendo en http://localhost:8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Aplicación corriendo en http://localhost:5174
```

### Acceso
1. Abrir navegador en `http://localhost:5174`
2. Login con uno de los usuarios de prueba
3. Si es nutrióloga/admin, verás automáticamente el Dashboard de Nutrióloga
4. Si es usuario regular, verás el Dashboard de paciente

---

## 📝 Notas de Desarrollo

### Convenciones de Código
- **Backend:** CamelCase para funciones, snake_case para DB
- **Frontend:** PascalCase para componentes, camelCase para funciones
- **CSS:** BEM-style naming donde sea posible
- **API:** RESTful conventions

### Estructura de Commits Recomendada
```
feat: nueva funcionalidad
fix: corrección de bug
style: cambios de CSS/diseño
refactor: refactorización de código
docs: cambios en documentación
test: pruebas
```

### Variables de Entorno
El sistema usa fallbacks para desarrollo, pero en producción configurar:
- `JWT_SECRET` - Clave secreta para tokens JWT
- `GIN_MODE=release` - Modo de producción para Gin

---

## 🎯 Próximos Pasos Sugeridos

1. **Productos** (Feature pendiente)
   - Definir estructura de tabla `products`
   - Endpoint de catálogo
   - Vista de productos en frontend
   - Sistema de recomendaciones basado en perfil

2. **Sistema de Notificaciones Mejorado**
   - Notificaciones in-app persistentes
   - Backend con SSE o WebSockets
   - Notificaciones push real-time

3. **Testing**
   - Unit tests para backend handlers
   - Integration tests para API
   - E2E tests con Cypress/Playwright

4. **Deployment**
   - Dockerización
   - CI/CD pipeline
   - Hosting en cloud (AWS/GCP/Azure)
   - Base de datos en producción (PostgreSQL)

5. **Seguridad**
   - Rate limiting
   - Input sanitization
   - HTTPS en producción
   - Backup automático de DB

---

## 📊 Métricas del Proyecto

- **Total líneas de código Backend:** ~3,000+
- **Total líneas de código Frontend:** ~4,500+
- **Total líneas CSS:** ~3,500+
- **Endpoints API:** 45+
- **Componentes React:** 18
- **Tablas de Base de Datos:** 11
- **Idiomas soportados:** 2 (ES, EN)
- **Tiempo de desarrollo:** ~8 sesiones

---

## 🔄 Historial de Cambios

### Sesión 1-5: Funcionalidades Base
- Sistema de autenticación
- Perfiles y dashboard
- OCR y meal plans
- Admin panel
- Configuración y settings

### Sesión 6-7: Funcionalidades Avanzadas
- Progress con gráficas
- Sistema de Achievements
- Catálogo de Recipes
- Support y FAQ
- Sistema de Messages

### Sesión 8: Panel de Nutrióloga ⭐
- Tabla de recommendations
- Middleware nutritionistOrAdminMiddleware
- 10 nuevos endpoints para nutrióloga
- Componente NutritionistDashboard completo
- Vista de pacientes con detalles
- CRUD completo de recetas
- Sistema de recomendaciones post-cita
- Gestión avanzada de citas
- Usuario de prueba nutri@test.com creado
- Routing condicional por rol

### Sesión 9: Aplicación Móvil 🆕 (1 Enero 2026)
- Inicialización proyecto React Native con Expo
- Configuración de dependencias móviles
- Creación de todas las pantallas principales (9 screens)
- Servicios de API y autenticación
- Soporte de internacionalización (ES/EN)
- Configuración Android para Studio
- Actualización a Gradle 8.13
- Configuración de Android SDK 36
- Estructura de carpetas y archivos mobile/
- ✅ **Resuelto:** Error de icono en app.json
- ✅ **Resuelto:** Error de SDK path en local.properties
- ✅ **Completado:** Expo prebuild exitoso
- ✅ **Completado:** Build de APK debug exitoso
- ✅ **Creado:** Plantillas SVG de iconos de app (icon-template.svg)
- ✅ **Convertido:** SVG a PNG (icon-template.png - 51KB)
- ✅ **Creado:** Guía de conversión de iconos
- ✅ **Instalado:** APK en dispositivo físico (adb install)
- 📱 **App lista para:** Testing y desarrollo en dispositivo real

### 2026-01-25 Backend Refactor & Nutritionist Endpoint Stubs

- Refactored main.go to fix duplicate API and auth group initializations.
- Moved medicines CRUD endpoints inside the authenticated group.
- Ensured proper initialization order for jwtKey and db.
- Cleaned up redundant variable declarations in main().
- Added stub handler functions for all nutritionist endpoints to allow backend compilation:
    - listPatientsHandler
    - getPatientDetailsHandler
    - getPatientHistoryHandler
    - createRecipeHandler
    - updateRecipeHandler
    - deleteRecipeHandler
    - createRecommendationHandler
    - getRecommendationsHandler
    - getNutritionistAppointmentsHandler
    - updateAppointmentNotesHandler
    - proposeAppointmentChangeHandler
    - getNutritionistAvailabilityHandler
    - setNutritionistAvailabilityHandler
    - getAvailableSlotsHandler
    - createMealPlanForPatientHandler
    - getPatientMealPlanHandler
- All stub handlers currently return a JSON message indicating they are not implemented.
- Project now compiles and runs; further implementation needed for nutritionist features.

---

## 🔧 Estado Actual: Configuración Android Studio

### ✅ Problemas Resueltos en Sesión 9

#### 1. **Error de Icono en app.json** ✅ RESUELTO
- **Problema:** app.json referenciaba `../../Logo para BIENESTAR .png` que no existía
- **Causa:** Ruta incorrecta al archivo de logo/icono
- **Solución:** 
  - Removido icono temporalmente (se puede agregar después)
  - Configurado adaptiveIcon con backgroundColor
  - app.json actualizado correctamente
- **Estado:** ✅ Expo prebuild completado exitosamente

#### 2. **Error de SDK Path** ✅ RESUELTO  
- **Problema:** Gradle no encontraba Android SDK después de prebuild
- **Mensaje de error:** "SDK location not found"
- **Causa:** Prebuild limpia local.properties, necesita ANDROID_HOME env var
- **Solución:** Configurar variable de entorno ANDROID_HOME antes de build
  - `export ANDROID_HOME="C:/Users/camer/AppData/Local/Android/Sdk"`
  - Luego ejecutar `./gradlew.bat assembleDebug`
- **Estado:** ✅ Gradle ahora reconoce el SDK correctamente

#### 3. **Login Screen No Visible** ✅ RESUELTO
- **Problema:** App mostraba solo página principal pero sin botones de login visibles
- **Causa:** Traducciones incompletas en locale files (solo had 2 keys)
- **Soluciones aplicadas:**
  - ✅ Actualizado `en.json` con todas las claves necesarias
  - ✅ Actualizado `es.json` con traducciones completas
  - ✅ Mejorado UI de botones con TouchableOpacity (más visibles)
  - ✅ Agregados estilos CSS para:
    - Botón primario verde (#4CAF50)
    - Botón secundario con outline
    - Botón Google azul (#4285F4)
    - Formularios con mejor padding y shadow
  - ✅ Agregadas placeholders en TextInputs
  - ✅ Mejorada estructura visual de login/register
- **Resultado:** Login screen ahora 100% visible y funcional
- **Estado:** ✅ Reinstalado en dispositivo con mejoras

### Configuración Actual (Verificada y Funcionando)
- **Gradle Version:** 8.13 ✅
- **Android Gradle Plugin:** Compatible ✅
- **Build Tools:** 36.0.0 ✅
- **Compile SDK:** 36 ✅
- **Target SDK:** 36 ✅
- **Min SDK:** 24 ✅
- **NDK Version:** 27.1.12297006 ✅
- **Kotlin:** 2.1.20 ✅
- **KSP:** 2.1.20-2.0.1 ✅
- **SDK Location:** C:\Users\camer\AppData\Local\Android\Sdk ✅
- **JDK:** 17.0.13 (Microsoft) ✅

### Estado del Build
- ✅ **Expo prebuild:** Completado exitosamente
- ✅ **Gradle assembleDebug:** Completado exitosamente (105 MB APK)
- ✅ **APK generado:** app-debug.apk con iconos personalizados
- ✅ **APK instalado:** Instalado exitosamente en dispositivo físico
- ✅ **Fixes aplicados:** Login screen, UI mejorada, traducciones completas
- 📱 **Dispositivo:** Conectado vía ADB, app lista para usar
- 🎯 **Resultado:** BienestarApp funcionando con login visible

### Iconos de Aplicación 🎨
- ✅ **Logo_p_bienestar.png:** Logo oficial de BienestarApp (2.1 MB, 1536x1024)
- ✅ **App Icon:** Logo oficial configurado como icono de app
- ✅ **Header Logo:** Logo oficial en header de la app
- ✅ **Splash Screen:** Logo oficial en pantalla de carga
- ✅ **app.json:** Configurado con logo oficial
- **Diseño:**
  - Logo profesional de BienestarApp
  - Fondo blanco para mejor contraste
  - Usado en toda la aplicación móvil

### Próximos Pasos
1. ✅ Completar build de APK debug
2. ✅ Crear plantillas de iconos SVG
3. ✅ Convertir SVG a PNG (icon-template.png)
4. ✅ Configurar app.json con iconos
5. ⏳ Finalizar build con iconos incluidos
6. ⏭️ Abrir proyecto en Android Studio
7. ⏭️ Probar app en emulador o dispositivo físico
8. ⏭️ Implementar pantallas restantes
9. ⏭️ Conectar con API del backend

### Comando de Build Recomendado
```bash
cd mobile/android
export ANDROID_HOME="C:/Users/camer/AppData/Local/Android/Sdk"
./gradlew.bat assembleDebug
```
3:15
**Estado del sistema:** 
- ✅ Backend Web: Totalmente funcional, corriendo en :8080
- ✅ Frontend Web: Totalmente funcional, corriendo en :5174
- 🚧 Mobile App: En desarrollo, configurando Android Studio
**Base de datos:** ✅ Migrada y con datos de prueba

<!-- Dummy push: no functional changes, just to trigger redeploy -->
