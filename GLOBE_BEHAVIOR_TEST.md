# 🧪 Guía de Prueba: Comportamiento del Globo con Encuestas

## 📋 Comportamiento Esperado

### **1. Al Abrir una Encuesta**

**Flujo:**
1. ✅ Se carga la encuesta y sus opciones
2. ✅ Se actualiza `colorMap` con los colores de las opciones
3. ✅ Se navega automáticamente a **vista mundial (world)**
4. ✅ Se cargan datos de votos por país desde API
5. ✅ Se calculan colores dominantes por país
6. ✅ Se hace zoom out a altitud 2.5 (vista global)
7. ✅ Se actualizan los colores de los polígonos
8. ✅ Se generan marcadores geográficos
9. ✅ Se minimiza el BottomSheet a estado `collapsed`

**Colores esperados:**
- Cada país debe tener el color de la opción más votada
- Los colores deben coincidir con los de la leyenda
- Los países sin datos deben aparecer en gris (#9ca3af)

---

### **2. Interacción por Niveles**

#### **Nivel 1: Vista Mundial (World)**
- **Altitud**: 2.5 (vista global)
- **Polígonos**: Países coloreados según opción dominante
- **Etiquetas**: Nombres de países (si altitud < 2.5)
- **Click**: Navega al país seleccionado

#### **Nivel 2: Vista de País (Country)**
- **Altitud**: 0.3-1.2 (según tamaño del país)
- **Polígonos**: Subdivisiones coloreadas según opción dominante
- **Etiquetas**: Nombres de subdivisiones (si altitud < 0.8)
- **Click**: Navega a la subdivisión seleccionada
- **Color del país padre**: Debe mantener el color de la opción dominante

#### **Nivel 3: Vista de Subdivisión (Subdivision)**
- **Altitud**: 0.08-0.6 (según tamaño de la subdivisión)
- **Polígonos**: Sub-subdivisiones coloreadas
- **Etiquetas**: Nombres detallados (si altitud < 0.3)
- **Click**: Selecciona la sub-subdivisión

---

## 🐛 Problemas Conocidos a Verificar

### **Problema 1: Colores no se ven correctamente**

**Síntomas:**
- Los países aparecen todos grises
- Los colores no coinciden con la leyenda
- Los colores desaparecen al hacer zoom

**Causas posibles:**
1. `colorMap` no se está actualizando correctamente
2. `isoDominantKey` está vacío
3. Los datos de la API no tienen el formato correcto
4. El refresh de colores ocurre antes del zoom

**Verificación en consola:**
```javascript
// Ver estado actual


---

### **Problema 2: Colores cambian al navegar entre niveles**

**Síntomas:**
- Al hacer click en un país, los colores desaparecen
- Al volver a world, los colores no se restauran

**Causas posibles:**
1. Los datos de subdivisiones no se están cargando
2. El `refreshPolyColors()` no se llama después de navegar
3. El `colorMap` se pierde al cambiar de nivel

**Solución implementada:**
- Se llama `refreshPolyColors()` después de cada navegación
- Se mantiene `activePoll` durante toda la sesión
- Se recargan datos al cambiar de nivel

---

## 🧪 Pruebas Recomendadas

### **Test 1: Abrir encuesta desde BottomSheet**
1. Abre la app
2. Expande el BottomSheet
3. Click en una de las encuestas trending
4. **Verificar**: El globo debe hacer zoom out y mostrar colores por país

### **Test 2: Navegar a un país**
1. Con una encuesta abierta
2. Click en un país (ej: España)
3. **Verificar**: 
   - Zoom al país
   - Subdivisiones coloreadas según votos
   - País padre mantiene su color

### **Test 3: Volver a vista mundial**
1. Estando en un país
2. Click en el botón "Global" del navegador
3. **Verificar**: 
   - Zoom out a vista mundial
   - Colores de países se restauran
   - Datos se mantienen

---

## 🔍 Comandos de Debug en Consola

---

## 📊 Logging Implementado

Ahora verás en consola:
- `[OpenPoll] 📊 Datos cargados` - Cuando se cargan los datos
- `[OpenPoll] 🎨 Colores calculados` - Cuando se calculan los colores dominantes
- `[OpenPoll] 📍 Marcadores generados` - Cuando se crean los marcadores
- `[OpenPoll] ✅ Colores actualizados` - Cuando se aplican los colores
- `[Color Debug]` - Cuando un polígono no tiene color asignado

Usa estos logs para diagnosticar problemas de colores.
