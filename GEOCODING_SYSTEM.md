# 🌍 Sistema de Geocodificación para Votos

## 🎯 Objetivo

Cuando un usuario vota, el sistema debe **detectar automáticamente** su ubicación geográfica hasta el nivel más granular posible (nivel 3: municipio/ciudad).

## 📊 Niveles de Subdivisión

```
Nivel 0: País (ESP, USA, ARG)
  ↓
Nivel 1: Comunidad/Estado (ESP.1 = Andalucía, USA.CA = California)
  ↓
Nivel 2: Provincia/Condado (ESP.1.2 = Sevilla, USA.CA.001 = Alameda County)
  ↓
Nivel 3: Municipio/Ciudad (ESP.1.2.3 = Dos Hermanas)
```

## 🔄 Flujo de Votación

### 1. Usuario Hace Click en "Votar"

```javascript
// Frontend (BottomSheet.svelte o GlobeGL.svelte)
// El usuario hace click en una opción de voto
```

### 2. Obtener Geolocalización del Usuario

```javascript
// Frontend obtiene lat/lng del navegador
navigator.geolocation.getCurrentPosition((position) => {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  
  // Continuar con geocodificación...
});
```

### 3. Llamar a API de Geocodificación

```javascript
// Frontend llama al endpoint de geocoding
const response = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
const geocodeData = await response.json();

// Respuesta esperada:
// {
//   found: true,
//   countryIso3: "ESP",
//   countryName: "España",
//   subdivisionId: "ESP.1.2",     // ← Nivel 3 (o 2, o 1 según disponibilidad)
//   subdivisionName: "Sevilla",
//   subdivisionLevel: 2            // ← Indica qué nivel se encontró
// }
```

### 4. Enviar Voto con Datos Geocodificados

```javascript
// Frontend envía voto al backend
const voteResponse = await fetch(`/api/polls/${pollId}/vote`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    optionId: selectedOptionId,
    userId: currentUser?.id || null,
    latitude: latitude,
    longitude: longitude,
    countryIso3: geocodeData.countryIso3,
    countryName: geocodeData.countryName,
    subdivisionId: geocodeData.subdivisionId,  // ← ESP.1.2 (nivel 3)
    subdivisionName: geocodeData.subdivisionName,
    cityName: geocodeData.subdivisionName      // Opcional
  })
});
```

### 5. Backend Guarda Voto en BD

```typescript
// Backend (vote/+server.ts)
// Guarda el voto con subdivisionId granular
await prisma.vote.create({
  data: {
    pollId,
    optionId,
    userId,
    latitude,
    longitude,
    countryIso3,
    subdivisionId,  // ← "ESP.1.2" se guarda aquí
    subdivisionName
  }
});
```

## 🔍 Endpoint de Geocodificación

### GET `/api/geocode?lat=40.4168&lon=-3.7038`

**Algoritmo:**

1. Encuentra el país más cercano por distancia euclidiana
2. Busca la subdivisión de **nivel 3** más cercana en ese país
3. Si no hay nivel 3, busca **nivel 2**
4. Si no hay nivel 2, busca **nivel 1**
5. Retorna el nivel más granular encontrado

**Query SQL Ejemplo (Nivel 3):**

```sql
SELECT 
  id, subdivision_id, name, level, 
  latitude, longitude,
  ((latitude - lat)² + (longitude - lon)²) as distance
FROM subdivisions
WHERE level = 3 AND country_id = ?
ORDER BY distance
LIMIT 1
```

**Respuesta:**

```json
{
  "found": true,
  "countryIso3": "ESP",
  "countryName": "España",
  "subdivisionId": "ESP.1.2",
  "subdivisionName": "Sevilla",
  "subdivisionLevel": 2
}
```

## 📍 Formato de SubdivisionId

Los `subdivisionId` tienen formato jerárquico:

```
ESP.1       → Nivel 1: Andalucía
ESP.1.2     → Nivel 2: Sevilla (dentro de Andalucía)
ESP.1.2.3   → Nivel 3: Dos Hermanas (dentro de Sevilla)

USA.CA      → Nivel 1: California
USA.CA.001  → Nivel 2: Alameda County (dentro de California)
```

**Ventajas del formato jerárquico:**
- Fácil extracción de niveles superiores
- Queries eficientes con `LIKE 'ESP.1.%'`
- Relaciones padre-hijo implícitas en el ID

## 🗄️ Tabla Subdivisions

