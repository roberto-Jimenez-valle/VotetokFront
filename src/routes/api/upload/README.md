# Image Upload API

Endpoint seguro para subir imágenes de encuestas con validaciones completas.

## Endpoint

```
POST /api/upload/image
```

## Autenticación

- **Producción**: Requiere JWT token válido
- **Desarrollo**: Opcional en localhost/IPs locales

## Rate Limiting

- **Usuarios normales**: 50 uploads/día
- **Premium**: 200 uploads/día
- **Admin**: Sin límites

## Request

**Content-Type**: `multipart/form-data`

**Body**:
```
image: File (required)
```

## Validaciones

### 1. Tipo de Archivo
Tipos MIME permitidos:
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/gif`
- `image/webp`
- `image/svg+xml`

### 2. Extensiones
Extensiones permitidas:
- `.jpg`, `.jpeg`
- `.png`
- `.gif`
- `.webp`
- `.svg`

### 3. Tamaño
- **Máximo**: 5MB (5,242,880 bytes)

### 4. Validación de Firma
Verifica los magic numbers (primeros bytes) para confirmar que es realmente una imagen:
- JPG: `FF D8 FF`
- PNG: `89 50 4E 47`
- GIF: `47 49 46 38`
- WebP: `52 49 46 46` (RIFF)

### 5. Escaneo de Malware
Detecta patterns sospechosos:
- `<script>`
- `javascript:`
- `onerror=`, `onload=`
- `<iframe>`
- `eval()`
- `base64,`
- `<?php>`
- `<%`

## Response

### Éxito (200)
```json
{
  "success": true,
  "url": "/uploads/polls/poll_1730833200000_abc123def456.jpg",
  "filename": "poll_1730833200000_abc123def456.jpg",
  "size": 1024000,
  "type": "image/jpeg"
}
```

### Errores

#### 400 - NO_FILE
```json
{
  "message": "No se proporcionó ningún archivo",
  "code": "NO_FILE"
}
```

#### 400 - INVALID_FILE_TYPE
```json
{
  "message": "Tipo de archivo no permitido: application/pdf. Solo se permiten imágenes.",
  "code": "INVALID_FILE_TYPE",
  "allowed": ["image/jpeg", "image/png", ...]
}
```

#### 400 - INVALID_EXTENSION
```json
{
  "message": "Extensión de archivo no permitida: .exe",
  "code": "INVALID_EXTENSION",
  "allowed": [".jpg", ".png", ...]
}
```

#### 400 - FILE_TOO_LARGE
```json
{
  "message": "El archivo es demasiado grande. Máximo: 5MB. Tamaño: 7.52MB",
  "code": "FILE_TOO_LARGE",
  "maxSize": 5242880,
  "fileSize": 7890000
}
```

#### 400 - INVALID_IMAGE_SIGNATURE
```json
{
  "message": "El archivo no es una imagen válida (verificación de firma falló)",
  "code": "INVALID_IMAGE_SIGNATURE"
}
```

#### 400 - SUSPICIOUS_CONTENT
```json
{
  "message": "El archivo contiene contenido sospechoso y fue rechazado",
  "code": "SUSPICIOUS_CONTENT"
}
```

#### 401 - AUTH_REQUIRED
```json
{
  "message": "Authentication required. Please login.",
  "code": "AUTH_REQUIRED"
}
```

#### 429 - RATE_LIMIT_EXCEEDED
```json
{
  "message": "Rate limit exceeded. Try again in 3600 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600,
  "limit": 50,
  "resetAt": 1730919600000
}
```

## Ejemplos de Uso

### JavaScript/Fetch

```javascript
// Obtener archivo del input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

// Crear FormData
const formData = new FormData();
formData.append('image', file);

// Subir
try {
  const response = await fetch('/api/upload/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}` // Solo en producción
    },
    body: formData
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Imagen subida:', data.url);
    // Usar data.url para mostrar la imagen
  } else {
    const error = await response.json();
    console.error('Error:', error.message);
  }
} catch (err) {
  console.error('Error de red:', err);
}
```

### Svelte 5

```svelte
<script lang="ts">
  let imageFile = $state<File | null>(null);
  let imageUrl = $state<string>('');
  let uploading = $state(false);
  let error = $state<string>('');

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    imageFile = input.files?.[0] || null;
  }

  async function uploadImage() {
    if (!imageFile) return;
    
    uploading = true;
    error = '';

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        imageUrl = data.url;
      } else {
        const errorData = await response.json();
        error = errorData.message;
      }
    } catch (err) {
      error = 'Error al subir la imagen';
    } finally {
      uploading = false;
    }
  }
