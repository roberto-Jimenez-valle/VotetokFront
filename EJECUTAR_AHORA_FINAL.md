# ⚡ EJECUTAR AHORA - Comandos Rápidos

## 🚀 Setup MEGA COMPLETO en 5 Comandos

```bash
# 1. Aplicar migración
npx prisma db push

# 2. Generar cliente
npx prisma generate

# 3. 🔥 SEED MEGA - 10 encuestas + flores + comida + todo
npx tsx scripts/seed-mega-complete.ts

# 4. Verificar datos
npx tsx scripts/diagnose-subdivision-data.ts

# 5. Iniciar servidor
npm run dev
```

---

## 📊 Qué Esperar

### En la Terminal (Seed):
```
🌱 SEED MEGA COMPLETO - Iniciando...
👥 Creando usuarios...
✅ 8 usuarios creados
📊 Creando encuestas...
  🌸 Flores favoritas
  🍕 Comida favorita
  ✈️ Destino de vacaciones
  🍂 Estación del año
  ⚽ Deporte favorito
  🎵 Género musical
  🐕 Mascotas
✅ 7 encuestas creadas
🗳️  Creando votos...
📊 RESUMEN FINAL:
  👥 Usuarios: 8
  📋 Encuestas: 7
  🗳️  Votos totales: ~10,500
  🌍 Países: 15
  🇪🇸 Subdivisiones España: 17
✅ SEED MEGA COMPLETO FINALIZADO!
💡 Todas con datos COMPLETOS
```

### En el Navegador:
1. **BottomSheet**: 7 encuestas trending con datos COMPLETOS
   - 🌸 Flores favoritas
   - 🍕 Comida favorita
   - ✈️ Destino de vacaciones
   - 🍂 Estación del año
   - ⚽ Deporte favorito
   - 🎵 Género musical
   - 🐕 Mascotas
2. **Click "Ver en globo"**: Abre encuesta en modo exclusivo
3. **Click en España**: Muestra 17 subdivisiones con colores reales
4. **Consola**: Logs de colores aplicados desde BD
5. **Países**: 15 países con votos (España, Francia, Alemania, USA, Japón, etc.)

### En la Consola del Navegador:
```
[GlobeGL] 🔒 MODO EXCLUSIVO: ENCUESTA ESPECÍFICA
[Colors] 📡 Loading real subdivision votes from database
[Colors] ✅ Loaded real subdivision votes: { "1": {...}, ... }
[Colors] Subdivision 1 → spring ( 47 votes) → #90EE90
[CountryView] 📊 Colors applied: 17 / 17 polygons
```

---

## 🎯 Verificación Rápida

```bash
# Ver datos en BD
npx prisma studio

# Probar endpoint trending
curl http://localhost:5173/api/polls/trending-by-region?region=Global&limit=10

# Probar endpoint subdivisiones
curl http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP
```

---

## ✅ Todo Funciona Si:

- ✅ BottomSheet muestra 7 encuestas con datos COMPLETOS
- ✅ Todas las encuestas tienen emojis (🌸 🍕 ✈️ 🍂 ⚽ 🎵 🐕)
- ✅ Puedes abrir cualquier encuesta en el globo
- ✅ España muestra 17 subdivisiones coloreadas
- ✅ Cada color representa la opción más votada de la BD
- ✅ No hay parpadeos ni cambios de color
- ✅ Consola muestra "Colors applied: 17 / 17"
- ✅ 15 países tienen votos y se colorean correctamente

---

## 🆘 Si Algo Falla

```bash
# Limpiar y empezar de cero
rm prisma/dev.db
npx prisma db push
npx prisma generate
npx tsx scripts/seed-complete-realistic-data.ts
npm run dev
```

---

**¡Listo en 5 minutos!** 🎉
