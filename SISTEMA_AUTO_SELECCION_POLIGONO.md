# Sistema de Auto-Selección de Polígono Centrado

**Fecha**: 2025-10-10  
**Archivo**: `src/lib/GlobeGL.svelte`

## Resumen

Implementado sistema de auto-selección automática del polígono más cercano al centro de la pantalla cuando se navega a niveles 2, 3 y 4. El nivel 1 (mundial) NO tiene auto-selección para permitir una vista general limpia.

---

## Comportamiento por Nivel

### **Nivel 1 - Mundial (world)**
❌ **SIN auto-selección**
- Vista general de países
- El usuario puede ver todos los países coloreados
- El sistema de detección de polígono centrado está desactivado

### **Nivel 2 - País (country)**
✅ **CON auto-selección**
- Al navegar a un país, automáticamente selecciona la subdivisión más cercana al centro
- Muestra etiqueta destacada de la subdivisión centrada
- El polígono se eleva ligeramente para indicar selección

### **Nivel 3 - Subdivisión (subdivision)**
✅ **CON auto-selección**
- Al navegar a una subdivisión, automáticamente selecciona la sub-subdivisión más cercana al centro
- Funciona igual que el nivel 2 pero con sub-subdivisiones

### **Nivel 4 - Sub-subdivisión (sub-subdivision/ciudad)**
✅ **CON auto-selección**
- Al navegar a una sub-subdivisión, automáticamente selecciona la entidad más cercana al centro
- Muestra información detallada en el bottom sheet

---

## Implementación

### 1. Función de Auto-Selección (`autoSelectCenterPolygon`)

```typescript
function autoSelectCenterPolygon() {
  // Solo activar en niveles 2, 3, 4 (NO en nivel mundial)
  const currentLevel = navigationManager?.getCurrentLevel();
  if (!currentLevel || currentLevel === 'world') return;
  
  // Esperar un frame para que el globo haya renderizado
  requestAnimationFrame(() => {
    try {
      const detected = globe?.getCenterPolygon?.();
      
      if (detected && detected.properties) {
        const props = detected.properties;
        let detectedId = '';
        
        // Detectar nivel 4
        const navState = navigationManager?.getState();
        const isLevel4 = currentLevel === 'subdivision' && 
                         !!navState?.subdivisionId && 
                         !!props.ID_2;
        
        // Extraer ID según el nivel
        if (currentLevel === 'country') {
          detectedId = String(props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || '');
        } else if (currentLevel === 'subdivision' && isLevel4) {
          detectedId = String(props.ID_2 || props.id_2 || props.GID_2 || props.gid_2 || '');
        } else if (currentLevel === 'subdivision') {
          detectedId = String(props.ID_2 || props.id_2 || props.GID_2 || props.gid_2 || '');
        }
        
        // Activar polígono si tiene datos
        if (detectedId && answersData?.[detectedId]) {
          centerPolygon = detected;
          centerPolygonId = detectedId;
          isCenterPolygonActive = true;
          globe?.refreshPolyAltitudes?.();
          addCenterPolygonLabel();
          console.log('[AutoSelect] Polígono centrado activado automáticamente:', detectedId);
        }
      }
    } catch (e) {
      console.warn('[AutoSelect] Error auto-seleccionando polígono:', e);
    }
  });
}
```

### 2. Integración en `navigateToCountry` (Nivel 2)

```typescript
async navigateToCountry(iso: string, countryName: string) {
  // ... código de navegación ...
  
  // Forzar refresh de colores después de actualizar datos
  await new Promise<void>((resolve) => {
    this.globe?.refreshPolyColors?.();
    resolve();
  });
  
  // AUTO-SELECCIONAR polígono más cercano al centro (NIVEL 2)
  await new Promise(resolve => setTimeout(resolve, 300)); // Esperar que termine el zoom
  autoSelectCenterPolygon();
}
```

### 3. Integración en `navigateToSubdivision` (Niveles 3 y 4)

```typescript
async navigateToSubdivision(countryIso: string, subdivisionId: string, subdivisionName: string) {
  // ... código de navegación ...
  
  // Forzar refresh de colores después de actualizar datos
  await new Promise<void>((resolve) => {
    this.globe?.refreshPolyColors?.();
    resolve();
  });
  
  // AUTO-SELECCIONAR polígono más cercano al centro (NIVEL 3 y 4)
  await new Promise(resolve => setTimeout(resolve, 300)); // Esperar que termine el zoom
  autoSelectCenterPolygon();
}
```

### 4. Actualización del Sistema de Detección Durante Movimiento

```typescript
// ANTES: Detectaba en niveles 1, 2, 3 y 4
if (currentLevel && ['world', 'country', 'subdivision'].includes(currentLevel)) {

// AHORA: Solo detecta en niveles 2, 3 y 4
if (currentLevel && ['country', 'subdivision'].includes(currentLevel)) {
```

**Razón del cambio**: Excluir el nivel mundial de la detección de polígono centrado para mantener una vista limpia.

---

## Flujo de Usuario

