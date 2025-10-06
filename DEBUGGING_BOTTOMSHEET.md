# 🐛 Debugging BottomSheet - Problemas Identificados

## Fecha: 2025-10-05

## ✅ Cambios Realizados

### 1. Base de Datos
- ✅ 10 usuarios creados con avatares reales (pravatar.cc)
- ✅ 15 encuestas con opciones lógicas y coherentes
- ✅ 60 opciones totales (todas con labels correctos)
- ✅ 20 votos de usuarios reales
- ✅ 1,800 registros históricos para gráficas
- ✅ 5 relaciones de seguimiento (UserFollower)

### 2. Código BottomSheet
- ✅ Eliminado bucle redundante `{#each [poll] as p}`
- ✅ Títulos cambiados de `poll.region` a `poll.question`
- ✅ Avatares dinámicos con fallback a iniciales
- ✅ Avatares de amigos solo cuando hay votos
- ✅ Nuevo endpoint `/api/polls/[id]/friends-votes`

## ❌ Problemas Reportados

### 1. **Paginado no funciona**
- El segundo bloque de opciones (cuando hay >4) no aparece
- **Causa probable**: Estado de `currentPageByPoll[poll.id]` no se actualiza correctamente
- **Debug agregado**: Console.log para ver página actual y items

### 2. **Títulos no se muestran bien**
- **Solucionado**: Cambiado `poll.region` → `poll.question`

### 3. **Avatares no aparecen**
- **Solucionado**: Agregado código para mostrar avatares reales del creador
- **Avatares de amigos**: Implementado endpoint pero puede no estar cargando

### 4. **No hay follows**
- **Verificado en BD**: Sí hay 5 relaciones UserFollower
- **Problema**: El endpoint usa `userId=1` hardcodeado
- **Solución necesaria**: Pasar el userId real del usuario logueado

## 🔍 Próximos Pasos

1. **Verificar en consola del navegador**:
   - Ver logs de "Poll: ... | Total opciones: ..."
   - Ver logs de "Renderizando opciones de página: ..."
   - Verificar si `paginatedPoll.items` está vacío en página 1

2. **Probar paginación manualmente**:
   - Hacer swipe/drag en una encuesta con 5 opciones
   - Ver si cambia `currentPageByPoll[poll.id]`
   - Verificar si aparecen los dots de paginación

3. **Verificar carga de amigos**:
   - Abrir Network tab
   - Ver si se llama `/api/polls/[id]/friends-votes?userId=1`
   - Verificar respuesta del endpoint

4. **Solución userId hardcodeado**:
   - Agregar prop `currentUserId` al BottomSheet
   - Pasar desde +page.svelte
   - Usar en la llamada al endpoint de friends-votes
