# 🔒 Seguridad App-Only - Endpoints Públicos Protegidos

## 🎯 Objetivo

Endpoints que **NO requieren login** pero **SOLO funcionan desde tu app oficial**.

---

## 📊 Comparación de Métodos

| Método | Seguridad | Complejidad | Costo | Bypass Dificultad |
|--------|-----------|-------------|-------|-------------------|
| **1. API Key Simple** | ⭐⭐ | ⭐ | Gratis | Fácil (decompilación) |
| **2. API Key + App Signature** | ⭐⭐⭐ | ⭐⭐ | Gratis | Media |
| **3. Certificate Pinning** | ⭐⭐⭐⭐ | ⭐⭐⭐ | Gratis | Difícil |
| **4. Firebase App Check** | ⭐⭐⭐⭐⭐ | ⭐⭐ | Gratis* | Muy difícil |
| **5. Cloudflare Turnstile** | ⭐⭐⭐⭐⭐ | ⭐⭐ | Gratis* | Muy difícil |

**Recomendación:** Combinar **#2 + #5** para máxima seguridad con mínima complejidad.

---

## 🔐 Método 1: API Key Simple (Mínimo Viable)

### Concepto
Tu app envía un header secreto que el backend valida.

### ⚠️ Limitación
Un usuario técnico puede:
1. Inspeccionar el tráfico de red
2. Ver el API Key
3. Usarlo en Postman

**Uso recomendado:** Solo para desarrollo o apps con audiencia no técnica.

---

### Implementación

#### 1. Generar API Key
```bash
# Generar key aleatoria
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a7f3e9c2b8d4f6a1e5c9b3d7f2a6e8c4b9d5f1a3e7c2b6d8f4a9e1c5b7d3f6a2
```

#### 2. Guardar en .env
```bash
# .env
VITE_APP_API_KEY=a7f3e9c2b8d4f6a1e5c9b3d7f2a6e8c4b9d5f1a3e7c2b6d8f4a9e1c5b7d3f6a2
```

#### 3. Frontend - Enviar API Key
```typescript
// src/lib/api/client.ts
const API_KEY = import.meta.env.VITE_APP_API_KEY

export async function apiCall(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}

// Uso
await apiCall('/api/polls/trending')
await apiCall('/api/polls/5/vote', {
  method: 'POST',
  body: JSON.stringify({ optionId: 1, latitude: 40.4, longitude: -3.7 })
})
```

#### 4. Backend - Validar API Key
```typescript
// src/lib/server/middleware/appAuth.ts
import { error, type RequestEvent } from '@sveltejs/kit'

const VALID_API_KEYS = [
  process.env.APP_API_KEY, // Key principal
  process.env.APP_API_KEY_IOS, // Key específica iOS (opcional)
  process.env.APP_API_KEY_ANDROID // Key específica Android (opcional)
].filter(Boolean)

export function requireAppAccess(event: RequestEvent) {
  const apiKey = event.request.headers.get('X-API-Key')
  
  if (!apiKey) {
    throw error(401, {
      message: 'API Key required. Please use the official app.',
      code: 'API_KEY_MISSING'
    })
  }
  
  if (!VALID_API_KEYS.includes(apiKey)) {
    throw error(403, {
      message: 'Invalid API Key. Please update your app.',
      code: 'API_KEY_INVALID'
    })
  }
  
  return true
}
```

#### 5. Aplicar en Endpoints
```typescript
// src/routes/api/polls/trending/+server.ts
import { json } from '@sveltejs/kit'
import { requireAppAccess } from '$lib/server/middleware/appAuth'

export const GET = async (event) => {
  // Validar que viene desde la app
  requireAppAccess(event)
  
  // Procesar request
  const polls = await prisma.poll.findMany({
    where: { trending: true }
  })
  
  return json({ polls })
}
```

---

## 🔐 Método 2: API Key + App Signature (Recomendado)

### Concepto
Cada request incluye:
1. **API Key** (identifica la app)
2. **Timestamp** (evita replay attacks)
3. **Signature** (HMAC del request + secret)

### ✅ Ventajas
- Difícil de bypassear sin el secret
- Protege contra replay attacks
- No requiere servicios externos

---

### Implementación

#### 1. Variables de Entorno
```bash
# .env
VITE_APP_ID=voutop-web-v1
VITE_APP_SECRET=super-secret-key-never-share-this-1234567890

# Backend (.env)
APP_SECRET=super-secret-key-never-share-this-1234567890
```

