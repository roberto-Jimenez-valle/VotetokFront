# 🗳️ Script de Votos Nivel 3

**Archivo:** `scripts/seed-level3-votes.ts`

---

## 📋 QUÉ HACE

Este script:

1. ✅ **Elimina TODOS los votos actuales** de la base de datos
2. ✅ **Consulta subdivisiones de nivel 3** (ESP.1.2.3, IND.4.5, CHN.17.2, etc.)
3. ✅ **Crea votos realistas** solo en subdivisiones nivel 3
4. ✅ **Distribución inteligente:**
   - 30-70% de subdivisiones participan por encuesta
   - 1-20 votos por subdivisión
   - Distribuciones realistas entre opciones
   - Variación geográfica dentro de cada subdivisión

---

## 🚀 CÓMO USAR

### Paso 1: Asegúrate de tener subdivisiones nivel 3

```bash
# Verificar si hay subdivisiones nivel 3
npx prisma studio
# Ir a tabla "subdivisions" y filtrar por level = 3
```

Si no hay subdivisiones nivel 3, necesitas ejecutar primero los scripts de extracción.

### Paso 2: Ejecutar el script

```bash
npx tsx scripts/seed-level3-votes.ts
```

### Paso 3: Verificar

```bash
# Ver votos creados
npx prisma studio
# Tabla "votes" → Debería tener miles de votos
```

---

## 📊 EJEMPLO DE SALIDA

```
🚀 Iniciando seed de votos nivel 3...

🗑️  Paso 1: Eliminando votos actuales...
   ✅ 1,234 votos eliminados

📊 Paso 2: Obteniendo subdivisiones de nivel 3...
   ✅ 856 subdivisiones nivel 3 encontradas

   📍 Países con subdivisiones nivel 3: 12
      ESP: 142 subdivisiones
      USA: 234 subdivisiones
      IND: 156 subdivisiones
      CHN: 98 subdivisiones
      ...

📋 Paso 3: Obteniendo encuestas activas...
   ✅ 20 encuestas activas encontradas

🗳️  Paso 4: Creando votos en subdivisiones nivel 3...

   📊 Encuesta #125: ¿Cuál es tu framework favorito?
      Opciones: 4
      🎯 Subdivisiones participantes: 342 (40%)
      📈 Votos totales: 1,245
      📊 Distribución: 45.0% / 30.0% / 15.0% / 10.0%
      ✅ Votos creados: 1,245
      📊 Distribución final por opción:
         React: 560 votos (45.0%)
         Vue: 374 votos (30.0%)
         Svelte: 187 votos (15.0%)
         Angular: 124 votos (10.0%)

   ... (más encuestas)

============================================================
✨ SEED COMPLETADO

📊 Estadísticas:
   - Subdivisiones nivel 3: 856
   - Países con datos: 12
   - Encuestas procesadas: 20
   - Votos totales creados: 18,543
   - Promedio por encuesta: 927
============================================================

📍 Votos por país (nivel 3):
   ESP: 3,245 votos
   USA: 4,123 votos
   IND: 2,876 votos
   CHN: 2,345 votos
   ...
```

---

## 🎯 CARACTERÍSTICAS

### Distribuciones Realistas

El script usa 5 patrones diferentes de votación:

1. **Victoria aplastante:** 45% / 30% / 15% / 10%
2. **Competencia reñida:** 35% / 35% / 20% / 10%
3. **Tres opciones fuertes:** 40% / 25% / 25% / 10%
4. **Muy competitivo:** 28% / 27% / 25% / 20%
5. **Ganador claro:** 50% / 25% / 15% / 10%

### Participación Variable

- **30-70%** de subdivisiones participan por encuesta
- Simula realismo (no todos votan en todas las encuestas)

### Geolocalización Precisa

- Cada voto tiene `latitude` y `longitude`
- Pequeña variación (+/- 0.05°) dentro de la subdivisión
- Simula diferentes ubicaciones exactas

### Votos Anónimos y Registrados

- 70% de votos con `userId` (usuarios registrados)
- 30% sin `userId` (votos anónimos)

---

## 📈 CASOS DE USO

### 1. Testing de Nivel 3

```bash
# Crear votos solo en nivel 3 para probar drill-down
npx tsx scripts/seed-level3-votes.ts
```

Resultado:
- Click país → Ver subdivisiones nivel 1 (agregadas desde nivel 3)
- Click subdivisión nivel 1 → Ver subdivisiones nivel 2 (agregadas desde nivel 3)
- Click subdivisión nivel 2 → Ver subdivisiones nivel 3 (datos reales)

