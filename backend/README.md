# BienestarApp - Backend (Go)

API REST en Go (Gin) con autenticación JWT y PostgreSQL para el seguimiento de composición corporal.

## Inicio Rápido

### Requisitos Previos
- Go 1.24.1+ instalado

### Instalación y Ejecución

```bash
# Descargar dependencias
go mod tidy

# Ejecutar el servidor con una clave aleatoria de al menos 32 bytes
export JWT_SECRET="$(openssl rand -base64 32)"
go run .
```

El servidor iniciará en `http://localhost:8080`

## Configuración

### Variables de Entorno

La aplicación requiere una variable de entorno `JWT_SECRET` de al menos 32
bytes para firmar tokens JWT. No arranca si falta o es demasiado corta:

```bash
export JWT_SECRET="$(openssl rand -base64 32)"
go run .
```

Genera un valor único y aleatorio para cada entorno; no reutilices una clave de
desarrollo ni publiques el valor. Render debe conservar su valor generado.

### Chat de soporte

Configura `SUPPORT_EMAIL` en el entorno del backend con el correo de una cuenta
existente con rol `admin`. Si no está configurado o la cuenta no es
administradora, el chat de soporte no está disponible. El rol administrativo no
concede acceso automático a historiales clínicos; soporte ve los mensajes
directos enviados explícitamente a esa cuenta.

### Gemini

Configura `GEMINI_API_KEY` únicamente en el entorno del backend. Los chats web y
móvil envían sus mensajes al endpoint autenticado `/api/gemini/chat`; la clave no
debe incluirse en `app.json`, variables `EXPO_PUBLIC_*` ni en el bundle del cliente.
`GEMINI_MODEL` es opcional y por defecto usa `gemini-2.5-pro`.

Si Google rechaza una solicitud, el registro del servidor indica su código HTTP
y, cuando es reconocido, un motivo predefinido, sin registrar la clave ni el
contenido de la respuesta.

### Google OAuth

Configura `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` en el backend.
Registra en Google Cloud la URL de callback del backend:
`https://<dominio-api>/api/auth/google/callback`. El backend construye esta URL
dinámicamente usando el host y protocolo del proxy.

El inicio de sesión móvil usa la redirección OAuth; no existe una ruta pública
para consultar el último token. Las versiones antiguas que dependían de esa
alternativa pueden necesitar actualizarse.

### CORS (Web / ngrok)

Por defecto, el backend permite orígenes locales de desarrollo (Vite) y el dominio web de Render.

Si vas a usar un dominio de **ngrok** o un frontend con otro dominio, agrega orígenes extra:

```bash
# ejemplo con ngrok
CORS_ALLOWED_ORIGINS="https://TU-DOMINIO.ngrok.app" go run .
```

Para desarrollo rápido (no recomendado en producción):

```bash
CORS_ALLOW_ALL=1 go run .
```

## Base de Datos

En Render, el backend necesita que el servicio tenga configuradas las variables
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST` y
`POSTGRES_SSLMODE=require` para conectarse a la base PostgreSQL existente. El
blueprint de `render.yaml` no crea una base de datos.

// ...existing code...
- **Tablas**: `users` y `histories`

## Notas de Seguridad

- Las contraseñas se hashean con bcrypt
- En producción, **DEBE** configurarse `JWT_SECRET`
- CORS habilitado para localhost:5173
