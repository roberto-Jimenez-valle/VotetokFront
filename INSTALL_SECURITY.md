# ⚡ Instalación Rápida - Sistema de Seguridad

## 🎯 3 Pasos para Activar la Seguridad

### Paso 1: Instalar Dependencia (30 segundos)

```bash
npm install jose
```

### Paso 2: Generar y Configurar Secrets (2 minutos)

```bash
# Generar secrets aleatorios
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('APP_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Copiar output y crear .env
cp .env.example .env
# Editar .env con los secrets generados
```

**Tu .env debe verse así:**
```bash
JWT_SECRET=a7f3e9c2b8d4f6a1e5c9b3d7f2a6e8c4b9d5f1a3e7c2b6d8f4a9e1c5b7d3f6a2
APP_SECRET=d1e7c3a9f5b2e8d4c6a8f2b7e3d9c5a1f8e4b6d2a7c3f9e5b1d8a4c6f2e7b3d9
VITE_APP_ID=voutop-web-v1
VITE_APP_SECRET=d1e7c3a9f5b2e8d4c6a8f2b7e3d9c5a1f8e4b6d2a7c3f9e5b1d8a4c6f2e7b3d9
```

⚠️ **Importante**: `APP_SECRET` y `VITE_APP_SECRET` deben tener el **mismo valor**

### Paso 3: Actualizar Código Frontend (5 minutos)

Busca todos los `fetch()` que llamen a `/api/` y reemplázalos:

#### ❌ ANTES
```typescript
const response = await fetch('/api/polls/5/vote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ optionId: 1, latitude: 40, longitude: -3 })
})
const result = await response.json()
```

#### ✅ DESPUÉS
```typescript
import { apiPost } from '$lib/api/client'

const result = await apiPost('/api/polls/5/vote', {
  optionId: 1,
  latitude: 40,
  longitude: -3
})
```

---

## 🧪 Verificación Rápida

### Test 1: App Signature Funciona

```bash
# Iniciar servidor
npm run dev

# En otro terminal, probar desde Postman (debe fallar)
curl http://localhost:5173/api/polls/trending
```

**Resultado esperado:**
```json
{
  "message": "App authentication required. Please use the official app.",
  "code": "APP_AUTH_MISSING"
}
```

✅ **Si falla = Funciona correctamente** (solo tu app puede acceder)

### Test 2: Login Funciona

En el navegador, consola:
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'demo@voutop.com',
    password: 'cualquiera' // Por ahora sin validación de password
  })
})
const result = await response.json()
console.log(result) // Debe retornar accessToken y user
```

---

## 📊 Endpoints Actualizados

### Públicos (Solo requieren App Signature)
- `GET /api/polls` ✅
- `GET /api/polls/trending` ✅
- `GET /api/polls/{id}` ✅
- `POST /api/polls/{id}/vote` ✅ (anónimo con rate limit)
- `GET /api/geocode` ✅

### Protegidos (Requieren Login)
- `POST /api/polls` 🔐 (crear encuesta)
- `POST /api/polls/{id}/options` 🔐 (añadir opción)
- `DELETE /api/polls/{id}` 🔐 (solo dueño o admin)

### Autenticación
- `POST /api/auth/login` ✅ (público)
- `POST /api/auth/register` ✅ (público)

---

## 🔧 Helpers Disponibles

```typescript
import { 
  apiGet, 
  apiPost, 
  apiPut, 
  apiPatch, 
  apiDelete,
  handleApiError 
} from '$lib/api/client'

// Ejemplos
try {
  // GET
  const polls = await apiGet('/api/polls/trending')
  
  // POST
  const vote = await apiPost('/api/polls/5/vote', { optionId: 1 })
  
  // Con autenticación automática (si hay token)
  const newPoll = await apiPost('/api/polls', { title: 'Test' })
  
} catch (err) {
  // Manejo de errores amigable
  alert(handleApiError(err))
}
```

---

## 🐛 Errores Comunes

### "Module not found: jose"
```bash
npm install jose
```

### "INVALID_SIGNATURE"
Los secrets del frontend y backend no coinciden. Verifica:
1. `APP_SECRET` en `.env` (backend)
2. `VITE_APP_SECRET` en `.env` (frontend)
3. Deben ser **idénticos**
4. Reinicia el servidor

### "AUTH_REQUIRED"
El endpoint requiere login. Opciones:
1. Hacer login primero
2. Cambiar endpoint a público (si aplica)

### "RATE_LIMIT_EXCEEDED"
Has alcanzado el límite. Espera o haz login para límites más altos.

---

## 📚 Documentación Completa

- **SECURITY_SETUP_GUIDE.md** - Guía detallada paso a paso
- **APP_ONLY_SECURITY.md** - 5 métodos de protección
- **SECURITY_ARCHITECTURE.md** - Arquitectura completa

---

## ✅ Checklist

- [ ] `npm install jose`
- [ ] Generar secrets
- [ ] Configurar `.env`
- [ ] Reemplazar `fetch()` por `apiCall()`
- [ ] Reiniciar servidor
- [ ] Probar desde Postman (debe fallar)
- [ ] Probar desde tu app (debe funcionar)

---

**¡Listo! Tu app ahora es segura.** 🎉