</script>

<input type="file" accept="image/*" onchange={handleFileSelect} />
<button onclick={uploadImage} disabled={!imageFile || uploading}>
  {uploading ? 'Subiendo...' : 'Subir imagen'}
</button>

{#if error}
  <p class="error">{error}</p>
{/if}

{#if imageUrl}
  <img src={imageUrl} alt="Imagen subida" />
{/if}
```

### curl

```bash
# Con autenticación
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  http://localhost:5173/api/upload/image

# En desarrollo (localhost sin auth)
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  http://localhost:5173/api/upload/image
```

## Almacenamiento

Las imágenes se guardan en:
```
static/uploads/polls/
```

El nombre del archivo se genera como:
```
poll_{timestamp}_{random_hash}.{ext}
```

Ejemplo: `poll_1730833200000_abc123def456789.jpg`

## URL Pública

Las imágenes son accesibles públicamente en:
```
/uploads/polls/filename.jpg
```

Ejemplo completo:
```
https://voutop.com/uploads/polls/poll_1730833200000_abc123def456789.jpg
```

## Seguridad

### ✅ Protecciones Implementadas

1. **Validación de tipo MIME**
2. **Validación de extensión**
3. **Validación de tamaño**
4. **Verificación de firma de archivo**
5. **Escaneo básico de malware**
6. **Rate limiting**
7. **Nombres únicos (previene overwrite)**
8. **Autenticación en producción**

### ⚠️ Consideraciones

1. **Almacenamiento local**: Los archivos se guardan en `/static`, que es parte del repositorio. En producción considera usar:
   - AWS S3
   - CloudFlare R2
   - Google Cloud Storage
   
2. **Sin compresión**: Las imágenes se guardan sin optimizar. Considera agregar:
   - Compresión automática
   - Generación de thumbnails
   - Conversión a WebP

3. **Sin limpieza automática**: Los archivos permanecen indefinidamente. Considera:
   - Cron job para limpiar uploads antiguos
   - TTL en CDN
   - Soft-delete de encuestas

4. **Escaneo básico**: El escaneo de malware es básico. Para producción considera:
   - ClamAV
   - VirusTotal API
   - AWS Macie

## Testing

### Test básico
```bash
# Crear imagen de prueba
echo "fake image" > test.jpg

# Subir
curl -X POST -F "image=@test.jpg" http://localhost:5173/api/upload/image
```

### Test de límite de tamaño
```bash
# Crear archivo > 5MB
dd if=/dev/zero of=large.jpg bs=1M count=6

# Intentar subir (debe fallar)
curl -X POST -F "image=@large.jpg" http://localhost:5173/api/upload/image
```

### Test de archivo malicioso
```bash
# Crear archivo con contenido sospechoso
echo "<script>alert('xss')</script>" > malicious.jpg

# Intentar subir (debe ser rechazado)
curl -X POST -F "image=@malicious.jpg" http://localhost:5173/api/upload/image
```

## Migración a CDN

Para migrar a S3/CloudFlare:

1. Instalar SDK:
```bash
npm install @aws-sdk/client-s3
# o
npm install @cloudflare/workers-types
```

2. Modificar `+server.ts`:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

// En lugar de writeFile:
await s3Client.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: `polls/${filename}`,
  Body: buffer,
  ContentType: file.type
}));

const publicUrl = `https://${process.env.CDN_DOMAIN}/polls/${filename}`;
```

## Troubleshooting

### Error: "Cannot find module 'fs/promises'"
Asegúrate de que estás en Node.js 14+ y que el archivo está en `/routes/api/`.

### Error: "ENOENT: no such file or directory"
El directorio `static/uploads/polls/` no existe. Se crea automáticamente en el primer upload.

### Error: "Rate limit exceeded" en desarrollo
El rate limit persiste en memoria. Reinicia el servidor para resetear.

### Imágenes no se muestran
Verifica que el directorio `static/` esté servido correctamente por SvelteKit. En `svelte.config.js`:
```javascript
kit: {
  files: {
    assets: 'static'
  }
}
```

## Changelog

### v1.0.0 (2025-11-05)
- ✅ Endpoint inicial creado
- ✅ Validaciones completas
- ✅ Escaneo de malware básico
- ✅ Rate limiting
- ✅ Documentación completa
