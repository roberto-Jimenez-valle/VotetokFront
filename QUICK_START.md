# 🚀 Quick Start - Base de Datos VoteTok

## ⚡ Inicio Rápido (5 minutos)

### **1. Instalar Dependencias**
```bash
npm install -D prisma tsx
npm install @prisma/client
```

### **2. Crear Base de Datos**
```bash
npx prisma migrate dev --name init
```

### **3. Poblar con Datos**
```bash
npx tsx prisma/seed.ts
```

### **4. Ver los Datos (Opcional)**
```bash
npx prisma studio
```
Abre `http://localhost:5555` en tu navegador.

---

## ✅ Verificación

### **Comprobar que funciona:**

```bash
# Iniciar el servidor de desarrollo
npm run dev
```

Luego prueba estos endpoints en tu navegador:

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

El seed ha creado:

### **Usuarios (5):**
- María González (verificada) - Activista social
- Carlos López (verificado) - Analista político  
- Laura Sánchez - Periodista
- Juan Martín (verificado) - Economista
- Sofía Herrera - Estudiante

### **Encuestas (3):**
1. **"¿Cuál debería ser la prioridad del gobierno para 2024?"**
   - Economía (azul)
   - Sanidad (verde)
   - Educación (naranja)
   - Medio Ambiente (verde claro)

2. **"¿Apoyas las energías renovables?"**
   - Sí, completamente
   - No
   - Tal vez

3. **"¿El trabajo remoto debería ser el estándar?"**
   - Sí, 100% remoto
   - Modelo híbrido
   - Presencial

### **Votos (15):**
- Madrid: 11 votos
- Barcelona: 5 votos
- Valencia: 1 voto
- Sevilla: 1 voto
- París: 2 votos
- Londres: 1 voto

---

## 🧪 Probar la API

### **Votar en una encuesta:**

```bash
curl -X POST http://localhost:5173/api/polls/1/vote \
  -H "Content-Type: application/json" \
  -d '{
    "optionId": 1,
    "latitude": 40.4168,
    "longitude": -3.7038,
    "countryIso3": "ESP",
    "countryName": "España",
    "cityName": "Madrid"
  }'
```

### **Obtener estadísticas:**

```bash
curl http://localhost:5173/api/polls/1/stats
```

---

## 🔄 Comandos Útiles

```bash
# Ver la base de datos visualmente
npm run db:studio

# Resetear la base de datos
npx prisma migrate reset

# Regenerar el cliente Prisma
npx prisma generate

# Ver el esquema
cat prisma/schema.prisma
```

---

## 📁 Estructura de Archivos Creados

```
VoteTokFront/
├── prisma/
│   ├── schema.prisma          ✅ Esquema de BD
│   ├── seed.ts                ✅ Datos iniciales
│   └── dev.db                 ✅ Base de datos SQLite
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   └── prisma.ts      ✅ Cliente Prisma
│   │   └── services/
│   │       ├── polls.ts       ✅ Servicio de encuestas
│   │       └── users.ts       ✅ Servicio de usuarios
│   └── routes/
│       └── api/
│           ├── polls/
│           │   ├── +server.ts              ✅ GET /api/polls
│           │   └── [id]/
│           │       ├── +server.ts          ✅ GET/PUT/DELETE /api/polls/[id]
│           │       ├── vote/+server.ts     ✅ POST /api/polls/[id]/vote
│           │       ├── stats/+server.ts    ✅ GET /api/polls/[id]/stats
│           │       └── history/+server.ts  ✅ GET /api/polls/[id]/history
│           ├── featured-users/
│           │   └── +server.ts              ✅ GET /api/featured-users
│           └── votes/
│               └── geo/+server.ts          ✅ GET /api/votes/geo
```

---

## 🎯 Próximos Pasos

1. **Actualizar el frontend** para usar la API real
2. **Eliminar datos mock** de los componentes
3. **Implementar geolocalización** real del usuario
4. **Agregar autenticación** (opcional)

Ver `IMPLEMENTATION_GUIDE.md` para más detalles.

---

## ❓ Troubleshooting

### **Error: "Cannot find module '@prisma/client'"**
```bash
npx prisma generate
```

### **Error: "Table 'polls' does not exist"**
```bash
npx prisma migrate dev --name init
```

### **Error: "Seed failed"**
```bash
npm install -D tsx
npx tsx prisma/seed.ts
```

### **Ver logs de Prisma:**
```bash
# Agregar a .env
DEBUG="prisma:*"
```

---

## 📊 Ejemplo de Respuesta de la API

### GET /api/polls/1

```json
{
  "data": {
    "id": 1,
    "title": "¿Cuál debería ser la prioridad del gobierno para 2024?",
    "description": "Encuesta sobre las prioridades políticas para el próximo año",
    "category": "Politics",
    "type": "poll",
    "status": "active",
    "totalVotes": 15,
    "totalViews": 15420,
    "createdAt": "2025-01-04T18:50:00.000Z",
    "user": {
      "id": 1,
      "username": "maria_gonzalez",
      "displayName": "María González",
      "avatarUrl": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
      "verified": true
    },
    "options": [
      {
        "id": 1,
        "optionKey": "economia",
        "optionLabel": "Economía",
        "color": "#3b82f6",
        "voteCount": 5,
        "displayOrder": 0
      },
      // ... más opciones
    ],
    "_count": {
      "votes": 15,
      "comments": 0,
      "interactions": 0
    }
  }
}
```

---

¡Listo! 🎉 Tu base de datos está funcionando.
