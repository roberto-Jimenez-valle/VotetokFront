# 🚀 Acceso Rápido a la Documentación API

## 📖 Ver la Documentación

### Opción 1: Apertura Automática (Recomendado)

**Todo se abre automáticamente al iniciar:**
```bash
npm start
```
✨ Se abrirán automáticamente:
- **Swagger UI** (http://localhost:5173/api-docs)
- **Prisma Studio** (http://localhost:5555)

### Opción 2: Manual

1. **Inicia el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

2. **Abre en tu navegador:**
   ```
   http://localhost:5173/api-docs
   ```

## ⚡ Comandos Rápidos

```bash
# Abrir documentación directamente
npm run api:docs

# Ver especificación YAML
npm run api:spec
```

## 🎯 Endpoints Destacados

### Crear Encuesta
```bash
POST /api/polls
```

### Votar
```bash
POST /api/polls/{id}/vote
```

### Geocoding
```bash
GET /api/geocode?lat=40.4168&lon=-3.7038
```

## 📝 Estructura

- `spec.yaml` - Especificación OpenAPI completa
- `+page.svelte` - Interfaz de Swagger UI
- `/openapi.yaml` - Endpoint que sirve el YAML

## 🔧 Modificar la Documentación

Edita el archivo: `src/lib/openapi/spec.yaml`

Los cambios se reflejan automáticamente al recargar `/api-docs`.
