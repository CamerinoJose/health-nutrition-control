# Health & Nutrition Control

App para personas con TDAH que siguen el plan de su nutriólogo. Monorepo:

- `backend/` — API en Go (`main.go`, `nutritionist_handlers.go`, `oauth_handlers.go`), SQLite local / Postgres en producción.
- `frontend/` — Web en React + Vite.
- `mobile/` — App React Native (Expo).

## Comandos

- Backend: `cd backend && go run .` · tests: `go test ./...`
- Frontend: `cd frontend && npm run dev` · tests: `npm test`
- Mobile: `cd mobile && npm start` · tests: `npm test`

## Reglas para agentes

- Haz cambios mínimos y enfocados; no reescribas archivos completos.
- No leas `docs/archive/` salvo que la tarea lo pida; es historial y está desactualizado. Usa `ARQUITECTURA.md` y `TAREAS_PENDIENTES.md` como contexto.
- Nunca hagas commit de datos de usuarios: `*.csv`, `*.db`, `*.log`, `.env`, keystores, PDFs o fotos. Son datos de salud.
- Secretos (OAuth, claves) solo por variables de entorno; usa los `.env.example`.
- Antes de dar algo por terminado, corre los tests del paquete tocado.
