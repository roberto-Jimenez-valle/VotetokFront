# 🔒 Guía de Instalación - Sistema de Seguridad VouTop

## ✅ Sistema Implementado

Has elegido **Opción B: App Signature + JWT Básico**

### Características
- ✅ **App Signature (HMAC-SHA256)**: Endpoints públicos solo accesibles desde tu app
- ✅ **JWT**: Sistema de autenticación para endpoints que requieren login
- ✅ **Rate Limiting**: Límites diferenciados para anónimos vs autenticados
- ✅ **Middleware Global**: Aplicación automática en todos los endpoints
- ✅ **Cliente API**: Manejo automático de signatures y tokens

---

## 📦 Paso 1: Instalar Dependencias

```bash
npm install jose
```

**jose**: Biblioteca moderna y segura para JWT (recomendada por IETF)

---

## 🔧 Paso 2: Configurar Variables de Entorno

### Generar Secrets

```bash
# En tu terminal
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('APP_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

### Crear archivo .env

```bash
# Copiar template
cp .env.example .env

# Editar con tus secrets generados
```

**Ejemplo .env:**
```bash
JWT_SECRET=a7f3e9c2b8d4f6a1e5c9b3d7f2a6e8c4b9d5f1a3e7c2b6d8f4a9e1c5b7d3f6a2
APP_SECRET=d1e7c3a9f5b2e8d4c6a8f2b7e3d9c5a1f8e4b6d2a7c3f9e5b1d8a4c6f2e7b3d9
VITE_APP_ID=votetok-web-v1
VITE_APP_SECRET=d1e7c3a9f5b2e8d4c6a8f2b7e3d9c5a1f8e4b6d2a7c3f9e5b1d8a4c6f2e7b3d9
```

⚠️ **IMPORTANTE**:
- **Nunca** compartas estos secrets
- **Nunca** los subas a Git
- Usa diferentes secrets en dev y producción
- `APP_SECRET` debe ser el mismo en frontend y backend

---

## 🚀 Paso 3: Uso en el Frontend

### 3.1 Reemplazar fetch() por apiCall()

#### ❌ ANTES (Sin seguridad)
```typescript
// Cualquiera puede hacer esto desde Postman
const response = await fetch('/api/polls/5/vote', {
  method: 'POST',
  body: JSON.stringify({ optionId: 1, latitude: 40.4, longitude: -3.7 })
})
```

#### ✅ DESPUÉS (Con App Signature automática)
```typescript
import { apiPost } from '$lib/api/client'

try {
  const result = await apiPost('/api/polls/5/vote', {
    optionId: 1,
    latitude: 40.4,
    longitude: -3.7
  })
  console.log('Voto exitoso:', result)
} catch (err) {
  console.error('Error:', handleApiError(err))
}
```

### 3.2 Endpoints que Requieren Login

```typescript
import { apiPost, handleApiError } from '$lib/api/client'
import { setAuth } from '$lib/stores/auth'

// 1. Login
async function login(email: string, password: string) {
  try {
    const result = await apiPost('/api/auth/login', { email, password })
    
    // Guardar token y usuario
    setAuth(result.accessToken, result.user)
    
    console.log('Login exitoso:', result.user)
  } catch (err) {
    alert(handleApiError(err))
  }
}

// 2. Crear encuesta (requiere login)
async function createPoll(pollData: any) {
  try {
    // El cliente automáticamente incluye el JWT si existe
    const poll = await apiPost('/api/polls', pollData)
    console.log('Encuesta creada:', poll)
  } catch (err) {
    if (err.code === 'AUTH_REQUIRED') {
      alert('Debes iniciar sesión para crear encuestas')
      // Redirigir a login
    } else {
      alert(handleApiError(err))
    }
  }
}
```

### 3.3 Helpers Disponibles

```typescript
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '$lib/api/client'

// GET
const polls = await apiGet('/api/polls/trending')

// POST
const vote = await apiPost('/api/polls/5/vote', { optionId: 1 })

// PUT
const updated = await apiPut('/api/polls/5', { title: 'Nuevo título' })

// PATCH
const patched = await apiPatch('/api/users/me', { displayName: 'Nuevo nombre' })

// DELETE
await apiDelete('/api/polls/5')
```

---

## 🎯 Paso 4: Actualizar Endpoints Existentes

### 4.1 Endpoints Públicos (Sin Cambios)

Estos ya funcionan con App Signature automática:

```typescript
// src/routes/api/polls/[id]/vote/+server.ts
// Ya está protegido por App Signature en hooks.server.ts
// NO necesitas cambiar nada
```

### 4.2 Endpoints que Requieren Login

#### Ejemplo: Crear Encuesta

```typescript
// src/routes/api/polls/+server.ts
import { json, error } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/middleware/auth'
import { rateLimitByUser } from '$lib/server/middleware/rateLimit'

