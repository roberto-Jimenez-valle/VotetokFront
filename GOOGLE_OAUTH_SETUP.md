# 🔐 Configuración de Google OAuth

## 📋 Pasos para configurar Google OAuth

### 1. Google Cloud Console

1. **Ir a** [Google Cloud Console](https://console.cloud.google.com/)

2. **Crear un proyecto nuevo** (o seleccionar uno existente)
   - Click en el selector de proyectos (arriba a la izquierda)
   - "Nuevo proyecto"
   - Nombre: `voutop` (o el que prefieras)

3. **Habilitar Google+ API**
   - Menú → "APIs y servicios" → "Biblioteca"
   - Buscar "Google+ API"
   - Click en "Habilitar"

4. **Configurar pantalla de consentimiento OAuth**
   - Menú → "APIs y servicios" → "Pantalla de consentimiento de OAuth"
   - Tipo: "Externo" (o "Interno" si es G Suite)
   - Completar información:
     - Nombre de la aplicación: `voutop`
     - Correo de asistencia: tu email
     - Logo (opcional)
     - Dominio autorizado: tu dominio de producción
   - Agregar scopes:
     - `openid`
     - `email`
     - `profile`
   - Guardar

5. **Crear credenciales OAuth 2.0**
   - Menú → "APIs y servicios" → "Credenciales"
   - Click en "+ CREAR CREDENCIALES" → "ID de cliente de OAuth 2.0"
   - Tipo de aplicación: "Aplicación web"
   - Nombre: `voutop Web Client`
   
   **Orígenes de JavaScript autorizados:**
   ```
   http://localhost:5173
   https://voutop.com
   ```
   
   **URIs de redireccionamiento autorizadas:**
   ```
   http://localhost:5173/api/auth/google/callback
   https://voutop.com/api/auth/google/callback
   ```
   
   - Click en "CREAR"
   - **GUARDAR** el `Client ID` y `Client Secret`

---

### 2. Configuración Local (.env)

1. **Copiar `.env.example` a `.env`**
   ```bash
   cp .env.example .env
   ```

2. **Agregar las credenciales de Google**
   ```env
   GOOGLE_CLIENT_ID=123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-tu_secret_aqui
   GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
   ```

3. **Reiniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

---

### 3. Configuración en Railway (Producción)

1. **Ir a tu proyecto en Railway**
   - [railway.app](https://railway.app/)
   - Seleccionar tu proyecto

2. **Agregar variables de entorno**
   - Tab "Variables"
   - Click en "+ New Variable"
   
   **Agregar las siguientes variables:**
   ```
   GOOGLE_CLIENT_ID = tu-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET = tu-google-client-secret
   GOOGLE_REDIRECT_URI = https://voutop.com/api/auth/google/callback
   ```
   
   > ⚠️ **Importante**: Usa tus credenciales reales de Google Cloud Console. NO commitees los secretos en el código.

3. **Re-deploy automático**
   - Railway detectará los cambios y hará re-deploy automáticamente

---

## 🧪 Probar la autenticación

### En desarrollo:
1. Abrir http://localhost:5173
2. Click en el botón de crear encuesta (o cualquier acción que requiera login)
3. En el AuthModal, click en "Continuar con Google"
4. Serás redirigido a Google para autenticarte
5. Después de aprobar, volverás a la app autenticado

### En producción:
1. Abrir https://voutop.com
2. Seguir los mismos pasos

---

## 🔍 Debugging

### Verificar logs del servidor:
```bash
# Desarrollo
npm run dev

# Railway
Ver logs en el dashboard de Railway
```

### Errores comunes:

**Error: `google_config_missing`**
- Verificar que las variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` están configuradas

**Error: `redirect_uri_mismatch`**
- Verificar que la URL de callback está registrada en Google Cloud Console
- La URL debe coincidir EXACTAMENTE (incluyendo http/https)

**Error: `access_denied`**
- El usuario canceló la autenticación o no dio permisos
- Verificar que los scopes solicitados están configurados en Google Cloud Console

---

## 📝 Flujo completo

1. **Usuario** click en "Continuar con Google"
2. **Frontend** redirige a `/api/auth/google`
3. **Backend** redirige a Google OAuth con scopes (email, profile)
4. **Usuario** autoriza en Google
5. **Google** redirige a `/api/auth/google/callback` con código
6. **Backend** intercambia código por tokens
7. **Backend** obtiene información del usuario de Google
8. **Backend** crea/actualiza usuario en la DB
9. **Backend** genera JWT tokens
10. **Backend** redirige a frontend con usuario y token en URL
11. **Frontend** guarda en localStorage y actualiza el store
12. **Usuario** está autenticado ✅

---

## 🔒 Seguridad

- Los tokens JWT se guardan en cookies httpOnly (más seguro)
- Las credenciales de Google NUNCA se exponen al frontend
- Los refresh tokens permiten mantener la sesión
- Las contraseñas no se almacenan (OAuth)

---

## 📚 Referencias

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Railway Documentation](https://docs.railway.app/)
- [SvelteKit Environment Variables](https://kit.svelte.dev/docs/modules#$env-dynamic-private)
