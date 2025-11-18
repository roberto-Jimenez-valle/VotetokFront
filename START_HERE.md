# 🚀 EMPEZAR AQUÍ - voutop

## ⚡ Ejecutar Todo Automáticamente

### **Opción 1: Un Solo Comando (RECOMENDADO)**

```bash
npm run setup
```

Este comando ejecutará automáticamente:
1. ✅ Instalación de dependencias (si es necesario)
2. ✅ Generación del cliente Prisma
3. ✅ Creación de la base de datos
4. ✅ Población con datos de ejemplo
5. ✅ Limpieza de código mock

**Tiempo estimado: 2-3 minutos**

---

### **Opción 2: Paso a Paso (Manual)**

Si prefieres ejecutar cada paso manualmente:

```bash
# 1. Instalar dependencias
npm install

# 2. Generar cliente Prisma
npx prisma generate

# 3. Crear base de datos
npx prisma migrate dev --name init

# 4. Poblar con datos
npm run db:seed

# 5. Limpiar código mock
npm run cleanup
```

---

## 🎯 Después de la Configuración

### **Iniciar el Servidor:**

```bash
npm run dev
```

Abre tu navegador en: `http://localhost:5173`

---

### **Ver la Base de Datos:**

```bash
npm run db:studio
```

Abre automáticamente: `http://localhost:5555`

---

### **Probar la API:**

Abre en tu navegador:

1. **Lista de encuestas:**
   ```
   http://localhost:5173/api/polls
   ```

2. **Encuesta específica:**
   ```
   http://localhost:5173/api/polls/1
   ```

3. **Usuarios destacados:**
   ```
   http://localhost:5173/api/featured-users
   ```

4. **Votos geolocalizados:**
   ```
   http://localhost:5173/api/votes/geo?poll=1
   ```

5. **Estadísticas:**
   ```
   http://localhost:5173/api/polls/1/stats
   ```

6. **Historial:**
   ```
   http://localhost:5173/api/polls/1/history?days=30
   ```

---

## 📊 Datos Creados

La base de datos incluye:

- **5 usuarios** (3 verificados)
  - María González - Activista social
  - Carlos López - Analista político
  - Laura Sánchez - Periodista
  - Juan Martín - Economista
  - Sofía Herrera - Estudiante

- **3 encuestas:**
  1. "¿Cuál debería ser la prioridad del gobierno para 2024?"
  2. "¿Apoyas las energías renovables?"
  3. "¿El trabajo remoto debería ser el estándar?"

- **15 votos geolocalizados** en España, Francia y Reino Unido

- **4 hashtags** (#política, #economía, #medioambiente, #trabajo)

- **120 registros históricos** para gráficos

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run dev              # Iniciar servidor
npm run build            # Build para producción
npm run preview          # Preview del build

# Base de Datos
npm run db:studio        # Ver BD visualmente
npm run db:seed          # Poblar con datos
npm run db:reset         # Resetear BD (¡cuidado!)
npm run db:generate      # Regenerar cliente Prisma

# Limpieza
npm run cleanup          # Limpiar código mock
npm run format           # Formatear código
```

---

## 🔄 Resetear Todo

Si quieres empezar de cero:

```bash
# Resetear base de datos
npm run db:reset

# O ejecutar setup completo de nuevo
npm run setup
```

---

## 📚 Documentación

- **`QUICK_START.md`** - Guía rápida de 5 minutos
- **`FINAL_REPORT.md`** - Reporte completo de la migración
- **`DATABASE_ARCHITECTURE.md`** - Arquitectura de la BD
- **`IMPLEMENTATION_GUIDE.md`** - Guía de implementación

---

## ❓ Problemas Comunes

### **Error: "Cannot find module '@prisma/client'"**
```bash
npx prisma generate
```

### **Error: "Table does not exist"**
```bash
npm run db:reset
npm run db:seed
```

### **Error: "Port 5173 already in use"**
```bash
# Matar el proceso en el puerto
npx kill-port 5173
# O cambiar el puerto en vite.config.ts
```

### **Base de datos corrupta**
```bash
# Eliminar y recrear
rm prisma/dev.db
npm run setup
```

---

## 🎯 Próximos Pasos

1. ✅ **Ejecutar:** `npm run setup`
2. ✅ **Iniciar:** `npm run dev`
3. ✅ **Probar:** Abrir `http://localhost:5173`
4. ✅ **Explorar:** Ver `http://localhost:5173/api/polls`

---

## 🆘 Ayuda

Si tienes problemas:

1. Verifica que Node.js esté instalado: `node --version`
2. Verifica que npm funcione: `npm --version`
3. Revisa los logs en la consola
4. Consulta `FINAL_REPORT.md` para más detalles

---

## ✨ ¡Listo!

Tu aplicación VoteTok está configurada con:
- 📊 Base de datos SQLite
- 🔗 API REST funcional
- 🧹 Código limpio
- 📝 Datos de ejemplo

**¡Empieza a desarrollar!** 🚀
