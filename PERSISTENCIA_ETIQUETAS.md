# Sistema de Persistencia de Etiquetas

**Fecha**: 2025-10-10  
**Archivo**: `src/lib/GlobeGL.svelte`

## Problema Identificado

Cuando el usuario estaba dentro de un país (nivel 2, 3 o 4), la etiqueta del polígono seleccionado se eliminaba cuando:
1. El centro del globo caía en un polígono sin datos
2. El centro caía fuera de cualquier polígono (bordes, espacios vacíos)
3. El usuario arrastraba el globo

Esto causaba una experiencia inconsistente donde el usuario perdía contexto visual frecuentemente.

---

## Solución Implementada

### 1. **Persistencia en Sistema de Detección Continua**

**Ubicación**: Handler `on:controlsChange`, líneas 4155-4177

**ANTES**:
```typescript
} else {
  // Polígono sin datos, limpiar selección
  if (centerPolygonId !== null) {
    centerPolygon = null;
    centerPolygonId = null;
    isCenterPolygonActive = false;
    globe?.refreshPolyAltitudes?.();
    removeCenterPolygonLabel();
  }
}
```

**AHORA**:
```typescript
} else {
  // Polígono sin datos o no detectado:
  // En niveles 2, 3, 4: MANTENER la selección actual (no limpiar)
  
  // Si ya hay un polígono activo, mantenerlo
  if (isCenterPolygonActive && centerPolygonId) {
    // Verificar que el polígono actual siga teniendo datos
    if (!answersData?.[centerPolygonId]) {
      // El polígono actual perdió sus datos
      console.log('[CenterPolygon] Polígono actual sin datos, manteniendo selección');
    }
    // MANTENER la selección actual (no hacer nada)
  }
}
```

**Mismo cambio para cuando no hay polígono detectado**:
```typescript
} else {
  // No hay polígono detectado:
  // En niveles 2, 3, 4: MANTENER la selección actual (no limpiar)
  if (isCenterPolygonActive && centerPolygonId) {
    // MANTENER la selección cuando el centro cae fuera de polígonos
    console.log('[CenterPolygon] Centro fuera de polígonos, manteniendo selección actual');
  }
}
```

---

### 2. **Limpieza al Volver a Nivel Mundial**

**Ubicación**: `navigateToWorld()`, líneas 1483-1487

```typescript
// LIMPIAR polígono centrado al volver a nivel mundial
centerPolygon = null;
centerPolygonId = null;
isCenterPolygonActive = false;
removeCenterPolygonLabel();
```

**Propósito**: 
- En nivel mundial NO debe haber polígono seleccionado
- Limpieza apropiada al cambiar de contexto

---

### 3. **Limpieza al Navegar Hacia Atrás**

**Ubicación**: `navigateBack()`, líneas 1550-1554

```typescript
async navigateBack() {
  // LIMPIAR polígono centrado antes de navegar hacia atrás
  centerPolygon = null;
  centerPolygonId = null;
  isCenterPolygonActive = false;
  removeCenterPolygonLabel();
  
  if (this.state.level === 'subdivision') {
    // From subdivision back to country
    await this.navigateToCountry(countryIso, countryName);
    // Auto-selección se activa automáticamente en navigateToCountry
  } else if (this.state.level === 'country') {
    // From country back to world
    await this.navigateToWorld();
    // No auto-selección en nivel mundial
  }
}
```

**Beneficios**:
- Limpia la selección previa antes de navegar
- Permite que la auto-selección funcione correctamente en el nuevo nivel
- Mantiene la consistencia del estado

---

## Comportamiento Resultante

### **En Niveles 2, 3 y 4**

| Situación | Comportamiento Anterior | Comportamiento Nuevo |
|-----------|------------------------|---------------------|
| **Centro en polígono con datos** | ✅ Muestra etiqueta | ✅ Muestra etiqueta |
| **Centro en polígono SIN datos** | ❌ Elimina etiqueta | ✅ **MANTIENE** etiqueta anterior |
| **Centro fuera de polígonos** | ❌ Elimina etiqueta | ✅ **MANTIENE** etiqueta anterior |
| **Usuario arrastra globo** | ❌ Pierde etiqueta | ✅ **MANTIENE** etiqueta hasta encontrar nuevo polígono |

### **En Nivel Mundial**

| Situación | Comportamiento |
|-----------|---------------|
| **Vista general** | ❌ Sin etiquetas (correcto) |
| **Al volver desde nivel 2/3/4** | ✅ Limpia etiqueta anterior |

---

## Flujo de Trabajo Completo

### **Escenario 1: Usuario Navega a País**
```
1. Usuario hace clic en país
2. Sistema hace zoom y navega a nivel 2
3. Auto-selección activa polígono central ✅
4. Usuario arrastra el globo
5. Centro cae en polígono sin datos
6. Sistema MANTIENE la etiqueta anterior ✅
7. Usuario sigue arrastrando
8. Centro cae en polígono CON datos
9. Sistema actualiza a nueva etiqueta ✅
```

