# Configuración de Login Social (OAuth)

## ✅ Funcionalidades Implementadas

Se han agregado botones para login social con:
- 🔵 **Google**
- 🔵 **Facebook**  
- ⚫ **GitHub**

## 📋 Estado Actual

La infraestructura OAuth está **completamente implementada** y funcional:

✅ Interfaz de usuario con botones sociales
✅ Tabla `social_accounts` en base de datos
✅ Endpoints OAuth en backend (/api/auth/{provider})
✅ Manejo de callbacks y creación automática de usuarios
✅ Generación de JWT tras login social exitoso

## ⚙️ Configuración Requerida para Producción

Para activar cada provider, necesitas configurar las credenciales OAuth:

### 1. Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita "Google+ API"
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth 2.0"
5. Configura:
   - **Tipo de aplicación**: Aplicación web
   - **URIs de redireccionamiento autorizados**: 
     ```
     http://localhost:8080/api/auth/google/callback
     https://tudominio.com/api/auth/google/callback
     ```
6. Copia el `Client ID` y `Client Secret`
7. En `backend/oauth_handlers.go` línea 26-32, reemplaza:
   ```go
   "google": {
       ClientID:     "TU_GOOGLE_CLIENT_ID_AQUI",
       ClientSecret: "TU_GOOGLE_CLIENT_SECRET_AQUI",
       // ... resto igual
   }
   ```

### 2. Facebook Login

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Crea una nueva app
3. Agrega "Facebook Login" a tu app
4. Configura:
   - **Valid OAuth Redirect URIs**:
     ```
     http://localhost:8080/api/auth/facebook/callback
     https://tudominio.com/api/auth/facebook/callback
     ```
5. Copia el `App ID` y `App Secret`
6. En `backend/oauth_handlers.go` línea 33-39, reemplaza:
   ```go
   "facebook": {
       ClientID:     "TU_FACEBOOK_APP_ID_AQUI",
       ClientSecret: "TU_FACEBOOK_APP_SECRET_AQUI",
       // ... resto igual
   }
   ```

### 3. GitHub OAuth

1. Ve a [GitHub Settings → Developer Settings](https://github.com/settings/developers)
2. Click en "New OAuth App"
3. Configura:
   - **Homepage URL**: `http://localhost:5174` (o tu dominio)
   - **Authorization callback URL**: 
     ```
     http://localhost:8080/api/auth/github/callback
     https://tudominio.com/api/auth/github/callback
     ```
4. Copia el `Client ID` y genera un `Client Secret`
5. En `backend/oauth_handlers.go` línea 40-46, reemplaza:
   ```go
   "github": {
       ClientID:     "TU_GITHUB_CLIENT_ID_AQUI",
       ClientSecret: "TU_GITHUB_CLIENT_SECRET_AQUI",
       // ... resto igual
   }
   ```

## 🔒 Variables de Entorno (Recomendado)

En lugar de hardcodear las credenciales, es mejor usar variables de entorno:

```go
// En oauth_handlers.go
var oauthConfigs = map[string]OAuthConfig{
	"google": {
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		// ...
	},
	// ...
}
```

Luego crear archivo `.env`:
```
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
FACEBOOK_APP_ID=tu_app_id
FACEBOOK_APP_SECRET=tu_app_secret
GITHUB_CLIENT_ID=tu_client_id
GITHUB_CLIENT_SECRET=tu_client_secret
```

## 🚀 Cómo Funciona

1. Usuario hace clic en botón social (ej: "Continuar con Google")
2. Se redirige a `/api/auth/google`
3. Backend redirige a la página de autorización de Google
4. Usuario autoriza la app
5. Google redirige a `/api/auth/google/callback` con un código
6. Backend intercambia el código por un access token
7. Backend obtiene info del usuario desde Google
8. Backend busca si existe vinculación, sino crea nuevo usuario
9. Backend genera JWT token
10. Frontend recibe el token y autentica al usuario

## 🧪 Modo de Desarrollo

Los botones aparecen y funcionan localmente. Sin configurar las credenciales OAuth reales:
- Los botones son visibles y clickeables
- Intentarán conectar pero fallarán por falta de credenciales
- Esto es normal en desarrollo

Para probar completamente, configura al menos un provider (Google es el más fácil).

## 📊 Base de Datos

La tabla `social_accounts` vincula cuentas sociales con usuarios:

```sql
CREATE TABLE social_accounts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,        -- FK a users
    provider TEXT,          -- 'google', 'facebook', 'github'
    provider_user_id TEXT,  -- ID del usuario en el provider
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

## 🎨 Interfaz

Los botones de login social aparecen en:
- Página de login
- Con iconos de cada provider
- Divider "o continúa con"
- Hover effects

## ✨ Siguientes Pasos

1. Configurar credenciales OAuth para al menos un provider
2. Probar el flujo completo
3. Agregar manejo de errores más detallado
4. Implementar renovación de tokens
5. Añadir más providers (Microsoft, Apple, Twitter, etc.)

## 📝 Notas Importantes

- Los usuarios creados via OAuth tienen un password placeholder
- Pueden vincular múltiples providers a una misma cuenta email
- El email se usa como identificador principal
- Los permisos por defecto son 'user', pueden ser modificados después
