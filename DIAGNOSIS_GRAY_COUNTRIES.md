# 🔍 Diagnóstico: Países Grises en el Globo

**Fecha:** 3 Nov 2025, 10:20 PM  
**Problema:** Algunos países salen grises aunque tienen votos nivel 3

---

## ✅ VERIFICACIÓN BACKEND

### 1. Subdivisiones Nivel 3
```
Total: 45,488 subdivisiones nivel 3
Con votos: 45,488 (100.00%)
Sin votos: 0 (0.00%)
```
✅ **TODAS las subdivisiones tienen votos**

### 2. Países con Votos
```
Total de países: 170
Con votos: 170 (100%)
Sin votos: 0 (0%)
```
✅ **TODOS los países tienen votos**

### 3. API Endpoint `/api/polls/{id}/votes-by-country`
```
Encuesta #157 retorna: 169 países con votos
```
✅ **El backend funciona correctamente**

---

## ❌ PROBLEMA IDENTIFICADO

El problema está en el **FRONTEND** - específicamente en cómo `computeGlobeViewModel` hace match entre:

**answersData keys:**
```javascript
{
  "ESP": { "poll_125": 150, "poll_126": 200 },
  "USA": { "poll_125": 300, "poll_126": 250 },
  "BRA": { "poll_125": 400, "poll_126": 350 }
}
```

**worldPolygons properties:**
```javascript
{
  properties: {
    ISO_A3: "ESP",    // ← Debe coincidir
    ADM0_A3: "ESP",
    SOV_A3: "ESP",
    NAME: "Spain"
  }
}
```

---

## 🐛 CAUSA RAÍZ

`computeGlobeViewModel` en `globeDataProc.ts` usa la función `getFeatureId()` para extraer el ID del polígono.

**Para países (nivel mundial):**
```typescript
// globeDataProc.ts
function getFeatureId(feature) {
  const props = feature.properties;
  
  // Nivel país (mundial)
  if (props.ISO_A3) return props.ISO_A3;
  if (props.iso_a3) return props.iso_a3;
  if (props.ADM0_A3) return props.ADM0_A3;
  // ...
}
```

**Problema potencial:**
- Si el TopoJSON usa `ADM0_A3` en lugar de `ISO_A3`
- Si hay inconsistencias en mayúsculas/minúsculas
- Si algunos países no tienen estas propiedades

---

## 🔍 PAÍSES QUE SALEN GRISES (de la imagen)

Observando la imagen, los países grises incluyen:
- 🇬🇱 **Groenlandia (GRL)** - Territorio danés
- 🌍 **Varios países africanos**
- 🏝️ **Países de Oceanía pequeños**
- ❄️ **Antártida (ATA)**

---

## 💡 POSIBLES CAUSAS

### 1. TopoJSON con Propiedades Inconsistentes
Algunos archivos TopoJSON usan:
- `ADM0_A3` en lugar de `ISO_A3`
- `ADMIN` en lugar de `NAME`
- Códigos diferentes (ej: `-99` para territorios sin país)

### 2. Territorios Especiales
- **Groenlandia (GRL)**: ¿Usa `DNK` (Dinamarca)?
- **Puerto Rico**: ¿Usa `USA` o `PRI`?
- **Territorios de Francia**: ¿Usan `FRA` o códigos propios?

### 3. Match Case-Sensitive
```javascript
answersData: { "ESP": {...} }  // Mayúsculas
polygon: { ISO_A3: "esp" }     // Minúsculas
// ❌ No coincide!
```

---

## 🔧 SOLUCIÓN PROPUESTA

### Opción 1: Debug en el Frontend

Agregar logs en `computeGlobeViewModel`:

```typescript
console.log('[computeGlobeViewModel] Procesando', features.length, 'polígonos');
console.log('[computeGlobeViewModel] answersData keys:', Object.keys(answersData));

for (const feature of features) {
  const id = getFeatureId(feature);
  const hasData = !!answersData[id];
  
  if (!hasData) {
    console.log('[Missing Data] País sin datos:', id, feature.properties);
  }
}
```

### Opción 2: Normalizar IDs

En `PollDataService.ts`, normalizar las claves:

```typescript
// Asegurar mayúsculas
const countryIso = vote.subdivision.subdivisionId
  .split('.')[0]
  .toUpperCase();
```

### Opción 3: Fallback en getFeatureId

```typescript
function getFeatureId(feature) {
  const props = feature.properties;
  
  // Probar todas las variantes comunes
  let id = props.ISO_A3 || props.iso_a3 || 
           props.ADM0_A3 || props.adm0_a3 ||
           props.ISO3 || props.iso3 ||
           props.SOV_A3 || props.sov_a3;
  
  // Normalizar a mayúsculas
  return id ? String(id).toUpperCase() : null;
}
```

---

## 🧪 SIGUIENTE PASO

**Agregar logs detallados en el frontend:**

1. Abrir DevTools en el navegador
2. Recargar la página
3. Buscar en consola:
   - `[computeGlobeViewModel]` - Ver qué IDs procesa
   - `[Missing Data]` - Ver qué países no encuentran datos

4. Verificar:
   - ¿`answersData` tiene 169 claves?
   - ¿Los IDs coinciden exactamente?
   - ¿Hay países con datos que salen grises?

---

## 📊 EXPECTATIVA

**Si el fix funciona:**
```
169 países con votos → 169 países coloreados ✅
1 país sin votos (ej: Antártida) → 1 país gris ✅
```

**Si aún hay grises:**
- Problema de matching de IDs
- TopoJSON corrupto o incompleto
- Propiedades faltantes

---

## ✅ CONCLUSIÓN PRELIMINAR

El backend está **perfecto** - todos los países tienen votos nivel 3 agregados correctamente.

El problema está en cómo el **frontend hace match** entre:
- `answersData` keys (ESP, USA, BRA)
- `worldPolygons` properties (ISO_A3, ADM0_A3, etc.)

**Necesitamos agregar logs en el frontend para confirmar.**

---

*Diagnóstico completado - Siguiente: Debug en navegador*
