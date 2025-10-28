# 🧪 Testing del Sistema de Proxy de Medios

## ✅ Verificación Rápida

El sistema de proxy **ya está integrado** en CreatePollModal. Cuando pegues URLs en el título o en las opciones, automáticamente se usará el proxy para las imágenes.

---

## 🔧 Comandos de Testing (Windows PowerShell)

### 1. Iniciar el servidor de desarrollo

```powershell
npm run dev
```

Espera a que aparezca: `Local: http://localhost:5173/`

---

### 2. Probar el Proxy (en otra terminal)

```powershell
# Test básico - Imagen de Picsum (debería funcionar)
Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200" -Method Head | Select-Object StatusCode, Headers

# Test con imagen de Imgur (usando el proxy)
Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://i.imgur.com/5LxJr0n.jpg" -Method Head | Select-Object StatusCode, Headers

# Test de seguridad - dominio NO permitido (debe fallar con 403)
Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://malicious-site.com/evil.jpg" -Method Head -ErrorAction SilentlyContinue | Select-Object StatusCode
```

### 3. Verificar Caché

```powershell
# Primera llamada (debe dar X-Cache: MISS)
$response1 = Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://picsum.photos/300" -Method Head
$response1.Headers.'X-Cache'

# Segunda llamada (debe dar X-Cache: HIT)
$response2 = Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://picsum.photos/300" -Method Head
$response2.Headers.'X-Cache'
```

### 4. Validar iframe de YouTube

```powershell
$body = @{
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5173/api/validate-iframe" -Method Post -Body $body -ContentType "application/json"
```

---

## 🎨 Testing Manual en la UI

### Crear Encuesta con Imagen

1. **Abre la aplicación**: `http://localhost:5173`
2. **Click en "Crear Encuesta"** (botón + en la esquina)
3. **Pega una URL de imagen** en el título o descripción:

```
Elige tu favorito https://i.imgur.com/5LxJr0n.jpg
```

4. **Verifica que aparece el preview** de la imagen
5. **Abre las DevTools** (F12) → pestaña Network
6. **Busca la request** a `/api/media-proxy`
7. **Verifica** que tiene status 200 y headers correctos

### URLs de Prueba

```
# Imgur
https://i.imgur.com/5LxJr0n.jpg

# Flickr
https://live.staticflickr.com/65535/53869413880_c58a2d78ba_b.jpg

# Unsplash
https://images.unsplash.com/photo-1506905925346-21bda4d32df4

# Wikimedia
https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/800px-Cat03.jpg

# YouTube (embed automático)
https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Picsum (no necesita proxy)
https://picsum.photos/200
```

### Crear Encuesta con Opciones con Imágenes

1. **Agrega 2-3 opciones**
2. **En cada opción**, pega una URL diferente:
   - Opción 1: `Gato https://picsum.photos/200`
   - Opción 2: `Perro https://i.imgur.com/abc.jpg`
   - Opción 3: `Loro https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/800px-Cat03.jpg`

3. **Verifica los previews** de cada opción
4. **Crea la encuesta** y verifica que se guarda correctamente

---

## 🔍 Debugging

### Ver Logs en Consola del Navegador

Abre DevTools (F12) → Console, deberías ver:

```
[MediaEmbed] Procesando URL: https://i.imgur.com/abc.jpg
[MediaEmbed] Detectada imagen directa
```

### Ver Logs del Servidor

En la terminal donde ejecutaste `npm run dev`:

```
[Media Proxy] Fetching: https://i.imgur.com/abc.jpg
[Media Proxy] Success: https://i.imgur.com/abc.jpg (234567 bytes)
[Media Proxy] Cache hit: https://picsum.photos/200
```

### Verificar Headers de la Respuesta

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200"

# Ver todos los headers
$response.Headers

