# 🐳 Guía de Despliegue con Docker

## 📋 Tabla de Contenidos
- [Problema Común: Frozen Lockfile](#problema-común-frozen-lockfile)
- [Solución Rápida](#solución-rápida)
- [Desarrollo con Docker](#desarrollo-con-docker)
- [Producción con Docker](#producción-con-docker)
- [Troubleshooting](#troubleshooting)

---

## ❌ Problema Común: Frozen Lockfile

### Error que verás:
```
ERROR: failed to solve: process "/bin/sh -c pnpm install --frozen-lockfile" did not complete successfully: exit code: 1
```

### ¿Por qué ocurre?
El flag `--frozen-lockfile` requiere que `pnpm-lock.yaml` esté **exactamente sincronizado** con `package.json`. Si instalaste o actualizaste dependencias localmente sin actualizar el lockfile, el build fallará.

---

## ✅ Solución Rápida

### Opción 1: Actualizar el lockfile (RECOMENDADO)

```bash
# 1. Actualizar el lockfile
pnpm install

# 2. Verificar que todo funciona
pnpm run build

# 3. Commit los cambios
git add pnpm-lock.yaml package.json
git commit -m "chore: update dependencies lockfile"

# 4. Ahora sí, build de producción
docker build -f Dockerfile.prod -t voutop-app:latest .
```

### Opción 2: Build sin frozen lockfile (SOLO DESARROLLO)

```bash
# Usar el Dockerfile de desarrollo que no requiere lockfile sincronizado
docker build -f Dockerfile.dev -t voutop-app:dev .
```

---

## 🛠️ Desarrollo con Docker

### Build de desarrollo

```bash
# Construir imagen de desarrollo
docker build -f Dockerfile.dev -t voutop-app:dev .

# Ejecutar con hot reload
docker run -p 3000:3000 \
  -v ${PWD}:/app \
  -v /app/node_modules \
  --env-file .env \
  voutop-app:dev
```

### Con Docker Compose (Recomendado)

```bash
# Levantar base de datos + Redis + App en desarrollo
docker-compose up -d postgres redis

# Ejecutar tu app localmente con npm
npm run dev
```

---

## 🚀 Producción con Docker

### Pre-requisitos

1. **Actualizar lockfile**:
   ```bash
   pnpm install
   ```

2. **Verificar build local**:
   ```bash
   pnpm run build
   ```

3. **Commit cambios**:
   ```bash
   git add pnpm-lock.yaml
   git commit -m "chore: update lockfile for production"
   ```

### Build de producción

```bash
# Construir imagen optimizada multi-stage
docker build -f Dockerfile.prod -t voutop-app:latest .

# Verificar la imagen
docker images | grep voutop-app
```

### Ejecutar en producción

```bash
# Con Docker Compose (stack completo)
docker-compose --profile production up -d

# O manualmente
docker run -d \
  --name voutop-app \
  -p 3002:3000 \
  --env-file .env.production \
  --network voutop-network \
  voutop-app:latest
```

### URLs de acceso:

- **App**: http://localhost:3002
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

---

## 🔍 Troubleshooting

### Error: "pnpm install --frozen-lockfile failed"

**Causa**: Lockfile desactualizado

**Solución**:
```bash
# Regenerar lockfile
pnpm install

# Verificar
git diff pnpm-lock.yaml

# Commit
git add pnpm-lock.yaml
git commit -m "fix: update pnpm lockfile"
```

### Error: "Cannot find module 'X'"

**Causa**: Dependencia faltante o mal instalada

**Solución**:
```bash
# Limpiar todo
rm -rf node_modules pnpm-lock.yaml

# Reinstalar
pnpm install

# Rebuild
docker build --no-cache -f Dockerfile.prod -t voutop-app:latest .
```

### Error: "Port 3000 already in use"

**Causa**: Conflicto de puertos

**Solución**:
```bash
# Opción 1: Detener el servicio que usa el puerto
docker-compose down

# Opción 2: Cambiar el puerto en docker-compose.yml
# ports:
#   - "3002:3000"  # Usar 3002 en lugar de 3000
```

### Build muy lento

**Causa**: No se está usando cache de Docker

**Solución**:
```bash
# Asegúrate de tener .dockerignore configurado
# Usa BuildKit para builds más rápidos
DOCKER_BUILDKIT=1 docker build -f Dockerfile.prod -t voutop-app:latest .
```

### Error: "ENOSPC: System limit for number of file watchers reached"

**Causa**: Límite de watchers en Linux

**Solución**:
```bash
# Aumentar el límite
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 📊 Monitoreo con Grafana

### Levantar stack de monitoreo

```bash
# Levantar Prometheus + Grafana
docker-compose --profile monitoring up -d

# Ver logs
docker-compose logs -f grafana prometheus
```

### Acceder a Grafana

1. Abrir http://localhost:3001
2. Login: `admin` / `admin`
3. Los dashboards se cargan automáticamente desde `monitoring/grafana/dashboards/`

### Dashboards disponibles

- **VoteTok Overview**: Métricas generales de la app
- **Database Performance**: Métricas de PostgreSQL
- **Redis Performance**: Métricas de cache
- **System Metrics**: CPU, RAM, Disco

---

## 🔐 Variables de Entorno

### Desarrollo (.env)

```env
DATABASE_URL=postgresql://voutop:voutop_pass@localhost:5432/voutop_db
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Producción (.env.production)

```env
DATABASE_URL=postgresql://voutop:voutop_pass@postgres:5432/voutop_db
REDIS_URL=redis://redis:6379
NODE_ENV=production
PORT=3000
```

---

## 📦 Comandos Útiles

```bash
# Ver servicios corriendo
docker-compose ps

# Ver logs de un servicio
docker-compose logs -f app

# Reiniciar un servicio
docker-compose restart app

# Detener todo
docker-compose down

# Detener y eliminar volúmenes (CUIDADO: borra datos)
docker-compose down -v

# Limpiar imágenes antiguas
docker image prune -a

# Ver uso de espacio
docker system df

# Limpiar todo (CUIDADO)
docker system prune -a --volumes
```

---

## 🎯 Checklist de Despliegue

### Antes de hacer build:

- [ ] `pnpm install` ejecutado
- [ ] `pnpm run build` funciona localmente
- [ ] `pnpm-lock.yaml` actualizado
- [ ] Variables de entorno configuradas
- [ ] `.dockerignore` presente
- [ ] Tests pasando

### Durante el build:

- [ ] Build sin errores
- [ ] Imagen creada correctamente
- [ ] Tamaño de imagen razonable (<500MB)

### Después del despliegue:

- [ ] App responde en el puerto correcto
- [ ] Base de datos conectada
- [ ] Redis funcionando
- [ ] Logs sin errores críticos
- [ ] Health check pasando

---

## 📚 Recursos Adicionales

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PNPM Docker Guide](https://pnpm.io/docker)
- [SvelteKit Deployment](https://kit.svelte.dev/docs/adapter-node)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)

---

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs -f app`
2. Verifica las variables de entorno
3. Asegúrate de que el lockfile está actualizado
4. Intenta un build sin cache: `docker build --no-cache`
5. Consulta la sección de Troubleshooting arriba
