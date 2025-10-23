# 🚀 Script: Votos de Teletransporte para Todos los Usuarios

Este script agrega un voto de **todos los usuarios** de la base de datos hacia la opción **"Teletransportación"** en la encuesta **"¿Cuál es tu superpoder ideal?"**.

## 📋 Requisitos Previos

1. La base de datos debe tener usuarios creados (ejecutar `npm run db:seed`)
2. La encuesta de superpoderes debe existir (ejecutar el archivo `insert-encuestas-divertidas.sql`)

## 🎯 Opciones de Ejecución

### Opción 1: Script TypeScript con Prisma (Recomendado)

```bash
npm run db:add-teletransporte
```

**Ventajas:**
- ✅ Usa Prisma (más seguro)
- ✅ Validaciones automáticas
- ✅ Mensajes descriptivos en consola
- ✅ Elimina votos previos de usuarios en esta encuesta
- ✅ Verifica que existe la encuesta y la opción

**Lo que hace:**
1. Busca la encuesta "¿Cuál es tu superpoder ideal?"
2. Busca la opción "teletransporte"
3. Obtiene todos los usuarios de la BD
4. Elimina votos previos de estos usuarios en esta encuesta
5. Crea un voto nuevo para cada usuario → teletransporte
6. Muestra un resumen de los resultados

### Opción 2: Script SQL directo

```bash
# En PowerShell
Get-Content add-teletransporte-votes-all-users.sql | sqlite3 prisma/dev.db

# O importar manualmente en tu gestor de BD
```

**Ventajas:**
- ⚡ Más rápido para grandes cantidades de usuarios
- 📊 Incluye queries de verificación

## 📊 Detalles de la Encuesta

**Título:** ¿Cuál es tu superpoder ideal?

**Opciones disponibles:**
- 🦅 Volar (`volar`)
- 👻 Invisibilidad (`invisible`)
- ⚡ **Teletransportación** (`teletransporte`) ← Esta opción recibe los votos
- 🧠 Leer mentes (`leer_mentes`)

## 🔍 Verificación

Después de ejecutar el script, puedes verificar los resultados:

### En Prisma Studio:
```bash
npm run db:studio
```

Navega a la tabla `Vote` y filtra por `pollId` de la encuesta de superpoderes.

### Con SQL:
```sql
SELECT 
    u.username,
    u.display_name,
    po.option_label,
    v.created_at
FROM votes v
JOIN users u ON v.user_id = u.id
JOIN poll_options po ON v.option_id = po.id
WHERE v.poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?')
ORDER BY v.created_at DESC;
```

## 📈 Resultados Esperados

Si tienes 5 usuarios en tu base de datos (del seed por defecto):
- maria_gonzalez → teletransporte ✓
- carlos_lopez → teletransporte ✓
- laura_sanchez → teletransporte ✓
- juan_martin → teletransporte ✓
- sofia_herrera → teletransporte ✓

**Total: 5 votos para teletransporte**

## ⚠️ Notas Importantes

1. **Elimina votos previos**: Si un usuario ya votó en esta encuesta, su voto anterior será eliminado y reemplazado por teletransporte.

2. **Geolocalización**: Todos los votos se crean con coordenadas de Madrid (con variación aleatoria pequeña).

3. **Subdivisión**: Los votos se asignan a la Comunidad de Madrid (ID: 65101).

4. **Timestamp**: Los votos se crean con la fecha/hora actual.

## 🐛 Troubleshooting

### "No se encontró la encuesta"
```bash
# Ejecuta primero el SQL de encuestas divertidas
Get-Content insert-encuestas-divertidas.sql | sqlite3 prisma/dev.db
```

### "No hay usuarios en la base de datos"
```bash
npm run db:seed
```

### "Error: subdivision_id not found"
El script funciona incluso sin subdivisión, solo muestra un warning.

## 🎉 Ejemplo de Salida

```
🚀 Iniciando script: Votos de teletransporte para todos los usuarios

✅ Encuesta encontrada: "¿Cuál es tu superpoder ideal?" (ID: 42)
✅ Opción encontrada: "Teletransportación" (ID: 169)
✅ Usuarios encontrados: 5
Usuarios: maria_gonzalez, carlos_lopez, laura_sanchez, juan_martin, sofia_herrera

🗑️  Eliminando votos previos de usuarios en esta encuesta...
   Eliminados: 0 votos previos

📊 Creando votos para todos los usuarios...
   ✓ maria_gonzalez → teletransporte
   ✓ carlos_lopez → teletransporte
   ✓ laura_sanchez → teletransporte
   ✓ juan_martin → teletransporte
   ✓ sofia_herrera → teletransporte

✅ 5 votos creados exitosamente!

📈 Resultados finales:
   Volar: 320 votos
   Teletransportación: 385 votos
   Invisibilidad: 150 votos
   Leer mentes: 145 votos

🎉 Script completado!
```

## 📝 Archivos Relacionados

- `scripts/add-teletransporte-votes.ts` - Script TypeScript con Prisma
- `add-teletransporte-votes-all-users.sql` - Script SQL directo
- `insert-encuestas-divertidas.sql` - SQL para crear la encuesta original
