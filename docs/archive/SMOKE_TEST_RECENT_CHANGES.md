# 🧪 Smoke Test (Cambios Recientes)

Objetivo: validar rápido que lo recién agregado funciona end-to-end (web + mobile + backend) sin romper nada.

## 0) Preflight (1 minuto)

### Tests automatizados

```bash
# Backend
cd backend && go test ./...

# Frontend
cd frontend && npm test -- --run
```

> Nota: los tests de `mobile` actualmente no están confiables (hay suites fallando de otros módulos). Para mobile, usa este smoke test manual.

---

## 1) Levantar el stack local

### Backend (Windows)

Opción rápida:

```bat
start-backend.bat
```

Verifica:

```bash
curl http://localhost:8080/api/health
```

Debe responder `{"status":"healthy"}`.

Si el login falla con cuentas de prueba (por ejemplo `user@test.com` / `password123`):
- Detén el backend.
- Borra `backend/data.db`.
- Inicia el backend de nuevo para que recree tablas y usuarios de prueba.

### Frontend (web)

```bash
cd frontend
npm run dev
```

Abre: `http://localhost:5174/`

### Mobile (Expo)

```bash
cd mobile
npx expo start -c
```

#### Backend local desde Android emulator vs teléfono
El mobile usa `EXPO_PUBLIC_API_URL` para decidir a qué backend pegarle.

- **Android Emulator:** usa `http://10.0.2.2:8080` (es el “localhost” de tu PC visto desde el emulador).
- **Teléfono físico:** usa `http://TU_IP_DE_LA_PC:8080` (misma red Wi‑Fi).

Ejemplo (emulador) en `mobile/.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080
```

#### Importante sobre notificaciones (Expo SDK 53+)
- Para probar notificaciones (sobre todo en Android), usa **Dev Client** (no Expo Go).
- Si ya tienes dev client instalado en el emulador:
  - abre la app del dev client y conéctala al Metro.

---

## 2) Smoke test – Web (5–7 minutos)

### A) Perfil de Salud (dropdowns + checklist)
1. Login como paciente (`user@test.com` / `password123`).
2. Abre Perfil de Salud.
3. Verifica:
   - `Sexo` dropdown funciona.
   - `Nivel de actividad` dropdown funciona.
   - `Horario de comidas` dropdown funciona.
   - Si eliges “Otro (especificar)”, aparece textarea y al guardar se guarda el texto.
   - `Condiciones médicas` checklist: puedes marcar varias.
   - `Ninguna` es excluyente (si la marcas, desmarca las otras).
   - `Alergias` checklist igual + “Otras alergias/detalles”.
4. Guardar.
5. Recargar página y confirmar que se rehidrata bien.

---

## 3) Smoke test – Mobile (8–12 minutos)

### A) Registro de Salud del Paciente (dropdowns + checklist)
1. Abre la pantalla de Perfil.
2. Entra a “Registro de Salud del Paciente”.
3. Verifica:
   - `Sexo` dropdown (Picker) funciona.
   - `Nivel de actividad` dropdown funciona.
   - `Horario de comidas` dropdown funciona.
   - Si eliges “Otro (especificar)”, aparece el campo para escribir y al guardar se guarda como texto.
   - `Condiciones médicas` y `Alergias` funcionan como selección múltiple.
   - `Ninguna` es excluyente.
4. Guardar y volver a abrir para confirmar persistencia (según tu flujo actual de ProfileScreen).

### B) Mi Dieta / Recordatorios
1. En “Mi Dieta”, abre ⚙️ ajustes (si aplica).
2. Cambia horarios de desayuno/comida/cena.
3. Cambia offsets (medicina antes/después y/o diabetes si lo configuraste).
4. Guarda y confirma que:
   - se mantiene tras recargar.
   - si el backend está activo y autenticado, que se sincroniza entre pantallas (ej. medicinas/meal plan).

### C) Notificaciones (si estás en Dev Client)
1. Otorga permisos.
2. Usa los botones de “Programar notificaciones…”
3. Verifica en Android:
   - que aparecen notificaciones programadas.
   - que reprogramar no duplica en exceso (debería cancelar solo el scope).

### D) Medicinas ligadas a comida
1. En Medicinas, crea una medicina “Ligada a comida”.
2. Cambia el offset.
3. Verifica que el tiempo calculado cambia según horarios de comida.

### E) PDF en plan de comidas
1. En Mi Dieta, intenta subir un PDF.
2. Confirma que se selecciona y se envía.

---

## 4) Si algo falla: datos útiles para debug
- Screenshot del error.
- Logs de Metro (terminal donde corre `expo start`).
- Logs del backend (terminal del `start-backend.bat`).
- Si es notificaciones: confirmar si estás en Expo Go o Dev Client.