### Navegación a Nivel 2 (País)
1. Usuario hace clic en un país desde el nivel mundial
2. El globo hace zoom al país
3. **AUTO-SELECCIÓN**: Se detecta automáticamente la subdivisión en el centro
4. La subdivisión se eleva y muestra su etiqueta destacada
5. El bottom sheet muestra información de la subdivisión centrada

### Navegación a Nivel 3 (Subdivisión)
1. Usuario hace clic en una subdivisión desde el nivel país
2. El globo hace zoom a la subdivisión
3. **AUTO-SELECCIÓN**: Se detecta automáticamente la sub-subdivisión en el centro
4. La sub-subdivisión se eleva y muestra su etiqueta
5. El bottom sheet muestra información detallada

### Movimiento del Globo
- Si el usuario arrastra/mueve el globo en niveles 2, 3 o 4
- El sistema detecta continuamente qué polígono está en el centro
- Solo selecciona polígonos que tengan datos activos (votos)
- Actualiza automáticamente la etiqueta y el bottom sheet

---

## Timing y Sincronización

### Delay de 300ms
```typescript
await new Promise(resolve => setTimeout(resolve, 300));
```

**Razón**: 
- Esperar que la animación de zoom termine
- Asegurar que los polígonos estén completamente renderizados
- Evitar detecciones incorrectas durante transiciones

### requestAnimationFrame
```typescript
requestAnimationFrame(() => {
  const detected = globe?.getCenterPolygon?.();
  // ...
});
```

**Razón**:
- Sincronizar con el ciclo de renderizado del navegador
- Asegurar que el globo esté listo para la detección
- Evitar race conditions

---

## Validaciones

### Verificación de Datos
```typescript
if (detectedId && answersData?.[detectedId]) {
  // Solo activar si el polígono tiene votos/datos
}
```

**Beneficio**: 
- No selecciona polígonos vacíos sin información
- Garantiza que siempre haya algo que mostrar en el bottom sheet
- Mejora la experiencia del usuario

### Verificación de Nivel
```typescript
if (!currentLevel || currentLevel === 'world') return;
```

**Beneficio**:
- Previene auto-selección en nivel mundial
- Mantiene consistencia en el comportamiento por nivel

---

## Testing

### Prueba Manual

1. **Nivel Mundial → País**:
   ```
   1. Abrir aplicación en nivel mundial
   2. Hacer clic en cualquier país (ej: España)
   3. Verificar que automáticamente se selecciona una subdivisión
   4. Verificar que aparece la etiqueta destacada
   5. Verificar que el bottom sheet muestra información
   ```

2. **País → Subdivisión**:
   ```
   1. Desde un país, hacer clic en una subdivisión
   2. Verificar auto-selección de sub-subdivisión
   3. Verificar etiqueta y bottom sheet
   ```

3. **Movimiento del Globo**:
   ```
   1. En nivel país, arrastrar el globo
   2. Verificar que la selección cambia según el centro
   3. Verificar actualizaciones del bottom sheet
   ```

### Verificación en Consola

```javascript
// Ver estado actual
console.log('Nivel:', navigationManager?.getCurrentLevel());
console.log('Polígono centrado:', centerPolygonId);
console.log('Activo:', isCenterPolygonActive);

// Verificar auto-selección
console.log('Datos disponibles:', Object.keys(answersData));
```

---

## Beneficios

✅ **Experiencia Fluida**: Usuario siempre tiene contexto inmediato  
✅ **Información Instantánea**: Bottom sheet se actualiza automáticamente  
✅ **Navegación Intuitiva**: No requiere clics adicionales para ver detalles  
✅ **Vista Mundial Limpia**: Sin selección en nivel 1 para mejor visualización  
✅ **Solo Datos Relevantes**: Solo selecciona polígonos con votos activos

---

## Activación Manual por Clic

Además de la auto-selección automática, el sistema también activa etiquetas al hacer clic en polígonos:

### **Clic en Nivel 2 (Country)**
```typescript
// Si la subdivisión NO tiene subdivisiones (nivel final)
if (!hasSubdivisions) {
  scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
  
  // ACTIVAR polígono centrado con etiqueta
  setTimeout(() => {
    centerPolygon = feat;
    centerPolygonId = subdivisionKey;
    isCenterPolygonActive = true;
    globe?.refreshPolyAltitudes?.();
    addCenterPolygonLabel();
  }, 250);
}
```

### **Clic en Nivel 3/4 (Subdivision)**
```typescript
// Verificar que tenga datos
const cityRecord = answersData?.[cityId];
if (!cityRecord) return;

// ACTIVAR polígono centrado con etiqueta
centerPolygon = feat;
centerPolygonId = cityId;
isCenterPolygonActive = true;

setTimeout(() => {
  globe?.refreshPolyAltitudes?.();
  addCenterPolygonLabel();
}, 100);
```

**Beneficio**: El usuario puede hacer clic en cualquier polígono para ver su etiqueta destacada inmediatamente.

---

## Notas Técnicas

- **Performance**: La detección usa `requestAnimationFrame` para optimización
- **Memoria**: No almacena selecciones previas, calcula en tiempo real
- **Compatibilidad**: Funciona con el sistema LOD de etiquetas existente
- **Robustez**: Manejo de errores con try-catch para evitar crashes
- **Interactividad**: Combina auto-selección automática con activación manual por clic