#### 2. Frontend - Generar Signature
```typescript
// src/lib/api/signature.ts
import { createHmac } from 'crypto' // En Node.js
// Para navegador, usar: https://www.npmjs.com/package/crypto-js

const APP_ID = import.meta.env.VITE_APP_ID
const APP_SECRET = import.meta.env.VITE_APP_SECRET

export async function createAppSignature(
  method: string,
  path: string,
  body?: string
): Promise<{ timestamp: number; signature: string }> {
  const timestamp = Date.now()
  
  // Crear string para firmar
  const message = `${method}:${path}:${timestamp}:${body || ''}`
  
  // Generar HMAC-SHA256
  const signature = createHmac('sha256', APP_SECRET)
    .update(message)
    .digest('hex')
  
  return { timestamp, signature }
}

// Cliente API mejorado
export async function secureApiCall(
  url: string, 
  options: RequestInit = {}
) {
  const method = options.method || 'GET'
  const path = new URL(url).pathname
  const body = options.body as string | undefined
  
  const { timestamp, signature } = await createAppSignature(method, path, body)
  
  return fetch(url, {
    ...options,
    headers: {
      'X-App-ID': APP_ID,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}
```

#### 3. Backend - Validar Signature
```typescript
// src/lib/server/middleware/appAuth.ts
import { createHmac } from 'crypto'
import { error, type RequestEvent } from '@sveltejs/kit'

const APP_SECRET = process.env.APP_SECRET!
const TIMESTAMP_TOLERANCE = 5 * 60 * 1000 // 5 minutos

export async function requireAppSignature(event: RequestEvent) {
  const appId = event.request.headers.get('X-App-ID')
  const timestamp = event.request.headers.get('X-Timestamp')
  const signature = event.request.headers.get('X-Signature')
  
  // 1. Validar headers presentes
  if (!appId || !timestamp || !signature) {
    throw error(401, {
      message: 'App authentication required',
      code: 'APP_AUTH_MISSING'
    })
  }
  
  // 2. Validar App ID
  const validAppIds = ['voutop-web-v1', 'voutop-ios-v1', 'voutop-android-v1']
  if (!validAppIds.includes(appId)) {
    throw error(403, {
      message: 'Invalid app ID',
      code: 'INVALID_APP_ID'
    })
  }
  
  // 3. Validar timestamp (evitar replay attacks)
  const now = Date.now()
  const requestTime = parseInt(timestamp)
  
  if (isNaN(requestTime)) {
    throw error(400, { message: 'Invalid timestamp', code: 'INVALID_TIMESTAMP' })
  }
  
  if (Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE) {
    throw error(401, {
      message: 'Request expired. Please sync your device clock.',
      code: 'TIMESTAMP_EXPIRED'
    })
  }
  
  // 4. Recrear signature en backend
  const method = event.request.method
  const path = new URL(event.request.url).pathname
  
  // Leer body si existe
  let body = ''
  if (method !== 'GET' && method !== 'HEAD') {
    body = await event.request.text()
    // Recrear request con el body leído
    event.request = new Request(event.request.url, {
      method: event.request.method,
      headers: event.request.headers,
      body: body || undefined
    })
  }
  
  const message = `${method}:${path}:${timestamp}:${body}`
  const expectedSignature = createHmac('sha256', APP_SECRET)
    .update(message)
    .digest('hex')
  
  // 5. Comparar signatures (timing-safe)
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw error(403, {
      message: 'Invalid signature',
      code: 'INVALID_SIGNATURE'
    })
  }
  
  return { appId, timestamp: requestTime }
}

// Comparación segura contra timing attacks
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}
```

#### 4. Aplicar en hooks.server.ts (Global)
```typescript
// src/hooks.server.ts
import { requireAppSignature } from '$lib/server/middleware/appAuth'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  
  // Lista de endpoints que requieren app signature
  const appOnlyEndpoints = [
    '/api/polls',
    '/api/geocode',
    '/api/users'
  ]
  
  // Verificar si el endpoint requiere app auth
  const requiresAppAuth = appOnlyEndpoints.some(endpoint => 
    pathname.startsWith(endpoint)
  )
  
  if (requiresAppAuth) {
    try {
      await requireAppSignature(event)
    } catch (err) {
      // El error ya fue lanzado con el código apropiado
      throw err
    }
  }
  
  return resolve(event)
}
```

---

## 🔐 Método 3: Certificate Pinning (Muy Seguro)

