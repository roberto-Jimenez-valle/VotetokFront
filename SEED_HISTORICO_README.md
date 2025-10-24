# 🌱 Seed de Votos Históricos

Este script genera votos distribuidos a lo largo del **último año** para probar los gráficos históricos.

## 📋 Requisitos

- Node.js instalado
- Base de datos PostgreSQL configurada
- Archivo `.env` con `DATABASE_URL` correcto

## 🚀 Ejecución

### Windows (Railway CLI):
```bash
.\seed-historical-votes.bat
```

Este script:
1. Compila el TypeScript a JavaScript
2. Ejecuta el seed directamente en Railway usando `railway run`

### Linux/Mac (Railway CLI):
```bash
# Compilar TypeScript
npx tsc scripts/seed-historical-votes.ts --outDir scripts/dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# Ejecutar en Railway
railway run node scripts/dist/seed-historical-votes.js
```

### Alternativa local (requiere tsx):
```bash
tsx scripts/seed-historical-votes.ts
```

## ✨ Qué hace este script

1. **Selecciona 10 encuestas activas** de tu base de datos
2. **Genera entre 500-2000 votos** por encuesta
3. **Distribuye los votos** a lo largo del último año (365 días)
4. **Usa subdivisiones nivel 3** para ubicaciones realistas
5. **Distribución no uniforme** de votos entre opciones:
   - Encuestas binarias: 60% / 40%
   - Encuestas con 3 opciones: 50% / 30% / 20%

## 📊 Resultado

Después de ejecutar el script:
- Podrás ver gráficos históricos con datos reales
- Los botones de filtro (1D, 5D, 1M, 6M, 1A) funcionarán correctamente
- Cada opción tendrá su línea de color en el gráfico
- Los totales coincidirán exactamente con la tabla `votes`

## 🎨 Ejemplo de salida

```
🌱 Iniciando seed de votos históricos...
📊 Agregando votos históricos a 10 encuestas
📍 Usando 50 ubicaciones para distribuir votos

🗳️  Procesando encuesta: "¿Qué prefieres?" (ID: 1)
   Generando 1234 votos distribuidos en el último año...
   ✅ Insertados 1234 votos
   📈 Distribución por opción:
      Opción A: 740 votos (60.0%)
      Opción B: 494 votos (40.0%)

✅ Seed completado exitosamente!
📊 Total de votos insertados: 12,450
📅 Rango de fechas: 2024-01-24 a 2025-01-24
```

## ⚠️ Notas

- Los votos son **anónimos** (userId = null)
- Las fechas están **distribuidas aleatoriamente** en el último año
- El script usa **batches de 500** para optimizar performance
- Se puede ejecutar **múltiples veces** sin problemas

## 🧹 Limpiar datos de prueba

Si quieres eliminar los votos de prueba después:

```sql
-- Ver cuántos votos hay por encuesta
SELECT pollId, COUNT(*) as total 
FROM Vote 
GROUP BY pollId 
ORDER BY total DESC;

-- Eliminar votos de una encuesta específica
DELETE FROM Vote WHERE pollId = 1;

-- O eliminar todos los votos anónimos
DELETE FROM Vote WHERE userId IS NULL;
```
