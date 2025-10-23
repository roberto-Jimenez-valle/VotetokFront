# 🔐 Sistema de Ofuscación de Archivos TopoJSON

Este sistema dificulta el acceso directo a archivos TopoJSON reemplazando nombres predecibles con hashes **solo en producción**.

## 📝 ¿Qué hace?

### Desarrollo (nombres originales):
```
/maps/world.topojson.json       ✅ Archivos originales
/geojson/ESP/ESP.topojson       ✅ Fácil de debuggear
/geojson/USA/USA.topojson       ✅ Desarrollo rápido
```

### Producción (ofuscado automáticamente):
```
/maps/a7f9d2c1b5e8.json         🔒 Hash ofuscado
/geojson/ESP/RVNQu.json         🔒 Difícil de adivinar
/geojson/USA/VVNB.json          🔒 Protegido
```

## 🚀 Uso Automático

### ✅ Todo es Automático

**No necesitas hacer nada!** El sistema detecta automáticamente el entorno:

```bash
# Desarrollo - archivos originales
npm run dev

# Build para producción - ofuscación automática
npm run build
```

Durante el build, se ejecuta automáticamente:
1. `npm run build` → Compila la app
2. `scripts/copy-static-files.js` → Copia archivos a `build/client/`
3. `scripts/obfuscate-build-files.mjs` → **Ofusca automáticamente**

### 🔧 Cómo funciona en el código

La app usa el mapeo en `src/lib/config/file-map.ts`:

```typescript
import { FILE_MAP, getCountryPath } from '$lib/config/file-map';

// Para archivos principales
const path = FILE_MAP.getPath('maps', 'world.topojson'); 
// → '/maps/a7f9d2c1b5e8.json'

// Para países/subdivisiones
const path = getCountryPath('ESP');
// → '/geojson/ESP/RVNQu.json'

const path = getCountryPath('ESP', 'ESP.1');
// → '/geojson/ESP/RVNQLjE.json'
```

## 🔄 Workflow de Desarrollo

### Desarrollo local
```bash
npm run dev
```
- ✅ Archivos con nombres originales en `static/`
- ✅ Fácil de debuggear
- ✅ No necesitas renombrar nada

### Build para producción
```bash
npm run build
```
- ✅ Ofuscación automática en `build/client/`
- ✅ Los archivos en `static/` no se modifican
- ✅ Ready para deploy

### Deploy en Railway
1. **Commit y push (archivos originales):**
   ```bash
   git add .
   git commit -m "Update app"
   git push
   ```

2. **Railway automáticamente:**
   - `npm run build` → Compila y ofusca
   - Los archivos servidos tienen nombres hash
   - Tu código en `static/` sigue siendo legible

## 🛡️ Nivel de Seguridad

- ❌ NO es encriptación real
- ✅ Dificulta descubrimiento manual
- ✅ Nombres no son predecibles
- ✅ Protege contra scraping básico
- ⚠️  Un usuario determinado puede descubrir el patrón

## 📁 Archivos Involucrados

- **`src/lib/config/file-map.ts`** - Mapeo con detección de entorno
- **`scripts/obfuscate-build-files.mjs`** - Script automático de ofuscación
- **`scripts/copy-static-files.js`** - Copia archivos al build
- **`package.json`** - Configuración del postbuild
- **`src/routes/api/maps/world/+server.ts`** - API de mapas
- **`src/routes/api/data/answers/+server.ts`** - API de datos
- **`src/lib/GlobeGL.svelte`** - Carga de archivos en frontend

## ⚠️ Importante

- ✅ Los archivos en `static/` SIEMPRE tienen nombres originales
- ✅ Los archivos en `build/client/` se ofuscan automáticamente
- ✅ El sistema detecta el entorno (dev vs prod) automáticamente
- ✅ No necesitas configurar nada manualmente

## 🔍 Verificación

Para verificar que funciona:

```bash
# En producción, estos deberían devolver 404:
curl https://voutop.com/maps/world.topojson.json
curl https://voutop.com/geojson/ESP/ESP.topojson

# Estos deberían funcionar:
curl https://voutop.com/api/maps/world
curl https://voutop.com/api/data/world
```

La app carga todo correctamente a través de las APIs que usan el mapeo interno.