### Concepto
La app solo confía en un certificado SSL específico (el tuyo).

### ✅ Ventajas
- Protege contra man-in-the-middle
- Muy difícil de bypassear
- No requiere cambios en backend

### ⚠️ Desventajas
- Más complejo de implementar
- Requiere actualizar app si cambias certificado
- Solo aplica a apps nativas (no web)

---

### Implementación (Solo Apps Móviles)

#### iOS (Swift)
```swift
// AppDelegate.swift
import Foundation

class CertificatePinner: NSObject, URLSessionDelegate {
    
    let pinnedCertificateHash = "sha256/AAAAAAAAAA..." // Tu hash
    
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let certificate = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        let serverCertificateData = SecCertificateCopyData(certificate) as Data
        let serverHash = serverCertificateData.sha256()
        
        if serverHash == pinnedCertificateHash {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
```

#### Android (Kotlin)
```kotlin
// NetworkConfig.kt
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient

val certificatePinner = CertificatePinner.Builder()
    .add("api.voutop.com", "sha256/AAAAAAAAAA...") // Tu hash
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

---

## 🔐 Método 4: Firebase App Check (Recomendado para Producción)

### Concepto
Firebase verifica que el request viene de tu app legítima y genera tokens de corta duración.

### ✅ Ventajas
- **Máxima seguridad** sin código complejo
- Protege contra bots y scrapers
- Tokens rotativos (1 hora)
- Gratis hasta 100k requests/mes

---

### Implementación

#### 1. Setup Firebase
```bash
npm install firebase
npm install @firebase/app-check
```

#### 2. Frontend (SvelteKit)
```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from '@firebase/app-check'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: "voutop",
  appId: "1:123456789:web:abcdef"
}

const app = initializeApp(firebaseConfig)

// Inicializar App Check
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true
})
```

#### 3. Cliente API con App Check
```typescript
// src/lib/api/client.ts
import { getToken } from '@firebase/app-check'
import { appCheck } from '$lib/firebase'

