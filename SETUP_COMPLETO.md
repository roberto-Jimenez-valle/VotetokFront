# 🚀 Setup Completo - Sistema de Globo 3D con Datos Reales

## 📋 Pasos para Configurar Todo desde Cero

### Paso 1: Limpiar Base de Datos (Opcional)

Si quieres empezar desde cero:

```bash
# Eliminar base de datos actual
rm prisma/dev.db
rm prisma/dev.db-journal
```

### Paso 2: Aplicar Migración de Base de Datos

```bash
# Aplicar migración para agregar subdivision_id
npx prisma migrate dev --name add_subdivision_id

# O simplemente push el schema
npx prisma db push
```

### Paso 3: Generar Cliente de Prisma

```bash
npx prisma generate
```

### Paso 4: Poblar con Datos COMPLETOS y REALISTAS

```bash
# Este script crea TODO:
# - 5 usuarios
# - 5 encuestas trending
# - ~5000 votos con geolocalización real
# - Votos en 10 países diferentes
# - Votos en 17 subdivisiones de España
# - Interacciones (likes)
npx tsx scripts/seed-complete-realistic-data.ts
```

**Deberías ver:**
```
🌱 Seeding COMPLETE realistic data...

👥 Creating users...
✅ Created 5 users

📋 Creating trending polls...

  Creating poll: Favorite Season
  Creating poll: Breakfast Preference
  Creating poll: Favorite Sport
  Creating poll: Beach vs Mountain
  Creating poll: Music Genre
✅ Created 5 polls

🗳️  Creating realistic votes with geolocation...

  Poll: ¿Cuál es tu estación favorita?
    Spain: 800 votes
    France: 150 votes
    Germany: 120 votes
    ...
  ✅ Total votes for poll: 1500

...

📊 SUMMARY:
══════════════════════════════════════════════════
👥 Users created: 5
📋 Polls created: 5
🗳️  Total votes created: ~5000
🌍 Countries with votes: 10
🇪🇸 Spain subdivisions: 17
══════════════════════════════════════════════════

✅ Seed completed successfully!
```

### Paso 5: Verificar Datos

```bash
# Abrir Prisma Studio para ver los datos
npx prisma studio
```

Verifica:
- ✅ Tabla `users`: 5 usuarios
- ✅ Tabla `polls`: 5 encuestas activas
- ✅ Tabla `votes`: ~5000 votos
- ✅ Votos tienen `subdivision_id` para España (1-17)
- ✅ Votos tienen `country_iso3` (ESP, FRA, DEU, etc.)

### Paso 6: Ejecutar Diagnóstico

```bash
# Verificar que todo está correcto
npx tsx scripts/diagnose-subdivision-data.ts
```

**Deberías ver:**
```
🔍 Diagnosing subdivision data...

📊 Total votes with subdivision_id: 800
🌍 Votes by country:
   ESP: 800 votes
🇪🇸 Spain subdivisions:
   ID 1: Andalucía (47 votes)
   ID 2: Aragón (51 votes)
   ...
📋 Active polls:
   Poll #1: ¿Cuál es tu estación favorita?
     Total votes: 1500
     Options: 4
     Subdivisions with votes: 17
```

### Paso 7: Iniciar Servidor

```bash
npm run dev
```

### Paso 8: Probar en el Navegador

1. **Abrir**: http://localhost:5173
2. **Verificar BottomSheet**: Deberías ver 5 encuestas trending
3. **Abrir una encuesta**: Click en "Ver en globo"
4. **Verificar consola**:
   ```
   [GlobeGL] 🔒 MODO EXCLUSIVO: ENCUESTA ESPECÍFICA
   [GlobeGL]   Poll ID: 1
   ```
5. **Click en España**
6. **Verificar consola**:
   ```
   [Colors] 📡 Loading real subdivision votes from database for poll 1 country ESP
   [Colors] ✅ Loaded real subdivision votes: { "1": {...}, "2": {...}, ... }
   [Colors] Subdivision 1 → spring ( 47 votes) → #90EE90
   [Colors] ✅ Assigned real colors to 17 subdivisions from database
   [CountryView] 📊 Colors applied: 17 / 17 polygons
   ```
7. **Verificar globo**: Las subdivisiones deben tener colores diferentes según los votos reales

---

## 🧪 Testing de Endpoints

### Test 1: Trending Polls

```bash
curl http://localhost:5173/api/polls/trending-by-region?region=Global&limit=10
```

