# 📚 VouTop API Documentation

Documentación completa de la API de VouTop con OpenAPI 3.0 y Swagger UI.

## 🚀 Acceder a la Documentación

### Apertura Automática (Recomendado)
```bash
npm start
```
✨ **Se abrirán automáticamente:**
1. **Swagger UI** - Documentación interactiva de la API
2. **Prisma Studio** - Interfaz visual de la base de datos

### Desarrollo Local (Manual)
```
http://localhost:5173/api-docs
```

### Producción
```
https://voutop.com/api-docs
```

## 📖 Características

✅ **Documentación Interactiva** - Prueba todos los endpoints directamente desde el navegador  
✅ **Validación de Esquemas** - Todos los requests y responses están validados  
✅ **Ejemplos Reales** - Cada endpoint incluye ejemplos de uso  
✅ **Try it Out** - Ejecuta peticiones en tiempo real  
✅ **Especificación OpenAPI 3.0** - Estándar de la industria  

## 🎯 Endpoints Principales

### 📊 Polls (Encuestas)
- `GET /api/polls` - Listar encuestas con paginación
- `POST /api/polls` - Crear nueva encuesta
- `GET /api/polls/{id}` - Obtener encuesta por ID
- `GET /api/polls/trending` - Encuestas en tendencia
- `GET /api/polls/for-you` - Encuestas recomendadas

### 🗳️ Votes (Votación)
- `POST /api/polls/{id}/vote` - Votar en una encuesta
- `DELETE /api/polls/{id}/vote` - Eliminar voto

### 📍 Geocoding
- `GET /api/geocode?lat=40.4168&lon=-3.7038` - Convertir coordenadas a ubicación

### 👥 Users (Usuarios)
- `GET /api/users/trending` - Usuarios en tendencia
- `GET /api/users/with-activity` - Usuarios con actividad reciente

## 💡 Ejemplos de Uso

### 1. Crear una Encuesta

```bash
curl -X POST http://localhost:5173/api/polls \
  -H "Content-Type: application/json" \
  -d '{
    "title": "¿Cuál es tu lenguaje favorito?",
    "description": "Queremos conocer las preferencias",
    "category": "tech",
    "type": "single",
    "duration": "7d",
    "hashtags": ["tecnologia", "programacion"],
    "options": [
      {
        "optionKey": "js",
        "optionLabel": "JavaScript",
        "color": "#f7df1e",
        "displayOrder": 0
      },
      {
        "optionKey": "python",
        "optionLabel": "Python",
        "color": "#3776ab",
        "displayOrder": 1
      }
    ]
  }'
```

### 2. Votar en una Encuesta

```bash
curl -X POST http://localhost:5173/api/polls/123/vote \
  -H "Content-Type: application/json" \
  -d '{
    "optionId": 456,
    "latitude": 40.4168,
    "longitude": -3.7038
  }'
```

### 3. Geocodificar Coordenadas

```bash
curl "http://localhost:5173/api/geocode?lat=40.4168&lon=-3.7038"
```

## 🔧 Estructura de la Documentación

```
src/
├── lib/
│   └── openapi/
│       └── spec.yaml          # Especificación OpenAPI
├── routes/
│   ├── api/
│   │   └── ...               # Endpoints de la API
│   ├── api-docs/
│   │   └── +page.svelte      # Interfaz de Swagger UI
│   └── openapi.yaml/
│       └── +server.ts        # Endpoint que sirve el YAML
```

## 📝 Cómo Actualizar la Documentación

### 1. Editar la Especificación
Modifica el archivo `src/lib/openapi/spec.yaml`:

```yaml
paths:
  /api/tu-nuevo-endpoint:
    get:
      tags:
        - NombreTag
      summary: Descripción corta
      description: Descripción detallada
      parameters:
        - name: param1
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Respuesta exitosa
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TuSchema'
```

### 2. Agregar Nuevos Schemas
Define tus modelos en `components.schemas`:

```yaml
components:
  schemas:
    TuNuevoModelo:
      type: object
      required:
        - campoRequerido
      properties:
        campoRequerido:
          type: string
          example: "valor de ejemplo"
```

### 3. Los cambios se reflejan automáticamente
No necesitas reiniciar el servidor, solo recarga la página `/api-docs`.

## 🎨 Personalización

El diseño de Swagger UI está personalizado con los colores de VouTop:

- **Primary**: `#1a1a2e` (Header y botones)
- **Success**: `#10b981` (POST)
- **Info**: `#3b82f6` (GET)
- **Danger**: `#ef4444` (DELETE)

Para modificar los estilos, edita el `<style>` en `src/routes/api-docs/+page.svelte`.

## 🚀 Mejoras Futuras

- [ ] Agregar autenticación con JWT en Swagger UI
- [ ] Generar tipos TypeScript automáticamente con `openapi-typescript`
- [ ] Agregar validación de requests con Zod
- [ ] Implementar rate limiting documentado
- [ ] Agregar webhooks en la especificación
- [ ] Generar cliente API automático

## 📚 Recursos

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi)

## 💬 Soporte

Para preguntas sobre la API, contacta a:
- Email: support@voutop.com
- Documentación: http://localhost:5173/api-docs

---

**Nota**: Esta documentación está en constante actualización. Última actualización: $(date +%Y-%m-%d)