# Headers específicos
$response.Headers.'Content-Type'       # Debe ser image/jpeg o similar
$response.Headers.'Cache-Control'      # Debe ser public, max-age=604800
$response.Headers.'X-Cache'            # MISS o HIT
$response.Headers.'Access-Control-Allow-Origin'  # Debe ser *
```

---

## 🐛 Solución de Problemas

### Problema: "No se encuentra el término 'curl'"

**Causa**: Windows PowerShell no tiene `curl` por defecto.

**Solución**: Usar `Invoke-WebRequest` (ya incluido en los comandos arriba)

---

### Problema: Imágenes no cargan en el preview

**Verificación**:

1. Abre DevTools (F12) → Network
2. Filtra por "media-proxy"
3. Mira el status code:
   - **200 OK**: ✅ Funciona
   - **403 Forbidden**: ⚠️ Dominio no permitido
   - **504 Timeout**: ⚠️ El servidor externo está lento
   - **415 Unsupported Media Type**: ⚠️ No es una imagen válida

**Solución para 403**:
1. Agrega el dominio a `src/lib/server/media-proxy-config.ts`
2. Reinicia el servidor (`npm run dev`)

---

### Problema: "CORS error" en consola

**Causa**: Estás intentando cargar la imagen directamente sin proxy

**Verificación**:
- Verifica que MediaEmbed esté usando `/api/media-proxy?url=...`
- NO debe cargar la URL externa directamente

**Solución**: Ya está implementado en `MediaEmbed.svelte` con la función `getProxiedImageUrl()`

---

### Problema: Caché no funciona

**Verificación**:
```powershell
# Primera llamada
$response1 = Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200" -Method Head
$response1.Headers.'X-Cache'  # Debe ser "MISS"

# Segunda llamada (misma URL)
$response2 = Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200" -Method Head
$response2.Headers.'X-Cache'  # Debe ser "HIT"
```

**Causa**: La URL debe ser **exactamente igual** (incluyendo query params)

---

## ✅ Checklist de Funcionalidad

### Backend
- [ ] `/api/media-proxy` responde con 200 para dominios permitidos
- [ ] `/api/media-proxy` responde con 403 para dominios no permitidos
- [ ] Caché funciona (X-Cache: HIT en segunda llamada)
- [ ] `/api/validate-iframe` valida URLs de YouTube correctamente
- [ ] Timeout funciona (max 8 segundos)

### Frontend
- [ ] Preview de imagen aparece en título de encuesta
- [ ] Preview de imagen aparece en opciones
- [ ] Imágenes de Imgur funcionan
- [ ] Imágenes de Flickr funcionan
- [ ] Imágenes de Unsplash funcionan
- [ ] Imágenes de Wikimedia funcionan
- [ ] Placeholders (ui-avatars, placehold.co) funcionan sin proxy
- [ ] Video embeds de YouTube funcionan

### Seguridad
- [ ] Solo HTTPS permitido
- [ ] Dominios maliciosos bloqueados (403)
- [ ] Tamaño máximo respetado (10MB)
- [ ] Content-Type validado
- [ ] XSS prevenir en iframes

---

## 📊 Resultados Esperados

### Test 1: Imagen de Imgur
```powershell
Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://i.imgur.com/5LxJr0n.jpg" -Method Head
```

**Resultado esperado**:
```
StatusCode: 200
Content-Type: image/jpeg
Cache-Control: public, max-age=604800
X-Cache: MISS (primera vez) o HIT (segunda vez)
Access-Control-Allow-Origin: *
```

### Test 2: Dominio no permitido
```powershell
Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://evil.com/malware.jpg" -Method Head -ErrorAction SilentlyContinue
```

**Resultado esperado**:
```
StatusCode: 403
Error: Dominio no permitido
```

### Test 3: Validación iframe
```powershell
$body = @{ url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5173/api/validate-iframe" -Method Post -Body $body -ContentType "application/json"
```

**Resultado esperado**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "sanitizedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "platform": "youtube",
    "attributes": { ... }
  }
}
```

---

## 🚀 Todo Funcionando

Si todos los tests pasan:

✅ El proxy de medios está funcionando correctamente  
✅ Las imágenes externas cargan sin errores CORS  
✅ El caché mejora el rendimiento  
✅ La seguridad previene dominios maliciosos  
✅ Los previews en CreatePollModal funcionan  

**¡Tu sistema está listo para producción!** 🎉

---

## 📞 Ayuda Adicional

- **Documentación completa**: Ver `MEDIA_PROXY_GUIDE.md`
- **Quick start**: Ver `MEDIA_PROXY_QUICKSTART.md`
- **Resumen**: Ver `MEDIA_PROXY_README.md`

---

**Última actualización**: Octubre 2024