```prisma
model Subdivision {
  id              Int      @id @default(autoincrement())
  
  // Jerarquía
  countryId       Int
  subdivisionId   String   @unique  // "ESP.1.2.3"
  level           Int                // 1, 2, o 3
  parentId        Int?               // FK a subdivision padre
  
  // IDs de cada nivel
  level1Id        String?            // "1"
  level2Id        String?            // "2"
  level3Id        String?            // "3"
  
  // Nombres
  name            String             // "Sevilla"
  nameLocal       String?
  
  // Geolocalización
  latitude        Float
  longitude       Float
  
  // Relaciones
  country         Country  @relation(...)
  parent          Subdivision? @relation(...)
  children        Subdivision[] @relation(...)
}
```

## ✅ Verificación del Sistema

### Verificar que hay datos de nivel 3:

```bash
npm run db:verify-subdivisions
```

Este script verifica:
- ✅ Cantidad de subdivisiones por nivel
- ✅ Ejemplos de cada nivel
- ✅ Prueba de geocodificación
- ✅ Jerarquía correcta

### Ejemplo de salida esperada:

```
📊 Contando subdivisiones por nivel...

  Nivel 1 (Estados/Comunidades): 52
  Nivel 2 (Provincias/Condados): 450
  Nivel 3 (Municipios/Ciudades): 8125

✅ Hay subdivisiones en los 3 niveles

📋 Ejemplos de subdivisiones por nivel...

  Ejemplos Nivel 1:
    - ESP.1 = Andalucía (España)
    - ESP.7 = Cataluña (España)
    - USA.CA = California (United States)

  Ejemplos Nivel 2:
    - ESP.1.2 = Sevilla (España)
    - ESP.7.8 = Barcelona (España)
    - USA.CA.001 = Alameda County (United States)

  Ejemplos Nivel 3:
    - ESP.1.2.3 = Dos Hermanas (España)
    - ESP.7.8.5 = Hospitalet de Llobregat (España)

🎯 CONCLUSIÓN: El geocoding puede retornar subdivisiones de nivel 3
   Los votos se guardarán con subdivisionId granular (ej: ESP.1.2)
```

## 🔧 Poblando Datos de Subdivisiones

Si no tienes datos de nivel 3, necesitas poblar la tabla `subdivisions`.

### Fuentes de datos recomendadas:

1. **Natural Earth Data** - https://www.naturalearthdata.com/
2. **OSM Nominatim** - https://nominatim.openstreetmap.org/
3. **GeoNames** - https://www.geonames.org/

### Script de seed (ejemplo):

```typescript
// prisma/seed-subdivisions.ts
const subdivisions = [
  {
    countryId: 1, // España
    subdivisionId: 'ESP.1.2.3',
    level: 3,
    parentId: 123, // ESP.1.2
    level1Id: '1',
    level2Id: '2',
    level3Id: '3',
    name: 'Dos Hermanas',
    latitude: 37.2828,
    longitude: -5.9208
  },
  // ... más subdivisiones
];

await prisma.subdivision.createMany({ data: subdivisions });
```

## 🎯 Resultado Final

Con este sistema, cuando un usuario en **Dos Hermanas, Sevilla, Andalucía, España** vota:

```json
{
  "pollId": 123,
  "optionId": 456,
  "latitude": 37.2828,
  "longitude": -5.9208,
  "countryIso3": "ESP",
  "subdivisionId": "ESP.1.2.3",  // ← Nivel 3 granular
  "subdivisionName": "Dos Hermanas"
}
```

Luego puedes:
- Ver votos por municipio: `WHERE subdivisionId = 'ESP.1.2.3'`
- Ver votos por provincia: `WHERE subdivisionId LIKE 'ESP.1.2.%'`
- Ver votos por comunidad: `WHERE subdivisionId LIKE 'ESP.1.%'`
- Ver votos por país: `WHERE countryIso3 = 'ESP'`

## 📚 Archivos Relacionados

- **`/api/geocode`** - Endpoint de geocodificación
- **`/api/polls/[id]/vote`** - Endpoint de votación
- **`scripts/verify-subdivision-levels.ts`** - Script de verificación
- **`prisma/schema.prisma`** - Modelo de datos

## 🚀 Testing

### Probar geocodificación:

```bash
curl "http://localhost:5173/api/geocode?lat=40.4168&lon=-3.7038"
```

### Probar voto completo:

```bash
# 1. Geocodificar
curl "http://localhost:5173/api/geocode?lat=40.4168&lon=-3.7038"

# 2. Votar con datos geocodificados
curl -X POST "http://localhost:5173/api/polls/1/vote" \
  -H "Content-Type: application/json" \
  -d '{
    "optionId": 1,
    "latitude": 40.4168,
    "longitude": -3.7038,
    "countryIso3": "ESP",
    "subdivisionId": "ESP.13.28.079",
    "subdivisionName": "Madrid"
  }'
```

---

**🎉 Sistema completamente funcional para detectar automáticamente la ubicación geográfica granular del votante.**