export async function secureApiCall(url: string, options: RequestInit = {}) {
  // Obtener token de App Check
  const { token } = await getToken(appCheck, false)
  
  return fetch(url, {
    ...options,
    headers: {
      'X-Firebase-AppCheck': token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}
```

#### 4. Backend - Validar App Check Token
```bash
npm install firebase-admin
```

```typescript
// src/lib/server/middleware/firebaseAppCheck.ts
import { initializeApp, cert } from 'firebase-admin/app'
import { getAppCheck } from 'firebase-admin/app-check'
import { error, type RequestEvent } from '@sveltejs/kit'

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)

initializeApp({
  credential: cert(serviceAccount)
})

export async function verifyAppCheckToken(event: RequestEvent) {
  const appCheckToken = event.request.headers.get('X-Firebase-AppCheck')
  
  if (!appCheckToken) {
    throw error(401, {
      message: 'App verification required',
      code: 'APP_CHECK_MISSING'
    })
  }
  
  try {
    const appCheckClaims = await getAppCheck().verifyToken(appCheckToken)
    
    // Token válido
    return {
      appId: appCheckClaims.app_id,
      tokenVerified: true
    }
  } catch (err) {
    throw error(403, {
      message: 'Invalid app verification token',
      code: 'APP_CHECK_INVALID'
    })
  }
}
```

---

## 🔐 Método 5: Cloudflare Turnstile (Más Simple, Gratis)

### Concepto
Similar a reCAPTCHA pero sin rastreadores de Google. Invisible para usuarios legítimos.

### ✅ Ventajas
- **Gratis ilimitado**
- Sin cookies de rastreo
- Muy fácil de implementar
- Invisible (no molesta al usuario)

---

### Implementación

#### 1. Setup en Cloudflare
1. Ir a https://dash.cloudflare.com/
2. Turnstile → Create Widget
3. Copiar Site Key y Secret Key

#### 2. Frontend
```svelte
<!-- src/lib/components/TurnstileWidget.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  
  export let onToken: (token: string) => void
  
  let widgetId: string
  
  onMount(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
    
    script.onload = () => {
      widgetId = (window as any).turnstile.render('#turnstile-container', {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        callback: onToken,
        theme: 'light',
        size: 'invisible' // No molesta al usuario
      })
    }
  })
</script>

<div id="turnstile-container"></div>
```

```typescript
// src/lib/api/client.ts
import { get } from 'svelte/store'
import { turnstileToken } from '$lib/stores/turnstile'

export async function apiCallWithTurnstile(url: string, options: RequestInit = {}) {
  const token = get(turnstileToken)
  
  if (!token) {
    throw new Error('Turnstile verification pending')
  }
  
  return fetch(url, {
    ...options,
    headers: {
      'CF-Turnstile-Token': token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}
```

#### 3. Backend - Validar Token
```typescript
// src/lib/server/middleware/turnstile.ts
import { error, type RequestEvent } from '@sveltejs/kit'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY!

export async function verifyTurnstile(event: RequestEvent) {
  const token = event.request.headers.get('CF-Turnstile-Token')
  
  if (!token) {
    throw error(401, {
      message: 'Verification required',
      code: 'TURNSTILE_MISSING'
    })
  }
  
  const ip = event.getClientAddress()
  
  // Verificar con Cloudflare
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip
      })
    }
  )
  
  const data = await response.json()
  
  if (!data.success) {
    throw error(403, {
      message: 'Verification failed',
      code: 'TURNSTILE_INVALID',
      errors: data['error-codes']
    })
  }
  
  return { verified: true, challenge_ts: data.challenge_ts }
}
```

---

## 🎯 Estrategia Recomendada (Combinada)

### Para Máxima Seguridad

```typescript
// src/hooks.server.ts - Combinación de métodos

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  
  // Endpoints públicos pero protegidos
  if (pathname.startsWith('/api/')) {
    // Capa 1: App Signature (identifica app legítima)
    await requireAppSignature(event)
    
    // Capa 2: Turnstile (verifica humano real)
    await verifyTurnstile(event)
    
    // Capa 3: Rate Limiting (previene abuso)
    await rateLimitByIP(event.getClientAddress(), 'api', {
      max: 1000,
      windowMs: 3600000
    })
  }
  
  return resolve(event)
}
```

---

## 📊 Comparación Final

| Escenario | Método Recomendado | Tiempo Setup |
|-----------|-------------------|--------------|
| **MVP / Testing** | API Key Simple | 15 min |
| **Producción Pequeña** | App Signature | 1 hora |
| **Producción Media** | App Signature + Turnstile | 2 horas |
| **Producción Grande** | Firebase App Check | 3 horas |
| **Máxima Seguridad** | Todos combinados | 1 día |

---

## ✅ Checklist de Implementación

### Fase 1: Básico (1 hora)
- [ ] Implementar App Signature (Método #2)
- [ ] Agregar middleware global en hooks.server.ts
- [ ] Actualizar cliente API en frontend
- [ ] Testing con Postman (debe fallar sin signature)

### Fase 2: Bot Protection (1 hora)
- [ ] Setup Cloudflare Turnstile
- [ ] Integrar en frontend (invisible)
- [ ] Validar en backend
- [ ] Testing automático

### Fase 3: Rate Limiting (30 min)
- [ ] Implementar rate limiting por IP
- [ ] Diferentes límites para anónimos vs autenticados
- [ ] Logging de rate limit hits

### Fase 4: Monitoring (30 min)
- [ ] Dashboard de requests fallidos
- [ ] Alertas para intentos de bypass
- [ ] Métricas de seguridad

---

## 🚨 Manejo de Errores para Usuario Final

```typescript
// Frontend - Error handling amigable
async function vote(optionId: number) {
  try {
    await secureApiCall('/api/polls/5/vote', {
      method: 'POST',
      body: JSON.stringify({ optionId, latitude: 40.4, longitude: -3.7 })
    })
  } catch (err) {
    const error = await err.response?.json()
    
    switch (error?.code) {
      case 'APP_AUTH_MISSING':
      case 'INVALID_SIGNATURE':
        alert('Por favor actualiza la app a la última versión')
        break
        
      case 'TIMESTAMP_EXPIRED':
        alert('El reloj de tu dispositivo está desincronizado. Por favor ajústalo.')
        break
        
      case 'RATE_LIMIT_EXCEEDED':
        alert(`Has alcanzado el límite. Intenta en ${error.retryAfter} segundos.`)
        break
        
      case 'TURNSTILE_INVALID':
        alert('Verificación de seguridad fallida. Intenta de nuevo.')
        break
        
      default:
        alert('Error al procesar tu voto. Intenta de nuevo.')
    }
  }
}
```

---

**¿Qué método prefieres implementar primero?**

1. **App Signature** (1 hora, muy efectivo)
2. **Turnstile** (1 hora, anti-bots)
3. **Ambos combinados** (2 horas, máxima seguridad)
