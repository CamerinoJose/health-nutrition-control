# Guía de Deployment para Frontend

## Opciones de Hosting

### Opción 1: Vercel (Recomendado)

**Por qué Vercel:**
- ✅ Diseñado específicamente para Vite/React
- ✅ Deploy automático desde Git
- ✅ SSL gratis
- ✅ CDN global
- ✅ Muy rápido
- ✅ Gratis para proyectos personales

**Pasos:**

1. **Crear cuenta en Vercel**
   - Ve a https://vercel.com/signup
   - Inicia sesión con GitHub

2. **Importar proyecto**
   - Click "Add New..." → "Project"
   - Selecciona tu repositorio `bienestarapp`
   - Click "Import"

3. **Configurar el proyecto**
   ```
   Framework Preset: Vite
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Variables de entorno**
   
   En "Environment Variables" agregar:
   ```
   VITE_API_URL=https://tu-backend.onrender.com
   VITE_GOOGLE_CLIENT_ID=tu-google-client-id
   ```

5. **Deploy**
   - Click "Deploy"
   - Espera 2-3 minutos
   - ¡Listo! Te da una URL como: `https://bienestarapp-frontend.vercel.app`

---

### Opción 2: Render Static Site

**Pasos:**

1. **En Render Dashboard**
   - Click "New +" → "Static Site"
   - Conecta tu repo `bienestarapp`

2. **Configurar**
   ```
   Name: bienestarapp-frontend
   Root Directory: frontend
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

3. **Variables de entorno**
   ```
   VITE_API_URL=https://tu-backend.onrender.com
   ```

4. **Deploy**
   - Click "Create Static Site"
   - Espera el build

---

### Opción 3: Netlify

**Pasos:**

1. **Crear cuenta en Netlify**
   - https://app.netlify.com/signup
   - Login con GitHub

2. **Importar proyecto**
   - "Add new site" → "Import an existing project"
   - Selecciona tu repo

3. **Configurar**
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist
   ```

4. **Variables de entorno**
   - En "Site settings" → "Environment variables"
   - Agregar `VITE_API_URL`

5. **Deploy**

---

## Configuración del Frontend

### 1. Actualizar URL del API

Crear archivo `frontend/.env.production`:

```bash
VITE_API_URL=https://tu-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=tu-google-client-id
```

### 2. Verificar configuración de build

Verificar que `frontend/vite.config.js` tenga:

```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
```

### 3. Actualizar api.js para usar variables de entorno

En `frontend/src/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Usar API_URL en lugar de localhost hardcoded
```

---

## Checklist Pre-Deployment

- [ ] Backend desplegado y funcionando
- [ ] URL del backend copiada
- [ ] Variables de entorno configuradas
- [ ] Google OAuth configurado con nuevas URLs
- [ ] Build local funciona: `npm run build`
- [ ] Preview local funciona: `npm run preview`

---

## Post-Deployment

### 1. Actualizar Google OAuth

En https://console.cloud.google.com/apis/credentials:

1. Edita tu OAuth Client ID
2. Agregar "Authorized redirect URIs":
   ```
   https://tu-frontend.vercel.app/oauth/callback
   ```

### 2. Actualizar CORS en Backend

En el archivo `.env` de Render (backend):
```
CORS_ORIGINS=https://tu-frontend.vercel.app
```

### 3. Probar la aplicación

1. Ve a tu URL del frontend
2. Intenta hacer login
3. Verifica que las APIs funcionen
4. Prueba Google OAuth

---

## Troubleshooting

### Google OAuth shows `Not found` at `/callback`

The frontend is a single-page application, so the static host must rewrite
unknown application routes to `/index.html`. In the Render Static Site
dashboard, add this rewrite rule:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

The repository also includes `frontend/public/_redirects` for hosts that
support Netlify-style SPA rules. After adding the Render rule, redeploy the
frontend and retry Google login.

### Error: API calls failing
- Verifica que `VITE_API_URL` esté configurada
- Verifica CORS en el backend
- Revisa Network tab en DevTools

### Error: Google OAuth no funciona
- Verifica redirect URIs en Google Console
- Verifica que el Client ID sea correcto
- Revisa que HTTPS esté habilitado

### Error: Build falla
- Ejecuta `npm install` primero
- Verifica que no haya errores en el código
- Revisa los logs del build

---

## Dominios Personalizados (Opcional)

### Vercel:
1. Settings → Domains
2. Add domain
3. Seguir instrucciones DNS

### Netlify:
1. Domain settings
2. Add custom domain
3. Configurar DNS

### Render:
1. Settings → Custom Domains
2. Add custom domain
3. Configurar DNS

---

## Costos

| Servicio | Plan Gratuito | Límites |
|----------|---------------|---------|
| **Vercel** | ✅ | 100 GB bandwidth/mes |
| **Netlify** | ✅ | 100 GB bandwidth/mes |
| **Render Static** | ✅ | 100 GB bandwidth/mes |

**Todos son gratis para proyectos personales!**
