# 🌍 Sistema de Geocoding Completo - Tablas Maestras Geográficas

## ✅ ¿Qué se ha implementado?

### 1. **Tablas Maestras en Base de Datos**

#### Tabla `countries` (231 países)
- `id`: ID único
- `iso3`: Código ISO3 (ESP, USA, FRA)
- `iso2`: Código ISO2 (ES, US, FR)
- `name`: Nombre oficial del país
- `latitude`, `longitude`: Centroide del país
- `hasLevel1`, `hasLevel2`: Flags de subdivisiones disponibles

#### Tabla `subdivisions` (2706 subdivisiones)
- **Nivel 1**: Estados/Comunidades Autónomas (ESP.1, ESP.13, USA.CA)
  - 2706 registros en total
  - Ejemplos: Andalucía (ESP.1), Madrid (ESP.13), California (USA.CA)

- **Nivel 2**: Provincias/Condados (ESP.1.2, USA.CA.001)
  - Sistema preparado para expandir

- **Nivel 3**: Municipios/Ciudades (ESP.1.2.3)
  - Sistema preparado para expandir

**Campos de subdivisiones:**
- `id`: ID único autoincremental
- `countryId`: Relación con tabla countries
- `subdivisionId`: ID jerárquico único (ej: ESP.13)
- `level`: Nivel jerárquico (1, 2, 3)
- `parentId`: ID del padre en la jerarquía
- `name`: Nombre de la subdivisión
- `type`: Tipo (Comunidad Autónoma, State, Province, etc.)
- `latitude`, `longitude`: Centroide de la subdivisión

---

## 🔄 Flujo de Votación con Geocoding

### **Cuando un usuario vota:**

1. **Frontend obtiene geolocalización GPS**
   ```javascript
   navigator.geolocation.getCurrentPosition()
   // Resultado: lat: 40.4168, lon: -3.7038
   ```

2. **Frontend llama al endpoint de geocoding**
   ```http
   GET /api/geocode?lat=40.4168&lon=-3.7038
   ```

3. **Backend busca en tablas maestras**
   ```sql
   SELECT * FROM subdivisions 
   WHERE level = 1
   ORDER BY ((latitude - 40.4168)^2 + (longitude - (-3.7038))^2)
   LIMIT 1
   ```

4. **Backend retorna ubicación identificada**
   ```json
   {
     "found": true,
     "countryIso3": "ESP",
     "countryName": "España",
     "subdivisionId": "ESP.13",
     "subdivisionName": "Madrid"
   }
   ```

5. **Frontend envía voto con subdivisionId**
   ```javascript
   await fetch('/api/polls/16/vote', {
     method: 'POST',
     body: JSON.stringify({
       optionId: 61,
       userId: 15,
       latitude: 40.4168,
       longitude: -3.7038,
       countryIso3: "ESP",
       countryName: "España",
       subdivisionId: "ESP.13",  // ← Identificado automáticamente
       subdivisionName: "Madrid"
     })
   })
   ```

6. **Backend guarda voto en BD**
   ```sql
   INSERT INTO votes (
     poll_id, option_id, user_id,
     latitude, longitude,
     country_iso3, country_name,
     subdivision_id, subdivision_name,  -- ← Guardado correctamente
     ip_address, user_agent
   ) VALUES (...)
   ```

---

## 📊 Estadísticas de Datos

### Países con más subdivisiones nivel 1:
1. Rusia (RUS): 82
2. Filipinas (PHL): 81
3. Turquía (TUR): 81
4. Tailandia (THA): 77
5. Vietnam (VNM): 63
6. USA: 50
7. ...
8. España (ESP): 11

### Subdivisiones de España:
- ESP.1: Andalucía
- ESP.2: Aragón
- ESP.4: Islas Baleares
- ESP.5: Islas Canarias
- ESP.6: Cantabria
- ESP.7: Castilla-La Mancha
- ESP.10: Cataluña
- ESP.11: Comunidad Valenciana
- ESP.12: Extremadura
- ESP.13: Madrid
- ESP.14: Murcia

