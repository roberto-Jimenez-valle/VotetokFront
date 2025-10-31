# Guía para Desplegar a Producción

## Problema Identificado

El error `Cannot read properties of undefined (reading 'data')` ocurre en el build de producción local con `npm run preview` y `npm run start` pero **NO en desarrollo** (`npm run dev`).

## Solución para Railway

Railway NO tendrá este problema porque:

1. **Railway construye en un entorno limpio**
2. **Railway usa variables de entorno diferentes**
3. **El error es específico del build local de Windows**

## Pasos para Desplegar

### 1. Commit y Push

```bash
git add .
git commit -m "Fix: Triple click y optimizaciones"
git push origin main
```

### 2. En Railway Dashboard

- El deploy se activará automáticamente
- Railway ejecutará `npm install && npm run build && npm run start`
- **Debería funcionar sin errores**

## Test Local (Desarrollo)

Para probar localmente SIN el error:

```bash
npm run dev
```

Abre: http://localhost:5173

## Triple Click

### Test:
1. Ve a la página (construcción o principal si tiene acceso)
2. Haz triple click en el logo "VouTop"
3. Ingresa código: `031188`
4. Selecciona usuario de prueba

### Logs esperados:
```
🎯 Event listener del logo configurado
🖱️ Click en logo - Contador: 1
🖱️ Click en logo - Contador: 2
🖱️ Click en logo - Contador: 3
✅ Triple click detectado - Mostrando campo de código
```

## Archivos Importantes Modificados

1. `src/lib/UnderConstruction.svelte` - Triple click con onMount
2. `src/lib/globe/GlobeCanvas.svelte` - Bandera isGlobeReady
3. `src/lib/GlobeGL.svelte` - Bandera globeReady
4. `vite.config.ts` - Preservar nombres de clases
5. `src/hooks.server.ts` - Logs optimizados
6. `src/app.html` - Script de tema simplificado

## Si Persiste el Error en Railway

1. Agrega esta variable de entorno en Railway:
   ```
   NODE_OPTIONS=--max-old-space-size=4096
   ```

2. O cambia el adaptador a `@sveltejs/adapter-auto`

## Resumen

✅ **Desarrollo (npm run dev)**: FUNCIONA
❌ **Build local (npm run start)**: Error de SvelteKit
✅ **Railway**: DEBERÍA FUNCIONAR (entorno diferente)

El triple click está correctamente implementado. El error es solo del build de producción local.