### **Escenario 2: Usuario Vuelve a Nivel Mundial**
```
1. Usuario está en nivel 2 con etiqueta activa
2. Usuario hace clic en "Volver" o breadcrumb
3. Sistema limpia etiqueta ✅
4. Sistema navega a nivel mundial ✅
5. Vista mundial sin etiquetas (correcto) ✅
```

### **Escenario 3: Centro Cae Fuera de Polígonos**
```
1. Usuario en nivel 2 con etiqueta "Andalucía"
2. Usuario arrastra rápidamente
3. Centro cae en el océano (sin polígonos)
4. Sistema MANTIENE etiqueta "Andalucía" ✅
5. Usuario sigue arrastrando
6. Centro vuelve a tierra en "Madrid"
7. Sistema actualiza a etiqueta "Madrid" ✅
```

---

## Validaciones y Seguridad

### **Verificación de Datos**
```typescript
if (!answersData?.[centerPolygonId]) {
  console.log('[CenterPolygon] Polígono actual sin datos, manteniendo selección');
}
```

**Propósito**: Verificar que el polígono actual sigue siendo válido, pero NO limpiarlo.

### **Logging de Debug**
```typescript
console.log('[CenterPolygon] Centro fuera de polígonos, manteniendo selección actual');
```

**Propósito**: Facilitar debugging y monitoreo del comportamiento.

---

## Interacción con Otros Sistemas

### **Auto-Selección**
- ✅ Compatible: La persistencia NO interfiere con la auto-selección inicial
- ✅ La auto-selección solo ocurre al navegar a un nuevo nivel
- ✅ Una vez seleccionado, el polígono persiste

### **Sistema LOD de Etiquetas**
- ✅ Compatible: El polígono centrado siempre muestra su etiqueta
- ✅ Las otras etiquetas siguen las reglas LOD normales
- ✅ La etiqueta del polígono centrado tiene prioridad visual

### **Bottom Sheet**
- ✅ Mantiene sincronización con la etiqueta visible
- ✅ No se cierra cuando la etiqueta persiste
- ✅ Actualiza información cuando cambia la selección

---

## Testing

### **Prueba 1: Persistencia en Polígonos Sin Datos**
```
Pasos:
1. Navegar a España (nivel 2)
2. Sistema auto-selecciona "Andalucía"
3. Arrastrar el globo hacia una región sin datos
4. Verificar que la etiqueta "Andalucía" permanece visible

Resultado esperado: ✅ Etiqueta persiste
```

### **Prueba 2: Actualización al Encontrar Nuevo Polígono**
```
Pasos:
1. En nivel 2 con "Andalucía" seleccionada
2. Arrastrar hacia "Madrid" (con datos)
3. Verificar transición de etiqueta

Resultado esperado: ✅ Etiqueta cambia a "Madrid"
```

### **Prueba 3: Limpieza al Volver a Mundial**
```
Pasos:
1. En nivel 2 con etiqueta activa
2. Hacer clic en breadcrumb "Mundo"
3. Verificar que la etiqueta desaparece

Resultado esperado: ✅ Sin etiquetas en nivel mundial
```

### **Prueba 4: Centro Fuera de Polígonos**
```
Pasos:
1. En nivel 2 cerca del borde del país
2. Arrastrar hasta que el centro caiga en el océano
3. Verificar que la etiqueta persiste

Resultado esperado: ✅ Etiqueta persiste incluso en océano
```

---

## Logs de Debug

Para monitorear el comportamiento en consola:

```javascript
// Persistencia cuando no hay polígono detectado
[CenterPolygon] Centro fuera de polígonos, manteniendo selección actual

// Persistencia cuando polígono sin datos
[CenterPolygon] Polígono actual sin datos, manteniendo selección

// Actualización normal
[CenterPolygon] Detectado nuevo polígono con datos: ESP.1
```

---

## Beneficios

✅ **Experiencia Consistente**: Usuario siempre ve una etiqueta en niveles 2, 3, 4  
✅ **Contexto Continuo**: No pierde referencia visual al mover el globo  
✅ **Navegación Intuitiva**: Cambios de etiqueta solo cuando hay información nueva  
✅ **Sin Parpadeos**: Eliminado el efecto de etiquetas que aparecen/desaparecen  
✅ **Performance**: No recalcula innecesariamente cuando no hay cambios  
✅ **Limpieza Apropiada**: Se limpia correctamente al cambiar de nivel

---

## Resumen de Archivos Modificados

- ✅ `src/lib/GlobeGL.svelte` (líneas 4155-4177)
  - Persistencia en detección continua
  
- ✅ `src/lib/GlobeGL.svelte` (líneas 1483-1487)
  - Limpieza en `navigateToWorld()`
  
- ✅ `src/lib/GlobeGL.svelte` (líneas 1550-1554)
  - Limpieza en `navigateBack()`

- ✅ `PERSISTENCIA_ETIQUETAS.md` (nuevo)
  - Documentación completa del sistema
