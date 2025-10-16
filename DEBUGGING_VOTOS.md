# 🐛 Guía de Depuración - Problema de Votos

## Problema Detectado
Los votos no se están guardando en la base de datos cuando el usuario vota desde la interfaz.

## ✅ Verificaciones Realizadas

1. **Base de datos funcional**: ✅ La BD acepta votos correctamente (prueba con script)
2. **Endpoint creado**: ✅ `/api/polls/[id]/vote` existe
3. **Logs implementados**: ✅ Hay logs detallados en frontend y backend

## 🔍 Pasos para Depurar

### 1. Verificar que el servidor está corriendo

```bash
npm run dev
```

Deberías ver algo como:
```
VITE v4.x.x  ready in X ms

➜  Local:   http://localhost:5173/
```

### 2. Monitorear votos en tiempo real

Abre una **segunda terminal** y ejecuta:

```bash
node monitor-votes-realtime.mjs
```

Este script te avisará instantáneamente cuando se guarde un voto en la BD.

### 3. Verificar logs del navegador

1. Abre la aplicación en el navegador
2. Presiona **F12** para abrir DevTools
3. Ve a la pestaña **Console**
4. Intenta votar
5. Busca mensajes que empiecen con:
   - `[BottomSheet handleVote]`
   - `[BottomSheet sendVote]`
   - Cualquier error en rojo

**¿Qué buscar?**
- ✅ Si ves los logs: El frontend está intentando enviar el voto
- ❌ Si NO ves logs: El evento de click no está funcionando

### 4. Verificar peticiones de red

1. En DevTools, ve a la pestaña **Network**
2. Asegúrate de que esté grabando (botón rojo)
3. Filtra por "vote" o "polls"
4. Intenta votar
5. Busca una petición a `/api/polls/[número]/vote`

**¿Qué verificar?**
- **Status 200**: ✅ Voto guardado correctamente
- **Status 400**: ❌ Datos inválidos (revisa los datos enviados)
- **Status 404**: ❌ Endpoint no encontrado (problema de routing)
- **Status 500**: ❌ Error del servidor (revisa logs del servidor)
- **No aparece**: ❌ El fetch nunca se ejecutó (problema en frontend)

### 5. Ver detalles de la petición

Si encuentras la petición en Network:
1. Haz click en ella
2. Ve a la pestaña **Headers**:
   - Verifica la URL
   - Verifica el método (debe ser POST)
3. Ve a la pestaña **Payload** o **Request**:
   - Verifica que se están enviando todos los campos:
     ```json
     {
       "optionId": número,
       "userId": número o null,
       "latitude": número,
       "longitude": número,
       "countryIso3": string,
       "countryName": string,
       "subdivisionId": string o null,
       "subdivisionName": string o null,
       "cityName": string o null
     }
     ```
4. Ve a la pestaña **Response**:
   - Si hay un error, verás el mensaje aquí

### 6. Revisar logs del servidor

En la terminal donde ejecutaste `npm run dev`, busca mensajes cuando votas:

```
[API Vote] 🚀 ENDPOINT LLAMADO - Inicio del proceso de votación
[API Vote] 📌 Poll ID: 1
[API Vote] 📦 Body recibido: { ... }
```

**¿Qué buscar?**
- ✅ Si ves estos logs: El endpoint está siendo llamado
- ❌ Si NO los ves: El fetch no está llegando al servidor

## 🛠️ Soluciones Comunes

### Problema 1: No ves logs en el navegador

**Causa**: El evento de click no está funcionando o el componente no está montado correctamente.

**Solución**: Verifica que:
- Estás haciendo click en una opción de una encuesta válida
- El componente BottomSheet está visible y funcional
- No hay errores de JavaScript que bloqueen la ejecución

### Problema 2: Ves logs pero no hay petición en Network

**Causa**: El fetch está siendo bloqueado o hay un error antes de ejecutarlo.

**Solución**:
- Busca un error justo antes del fetch
- Verifica que `numericPollId` y `optionId` sean números válidos

### Problema 3: La petición devuelve 400

**Causa**: Los datos enviados no son válidos.

**Solución**:
- Verifica el payload enviado
- Asegúrate de que `optionId`, `latitude`, `longitude`, y `countryIso3` están presentes
- Verifica que `optionId` sea un **número**, no un string

### Problema 4: La petición devuelve 404

**Causa**: El endpoint no existe o la URL es incorrecta.

**Solución**:
- Verifica que el servidor está corriendo
- Verifica la URL exacta de la petición
- Asegúrate de que existe el archivo `src/routes/api/polls/[id]/vote/+server.ts`

### Problema 5: La petición devuelve 500

**Causa**: Error del servidor al procesar el voto.

**Solución**:
- Revisa los logs del servidor para ver el error exacto
- Puede ser un problema con la base de datos o validación

## 📊 Scripts de Verificación

### Verificar votos en BD
```bash
node check-votes-database.mjs
```

### Crear voto de prueba directo en BD
```bash
node test-vote-endpoint.mjs
```

### Monitorear votos en tiempo real
```bash
node monitor-votes-realtime.mjs
```

## 📝 Información a Proporcionar

Si el problema persiste, proporciona:

1. **Logs de consola del navegador** (pestaña Console)
2. **Detalles de la petición Network** (URL, Status, Payload, Response)
3. **Logs del servidor** (terminal donde corre npm run dev)
4. **Resultado del script de monitoreo** (¿detecta votos nuevos?)

## 🎯 Siguiente Paso

**EJECUTA AHORA:**

1. Terminal 1: `npm run dev`
2. Terminal 2: `node monitor-votes-realtime.mjs`
3. Navegador: Abre DevTools (F12) → Console + Network
4. Intenta votar
5. Observa qué pasa en cada lugar

Luego comparte lo que veas en cada uno de estos puntos.
