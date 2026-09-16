# ngrok (local) setup — BienestarApp

Este repo NO guarda una URL fija de ngrok porque en el plan free cambia en cada reinicio.
Lo que sí podemos guardar aquí es la **config** (túneles) y cómo setear las **variables** para que Web/Mobile apunten bien.

## 0) Qué expone ngrok

- **Web (Vite)**: puerto `5173`
- **API (Go/Gin)**: puerto `8080` (endpoints en `/api/...`)

Cuando abras 2 túneles tendrás 2 URLs públicas:

- `WEB_DOMAIN` → (5173)
- `API_DOMAIN` → (8080)

Para ver cuáles son, abre: `http://127.0.0.1:4040`.

## 1) Preparar config de ngrok

1) Instala ngrok y agrega tu authtoken (una vez):

```powershell
ngrok config add-authtoken TU_TOKEN
```

2) Copia el archivo ejemplo:

```powershell
cd c:/Users/camer/github
copy ngrok.yml.example ngrok.yml
```

`ngrok.yml` NO se debe commitear.

## 2) Arranque local (3 terminales)

### Terminal A — Backend

```powershell
cd c:/Users/camer/github
start-backend.bat
```

Si vas a probar Web apuntando directo a `API_DOMAIN`, permite el origen del dominio web:

```powershell
set CORS_ALLOWED_ORIGINS=https://WEB_DOMAIN
start-backend.bat
```

(Para pruebas rápidas: `set CORS_ALLOW_ALL=1`.)

### Terminal B — Web

```powershell
cd c:/Users/camer/github/frontend
npm install
npm run dev
```

- Por defecto, el web usa `VITE_BACKEND_URL` o `/api`.
- Si estás usando proxy `/api` en `vite.config.js`, la web puede funcionar sin CORS.

### Terminal C — ngrok (web + api)

```powershell
cd c:/Users/camer/github
start-ngrok.bat
```

## 3) Variables para Web y Mobile

### Web

- Si quieres que la web llame **directo** a la API pública:
  - `VITE_BACKEND_URL=https://API_DOMAIN/api`

Puedes ponerlo en `frontend/.env.local` (no se commitea):

```env
VITE_BACKEND_URL=https://API_DOMAIN/api
```

### Mobile (Expo)

La app móvil usa `EXPO_PUBLIC_API_URL` y le agrega `/api`.
Ponlo en `mobile/.env` (no se commitea):

```env
EXPO_PUBLIC_API_URL=https://API_DOMAIN
```

Luego reinicia `expo start`.

## 4) Nota importante

En plan free de ngrok, `WEB_DOMAIN` y `API_DOMAIN` cambian con cada reinicio.
Si quieres que no cambien:
- Dominio reservado (pago), o
- Deploy real (Render/Vercel) que ya tienes documentado en este repo.
