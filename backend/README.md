# BienestarApp - Backend (Go)

API REST en Go (Gin) con autenticación JWT y PostgreSQL para el seguimiento de composición corporal.

## Inicio Rápido

### Requisitos Previos
- Go 1.20+ instalado

### Instalación y Ejecución

```bash
# Descargar dependencias
go mod tidy

# Ejecutar el servidor (desarrollo con clave JWT por defecto)
go run .

# Ejecutar con JWT_SECRET personalizada (recomendado en producción)
JWT_SECRET="tu-clave-secreta-fuerte-aqui" go run .
```

El servidor iniciará en `http://localhost:8080`

## Configuración

### Variables de Entorno

La aplicación lee la variable de entorno `JWT_SECRET` para firmar tokens JWT:

```bash
export JWT_SECRET="tu-clave-secreta-muy-fuerte-aqui"
go run .
```

Si no se configura, usará una clave de desarrollo (mostrará un warning).

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

// ...existing code...
- **Tablas**: `users` y `histories`

## Notas de Seguridad

- Las contraseñas se hashean con bcrypt
- En producción, **DEBE** configurarse `JWT_SECRET`
- CORS habilitado para localhost:5173