export const POST = async (event) => {
  // 1. Requerir autenticación
  const user = await requireAuth(event)
  
  // 2. Rate limiting
  await rateLimitByUser(user.userId, user.role, 'poll_create')
  
  // 3. Tu lógica
  const data = await event.request.json()
  const poll = await prisma.poll.create({
    data: {
      ...data,
      userId: user.userId // Usar userId del token JWT
    }
  })
  
  return json({ success: true, poll })
}
```

#### Ejemplo: Eliminar Encuesta (Solo Dueño)

```typescript
// src/routes/api/polls/[id]/+server.ts
import { requireOwnership } from '$lib/server/middleware/auth'

export const DELETE = async (event) => {
  const { id } = event.params
  
  // Obtener poll
  const poll = await prisma.poll.findUnique({ where: { id: Number(id) } })
  if (!poll) throw error(404, 'Poll not found')
  
  // Verificar ownership (permite admins/moderators)
  await requireOwnership(event, poll.userId)
  
  // Eliminar
  await prisma.poll.delete({ where: { id: poll.id } })
  
  return json({ success: true })
}
```

#### Ejemplo: Solo Admins

```typescript
import { requireRole } from '$lib/server/middleware/auth'

export const POST = async (event) => {
  // Solo admins y moderators
  const user = await requireRole(event, ['admin', 'moderator'])
  
  // Tu lógica de admin...
}
```

---

## 📝 Paso 5: Matriz de Endpoints

| Endpoint | Tipo | Autenticación | Rate Limit |
|----------|------|---------------|------------|
| `GET /api/polls` | Público | App Signature | 1000/hora (anónimo) |
| `GET /api/polls/trending` | Público | App Signature | 1000/hora (anónimo) |
| `GET /api/polls/{id}` | Público | App Signature | 1000/hora (anónimo) |
| `POST /api/polls/{id}/vote` | Público | App Signature | 100/hora (anónimo), 500/hora (auth) |
| `GET /api/geocode` | Público | App Signature | 50/hora (IP) |
| `POST /api/polls` | Protegido | JWT + App Signature | 20/día (user) |
| `POST /api/polls/{id}/options` | Protegido | JWT + App Signature | Variable |
| `DELETE /api/polls/{id}` | Protegido | JWT + Ownership | Variable |
| `POST /api/auth/login` | Público | Solo App Signature | 5/15min (IP) |
| `POST /api/auth/register` | Público | Solo App Signature | 3/hora (IP) |

---

## 🧪 Paso 6: Testing

### 6.1 Probar App Signature

#### ✅ Desde tu App (Debe funcionar)

```typescript
import { apiGet } from '$lib/api/client'

const polls = await apiGet('/api/polls/trending')
console.log('Polls:', polls) // ✅ Funciona
```

#### ❌ Desde Postman (Debe fallar)

```bash
curl http://localhost:5173/api/polls/trending
```

**Respuesta esperada:**
```json
{
  "message": "App authentication required. Please use the official app.",
  "code": "APP_AUTH_MISSING"
}
```

### 6.2 Probar JWT

```typescript
import { apiPost } from '$lib/api/client'
import { setAuth } from '$lib/stores/auth'

// 1. Login
const result = await apiPost('/api/auth/login', {
  email: 'demo@votetok.com',
  password: 'password123'
})

setAuth(result.accessToken, result.user)

// 2. Crear encuesta (ahora funciona)
const poll = await apiPost('/api/polls', {
  title: 'Test Poll',
  options: [
    { optionKey: 'yes', optionLabel: 'Sí' },
    { optionKey: 'no', optionLabel: 'No' }
  ]
})

