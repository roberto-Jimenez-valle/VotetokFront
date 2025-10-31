# 🧪 Testing del Sistema de Seguridad

## ✅ Sistema Instalado Completamente

- ✅ Backend con JWT + App Signature
- ✅ Frontend actualizado con cliente API seguro
- ✅ Rate limiting configurado
- ✅ Middleware global activo

---

## 🧪 Tests de Verificación

### Test 1: Protección Funcionando ❌ (Debe Fallar desde Postman)

```bash
# Desde Postman o cURL - DEBE FALLAR
curl http://localhost:5173/api/polls/trending
```

**Resultado Esperado:**
```json
{
  "message": "App authentication required. Please use the official app.",
  "code": "APP_AUTH_MISSING"
}
```

---

### Test 2: App Funcionando ✅ (Debe Funcionar desde Navegador)

1. Inicia el servidor:
```bash
npm run dev
```

2. Abre http://localhost:5173 en tu navegador

3. Verifica que las encuestas cargan normalmente

**Resultado Esperado:**
- Globo muestra encuestas
- No hay errores en consola
- Todo funciona como antes

---

### Test 3: Rate Limiting ⏱️

Intenta hacer 101 requests rápidos desde la consola del navegador:

```javascript
for (let i = 0; i < 101; i++) {
  fetch('/api/polls/trending')
    .then(r => r.json())
    .then(d => console.log(`Request ${i}:`, d))
    .catch(e => console.error(`Request ${i} failed:`, e))
}
```

**Resultado Esperado:**
- Primeros 100: ✅ Funcionan
- Request 101: ❌ Error 429 "Rate limit exceeded"

---

### Test 4: Login (Si tienes endpoint de auth)

```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'demo@voutop.com',
    password: 'test123'
  })
})

const result = await response.json()
console.log('Login result:', result)
// Debe retornar: { accessToken: "...", user: {...} }
```

---

## 🐛 Si Algo Falla

### Error: "Cannot find module 'jose'"
```bash
npm install jose
```

### Error: "APP_AUTH_MISSING" en tu app
**Causa**: Cliente API no está funcionando

**Solución**:
1. Verifica que los archivos tienen el import correcto
2. Reinicia el servidor: `Ctrl+C` y luego `npm run dev`
3. Limpia caché del navegador: `Ctrl+Shift+Del`

### Error: "INVALID_SIGNATURE"
**Causa**: Secrets no coinciden

**Solución**:
1. Verifica `.env`:
   ```bash
   cat .env | grep SECRET
   ```
2. Asegúrate que `APP_SECRET` y `VITE_APP_SECRET` son iguales
3. Reinicia servidor

### Error: "TIMESTAMP_EXPIRED"
**Causa**: Reloj del sistema desincronizado

**Solución**:
1. Sincroniza la hora de tu sistema
2. O aumenta `TIMESTAMP_TOLERANCE` en `src/lib/server/auth/signature.ts` (solo para desarrollo)

---

## 📊 Endpoints Protegidos

| Endpoint | App Signature | JWT | Rate Limit |
|----------|---------------|-----|------------|
| `/api/polls/*` | ✅ | - | 1000/h (anónimo) |
| `/api/geocode` | ✅ | - | 50/h |
| `/api/users/trending` | ✅ | - | 1000/h |
| `/api/users/with-activity` | ✅ | - | 1000/h |
| `POST /api/polls` | ✅ | ✅ | 20/día |
| `/api/auth/login` | ✅ | - | 5/15min |
| `/api/auth/register` | ✅ | - | 3/hora |

---

## ✅ Checklist Final

- [ ] `npm run dev` inicia sin errores
- [ ] Navegador carga la app correctamente
- [ ] Postman/cURL fallan con "APP_AUTH_MISSING"
- [ ] Consola sin errores de red
- [ ] Encuestas se cargan en el globo
- [ ] Rate limiting funciona después de 100 requests

---

## 🎉 ¡Listo!

Tu app ahora tiene:
- ✅ **Endpoints públicos protegidos** (solo desde tu app)
- ✅ **Sistema JWT** para autenticación
- ✅ **Rate limiting inteligente**
- ✅ **Logging automático**
- ✅ **Manejo de errores robusto**

**Siguiente paso recomendado**: Implementar login/registro completo con password hashing (bcrypt/argon2).

Ver `SECURITY_SETUP_GUIDE.md` para más detalles.