### 2. Limpieza y Reseteo

```bash
# Eliminar todos los votos y empezar de cero
npx tsx scripts/seed-level3-votes.ts
```

### 3. Datos de Demostración

```bash
# Generar datos realistas para demo
npx tsx scripts/seed-level3-votes.ts
```

---

## ⚙️ CONFIGURACIÓN

### Ajustar Cantidad de Votos

Edita el archivo `scripts/seed-level3-votes.ts`:

```typescript
const VOTES_PER_POLL = {
  min: 500,    // ← Cambiar aquí (más bajo = menos votos)
  max: 3000    // ← Cambiar aquí (más alto = más votos)
};
```

### Ajustar Participación

```typescript
// Línea ~110
const participationRate = 0.3 + Math.random() * 0.4; 
// ← Cambiar a 0.5 + Math.random() * 0.3 para 50-80%
```

### Ajustar Votos por Subdivisión

```typescript
// Línea ~125
const votesFromSubdivision = Math.floor(Math.random() * 15) + 1;
// ← Cambiar a Math.random() * 30 + 5 para 5-35 votos
```

---

## 🔍 VERIFICACIÓN EN LA APP

### Después de ejecutar el script:

1. **Refresca la aplicación** (F5)
2. **Click en un país** (España, India, etc.)
3. **Observa:**
   - ✅ Subdivisiones nivel 1 coloreadas (datos agregados)
   - ✅ Click en subdivisión nivel 1 → Ver nivel 2
   - ✅ Click en subdivisión nivel 2 → Ver nivel 3 con colores

4. **Consola del navegador:**
```
[PollDataService] ✅ Votos nivel 1 cargados: 17 subdivisiones
[ColorManager] ✅ 17 subdivisiones coloreadas para ESP
```

---

## 🐛 TROUBLESHOOTING

### Error: "No hay subdivisiones de nivel 3"

**Solución:** Ejecuta primero los scripts de extracción de subdivisiones

```bash
npx tsx scripts/extract-subdivisions-level3.ts
```

### Error: "No hay encuestas activas"

**Solución:** Crea encuestas primero

```bash
npx tsx scripts/seed-polls.ts
```

### Votos no aparecen en la app

**Solución:** 
1. Verifica que los votos se crearon: `npx prisma studio`
2. Refresca la aplicación (F5)
3. Verifica la consola del navegador para errores

---

## 📊 ESTRUCTURA DE DATOS

### Tabla `votes`

```sql
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  poll_id INT NOT NULL,
  option_id INT NOT NULL,
  user_id INT NULL,
  subdivision_id INT NOT NULL,  -- FK a subdivisions.id (nivel 3)
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  ip_address VARCHAR,
  user_agent VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla `subdivisions`

```sql
CREATE TABLE subdivisions (
  id SERIAL PRIMARY KEY,
  subdivision_id VARCHAR UNIQUE,  -- "ESP.1.2.3", "IND.4.5"
  level INT NOT NULL,              -- 1, 2, o 3
  name VARCHAR NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  ...
);
```

### Relación

```
Vote.subdivisionId → Subdivision.id (WHERE level = 3)
```

---

## ✅ VENTAJAS DE VOTOS NIVEL 3

1. **Precisión geográfica máxima**
   - Datos a nivel municipal/ciudad
   - Mejor granularidad que nivel 1 o 2

2. **Agregación automática**
   - Backend agrega nivel 3 → nivel 2
   - Backend agrega nivel 2 → nivel 1
   - Frontend no necesita cambios

3. **Testing exhaustivo**
   - Prueba todo el sistema de drill-down
   - Verifica agregaciones correctas
   - Simula escenario real

4. **Datos realistas**
   - Distribuciones naturales
   - Participación variable
   - Geolocalización precisa

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecuta el script:**
   ```bash
   npx tsx scripts/seed-level3-votes.ts
   ```

2. **Verifica en Prisma Studio:**
   - Tabla `votes` tiene miles de registros
   - Columna `subdivision_id` apunta a nivel 3

3. **Prueba en la app:**
   - Click en países → Ver colores
   - Drill-down hasta nivel 3
   - Verifica etiquetas y colores

4. **Ajusta si necesitas:**
   - Más/menos votos
   - Más/menos participación
   - Diferentes distribuciones

---

*Script creado - 3 Nov 2025, 12:40 PM*