console.log('Poll creado:', poll)
```

### 6.3 Probar Rate Limiting

```typescript
// Hacer 101 requests rápidos (debe fallar en el 101)
for (let i = 0; i < 101; i++) {
  try {
    await apiPost('/api/polls/1/vote', { optionId: 1, latitude: 40, longitude: -3 })
  } catch (err) {
    console.error(`Request ${i+1} falló:`, err.message)
    // En el 101: "Rate limit exceeded. Try again in X seconds."
  }
}
```

---

## 🐛 Troubleshooting

### Error: "APP_AUTH_MISSING"

**Causa**: No se están enviando los headers de App Signature

**Solución**:
1. Verificar que estás usando `apiCall()` y no `fetch()` directo
2. Verificar que `VITE_APP_ID` y `VITE_APP_SECRET` están en `.env`
3. Reiniciar el servidor de desarrollo

### Error: "INVALID_SIGNATURE"

**Causa**: El secret del frontend y backend no coinciden

**Solución**:
1. Verificar que `APP_SECRET` y `VITE_APP_SECRET` tienen el mismo valor
2. Reiniciar servidor frontend y backend

### Error: "TIMESTAMP_EXPIRED"

**Causa**: Reloj del dispositivo desincronizado

**Solución**:
1. Verificar hora del sistema
2. Aumentar `TIMESTAMP_TOLERANCE` en `signature.ts` (solo para desarrollo)

### Error: "AUTH_REQUIRED"

**Causa**: Endpoint requiere login pero no hay token

**Solución**:
1. Verificar que el usuario está logueado
2. Verificar que `authToken` store tiene un valor
3. Verificar que el token no expiró (15 minutos)

### Error: "RATE_LIMIT_EXCEEDED"

**Causa**: Has excedido el límite de requests

**Solución**:
1. Esperar el tiempo indicado en `retryAfter`
2. Si es en desarrollo, aumentar límites en `rateLimit.ts`
3. Considerar hacer login para límites más altos

---

## 📊 Monitoring y Logs

### Ver Logs en Consola

Los logs se muestran automáticamente:

```
[2025-01-22T20:45:23.456Z] GET /api/polls/trending - 200 (45ms) - Anonymous
[2025-01-22T20:45:25.789Z] POST /api/polls - 201 (120ms) - User 123
[2025-01-22T20:45:27.012Z] POST /api/polls/5/vote - 429 (5ms) - ERROR
```

### Limpieza Automática

El sistema limpia automáticamente registros expirados cada 10 minutos:

```
[RateLimit] Cleaned 342 expired records
```

---

## 🚀 Próximos Pasos

### Opcional: Cloudflare Turnstile (Anti-Bots)

Si quieres agregar protección anti-bots:

1. Ir a https://dash.cloudflare.com/
2. Crear widget de Turnstile
3. Agregar keys a `.env`:
   ```bash
   VITE_TURNSTILE_SITE_KEY=your-site-key
   TURNSTILE_SECRET_KEY=your-secret-key
   ```
4. Ver `APP_ONLY_SECURITY.md` método #5 para implementación

### Producción: Usar Redis para Rate Limiting

En producción, reemplaza el Map en memoria con Redis:

```bash
npm install ioredis
```

```typescript
// src/lib/server/rateLimit.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// Usar redis.get() y redis.setex() en lugar de Map
```

### Agregar Password Hashing

```bash
npm install bcrypt
npm install -D @types/bcrypt
```

En `login/+server.ts` y `register/+server.ts`, descomenta las líneas de bcrypt.

---

## 📚 Archivos Creados

```
src/
├── lib/
│   ├── api/
│   │   ├── client.ts          ✅ Cliente API con signature automática
│   │   └── signature.ts       ✅ Generador de signatures
│   ├── server/
│   │   ├── auth/
│   │   │   ├── jwt.ts         ✅ Sistema JWT
│   │   │   └── signature.ts   ✅ Validador de signatures
│   │   └── middleware/
│   │       ├── auth.ts        ✅ Middleware JWT
│   │       ├── appAuth.ts     ✅ Middleware App Signature
│   │       └── rateLimit.ts   ✅ Sistema rate limiting
│   └── stores/
│       └── auth.ts            ✅ Store de autenticación
├── routes/
│   └── api/
│       ├── auth/
│       │   ├── login/+server.ts    ✅ Endpoint de login
│       │   └── register/+server.ts ✅ Endpoint de registro
│       └── polls/+server.ts        ✅ Actualizado con auth
└── hooks.server.ts            ✅ Middleware global

Documentación:
├── APP_ONLY_SECURITY.md       ✅ Métodos de protección
├── SECURITY_ARCHITECTURE.md   ✅ Arquitectura completa
├── SECURITY_SETUP_GUIDE.md    ✅ Esta guía
└── .env.example               ✅ Template de configuración
```

---

## ✅ Checklist Final

- [ ] Instalar `jose`
- [ ] Generar secrets y configurar `.env`
- [ ] Reemplazar `fetch()` por `apiCall()` en el frontend
- [ ] Probar login/registro
- [ ] Probar crear encuesta (con login)
- [ ] Probar votar (sin login, con app signature)
- [ ] Verificar rate limiting
- [ ] Verificar que Postman falla sin signature

---

## 🎉 ¡Listo!

Tu aplicación ahora tiene:
- ✅ **Endpoints públicos** protegidos (solo desde tu app)
- ✅ **Endpoints autenticados** con JWT
- ✅ **Rate limiting** inteligente
- ✅ **Manejo de errores** amigable
- ✅ **Logging** automático

**¿Tienes dudas?** Revisa la sección de Troubleshooting o consulta los archivos de documentación.