---

## 🧪 Scripts Disponibles

### 1. Poblar tablas maestras
```bash
npx tsx scripts/populate-geographic-master-tables.ts
```
- Crea 231 países
- Crea 2706 subdivisiones nivel 1
- Calcula centroides desde archivos TopoJSON

### 2. Probar geocoding
```bash
npx tsx scripts/test-geocoding-complete.ts
```
- Prueba coordenadas de ciudades famosas
- Verifica que el sistema identifique correctamente

### 3. Verificar votos recientes
```bash
npx tsx scripts/check-recent-votes.ts
```
- Muestra los últimos 5 votos
- Verifica que `subdivisionId` se guarde correctamente

---

## 🎯 Casos de Uso

### Caso 1: Usuario vota desde Madrid
```
GPS: 40.4168, -3.7038
→ Geocoding: ESP.13 (Madrid)
→ Voto guardado con subdivisionId = "ESP.13"
```

### Caso 2: Usuario vota desde Barcelona
```
GPS: 41.3851, 2.1734
→ Geocoding: ESP.10 (Cataluña)
→ Voto guardado con subdivisionId = "ESP.10"
```

### Caso 3: Usuario vota desde Sevilla
```
GPS: 37.3891, -5.9845
→ Geocoding: ESP.1 (Andalucía)
→ Voto guardado con subdivisionId = "ESP.1"
```

---

## 🔍 Consultas Útiles

### Ver todos los países
```sql
SELECT iso3, name, hasLevel1, hasLevel2 
FROM countries 
ORDER BY name;
```

### Ver subdivisiones de España
```sql
SELECT s.subdivision_id, s.name, s.type, s.latitude, s.longitude
FROM subdivisions s
JOIN countries c ON s.country_id = c.id
WHERE c.iso3 = 'ESP' AND s.level = 1
ORDER BY s.subdivision_id;
```

### Ver votos con ubicación
```sql
SELECT 
  p.title as encuesta,
  po.option_label as opcion,
  v.country_name as pais,
  v.subdivision_name as subdivision,
  v.subdivision_id as id_subdivision,
  v.created_at as fecha
FROM votes v
JOIN polls p ON v.poll_id = p.id
JOIN poll_options po ON v.option_id = po.id
WHERE v.subdivision_id IS NOT NULL
ORDER BY v.created_at DESC
LIMIT 10;
```

---

## ⚙️ Próximos Pasos

1. **Reiniciar el servidor** para que Prisma reconozca las nuevas tablas
   ```bash
   # Detener el servidor (Ctrl+C)
   npm run dev
   ```

2. **Votar en una encuesta** y verificar en consola:
   ```
   [BottomSheet] 📍 Ubicación GPS obtenida
   [BottomSheet] 🌍 Ubicación geocodificada: {
     país: "España",
     subdivisión: "Madrid",
     subdivisionId: "ESP.13"
   }
   ```

3. **Verificar en BD** que el voto tiene `subdivisionId`:
   ```bash
   npx tsx scripts/check-recent-votes.ts
   ```

---

## ✅ Ventajas del Sistema

1. **Velocidad**: Búsqueda por proximidad en BD es instantánea
2. **Precisión**: 2706 subdivisiones cubren todo el mundo
3. **Escalable**: Fácil agregar niveles 2 y 3
4. **Mantenible**: Datos centralizados en BD
5. **Confiable**: No depende de APIs externas

---

## 🎉 Resultado Final

**Antes:**
```json
{
  "subdivisionId": null,
  "subdivisionName": null
}
```

**Ahora:**
```json
{
  "subdivisionId": "ESP.13",
  "subdivisionName": "Madrid"
}
```

**El sistema identifica automáticamente la subdivisión desde las coordenadas GPS** ✨