**Respuesta esperada:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "¿Cuál es tu estación favorita?",
      "totalVotes": 1500,
      "options": [
        { "optionKey": "spring", "optionLabel": "Primavera", "color": "#90EE90" },
        ...
      ],
      "user": {
        "username": "maria_garcia",
        "displayName": "María García"
      }
    },
    ...
  ]
}
```

### Test 2: Votos por País

```bash
curl http://localhost:5173/api/polls/1/votes-by-country
```

**Respuesta esperada:**
```json
{
  "data": {
    "ESP": { "spring": 200, "summer": 250, "autumn": 180, "winter": 170 },
    "FRA": { "spring": 40, "summer": 50, "autumn": 35, "winter": 25 },
    ...
  }
}
```

### Test 3: Votos por Subdivisión

```bash
curl http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP
```

**Respuesta esperada:**
```json
{
  "data": {
    "1": { "spring": 12, "summer": 15, "autumn": 10, "winter": 10 },
    "2": { "spring": 13, "summer": 14, "autumn": 12, "winter": 12 },
    ...
  }
}
```

### Test 4: Usuarios Trending

```bash
curl http://localhost:5173/api/users/trending?limit=10
```

**Respuesta esperada:**
```json
{
  "data": [
    {
      "id": 1,
      "username": "maria_garcia",
      "displayName": "María García",
      "verified": true
    },
    ...
  ]
}
```

---

## 📊 Datos Creados

### Encuestas

1. **¿Cuál es tu estación favorita?**
   - Primavera 🌸 (#90EE90)
   - Verano ☀️ (#FFD700)
   - Otoño 🍂 (#FF8C00)
   - Invierno ❄️ (#87CEEB)

2. **¿Qué prefieres para desayunar?**
   - Café ☕ (#8B4513)
   - Té 🍵 (#90EE90)
   - Zumo 🧃 (#FFA500)

3. **¿Cuál es tu deporte favorito?**
   - Fútbol ⚽ (#228B22)
   - Baloncesto 🏀 (#FF6347)
   - Tenis 🎾 (#FFD700)
   - Natación 🏊 (#4169E1)

4. **¿Prefieres playa o montaña?**
   - Playa 🏖️ (#00CED1)
   - Montaña ⛰️ (#8B4513)

5. **¿Qué tipo de música escuchas más?**
   - Pop 🎵 (#FF69B4)
   - Rock 🎸 (#DC143C)
   - Electrónica 🎧 (#00FFFF)
   - Clásica 🎻 (#FFD700)

### Países con Votos

- 🇪🇸 España (ESP) - ~800 votos con subdivisiones
- 🇫🇷 Francia (FRA) - ~150 votos
- 🇩🇪 Alemania (DEU) - ~120 votos
- 🇮🇹 Italia (ITA) - ~100 votos
- 🇬🇧 Reino Unido (GBR) - ~90 votos
- 🇺🇸 Estados Unidos (USA) - ~200 votos
- 🇲🇽 México (MEX) - ~110 votos
- 🇦🇷 Argentina (ARG) - ~95 votos
- 🇧🇷 Brasil (BRA) - ~130 votos
- 🇯🇵 Japón (JPN) - ~105 votos

### Subdivisiones de España

Todas las 17 comunidades autónomas tienen votos:
1. Andalucía
2. Aragón
3. Asturias
4. Baleares
5. Canarias
6. Cantabria
7. Castilla y León
8. Castilla-La Mancha
9. Cataluña
10. Comunidad Valenciana
11. Extremadura
12. Galicia
13. Madrid
14. Murcia
15. Navarra
16. País Vasco
17. La Rioja

---

## 🐛 Troubleshooting

### Problema: BottomSheet vacío

**Causa**: No hay encuestas en la BD o el endpoint no funciona

**Solución**:
```bash
# 1. Verificar que hay encuestas
npx prisma studio
# Ir a tabla "polls" y verificar que hay encuestas con status="active"

# 2. Si no hay encuestas, ejecutar seed
npx tsx scripts/seed-complete-realistic-data.ts

# 3. Probar endpoint manualmente
curl http://localhost:5173/api/polls/trending-by-region?region=Global&limit=10

# 4. Reiniciar servidor
npm run dev
```

### Problema: Colores no se muestran

**Solución**: Ver `DEBUG_SUBDIVISION_COLORS.md`

### Problema: "No votes with subdivision_id"

**Solución**:
```bash
# Ejecutar seed completo
npx tsx scripts/seed-complete-realistic-data.ts
```

---

## ✅ Checklist Final

- [ ] Migración aplicada
- [ ] Cliente Prisma generado
- [ ] Seed ejecutado exitosamente
- [ ] Diagnóstico muestra datos correctos
- [ ] Prisma Studio muestra 5 encuestas activas
- [ ] Prisma Studio muestra ~5000 votos
- [ ] Servidor corriendo en http://localhost:5173
- [ ] BottomSheet muestra encuestas trending
- [ ] Endpoint trending funciona
- [ ] Endpoint votes-by-country funciona
- [ ] Endpoint votes-by-subdivisions funciona
- [ ] Globo muestra colores basados en datos reales
- [ ] Consola muestra logs de colores aplicados
- [ ] No hay errores en consola

---

## 🎉 ¡Listo!

Si todos los pasos funcionan correctamente:

1. ✅ BottomSheet muestra 5 encuestas trending
2. ✅ Puedes abrir cualquier encuesta en el globo
3. ✅ Click en España muestra subdivisiones con colores reales
4. ✅ Cada subdivisión tiene su color según votos de la BD
5. ✅ No hay parpadeos ni cambios de color
6. ✅ Sistema completamente funcional

---

**Última actualización**: 2025-10-05
**Versión**: 2.0 - Sistema Completo
