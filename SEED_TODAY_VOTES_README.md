# Seed de Votos para Encuestas de Hoy

Este script agrega votos ficticios a todas las encuestas creadas hoy.

## 🚀 Uso

### Windows
```bash
seed-today-votes.bat
```

### Linux/Mac
```bash
node scripts/seed-today-votes.mjs
```

## 📊 Características

- **Busca encuestas**: Solo las creadas hoy (después de las 00:00)
- **Votos aleatorios**: Entre 100 y 300 votos por encuesta
- **Distribución realista**:
  - Primera opción: ~40%
  - Segunda opción: ~30%
  - Tercera opción: ~15%
  - Resto: ~15%
- **Fechas**: Distribuidas a lo largo del día de hoy
- **Ubicaciones**: Subdivisiones aleatorias (nivel 3)
- **No duplicados**: Usa `skipDuplicates: true`

## 📈 Ejemplo de Salida

```
🌱 Agregando votos ficticios a encuestas de hoy...

📊 Encontradas 3 encuestas de hoy

📋 "¿Cuál es tu película favorita?" (4 opciones)
   Votos actuales: 0
   📈 Distribución:
      Inception: 82 votos (41.0%)
      Matrix: 58 votos (29.0%)
      Interstellar: 32 votos (16.0%)
      Avatar: 28 votos (14.0%)

📋 "¿Mejor comida española?" (3 opciones)
   Votos actuales: 0
   📈 Distribución:
      Paella: 65 votos (43.3%)
      Tortilla: 48 votos (32.0%)
      Gazpacho: 37 votos (24.7%)

✅ ¡400 votos creados en total!
📅 Fecha: 2025-11-13
```

## ⚙️ Personalización

Edita `scripts/seed-today-votes.mjs` para cambiar:
- Número de votos: Línea 53 `Math.floor(Math.random() * 200) + 100`
- Distribución de opciones: Líneas 58-69
- Rango de fechas: Líneas 74-78

## 🗑️ Limpiar Votos

Para eliminar los votos creados hoy:
```sql
DELETE FROM "Vote" WHERE "createdAt" >= CURRENT_DATE;
```
