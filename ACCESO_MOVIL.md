# 📱 Acceder desde tu Móvil

## 🌐 URLs para acceder desde tu móvil:

### **Aplicación Principal:**
```
http://192.168.1.75:5173
```

### **API Endpoints:**

1. **Lista de encuestas:**
   ```
   http://192.168.1.75:5173/api/polls
   ```

2. **Encuesta específica:**
   ```
   http://192.168.1.75:5173/api/polls/1
   ```

3. **Usuarios destacados:**
   ```
   http://192.168.1.75:5173/api/featured-users
   ```

4. **Votos geolocalizados:**
   ```
   http://192.168.1.75:5173/api/votes/geo?poll=1
   ```

---

## 📋 **Instrucciones:**

### **1. Asegúrate de que el servidor esté corriendo:**

En tu PC, ejecuta:
```bash
npm run dev
```

Deberías ver algo como:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.75:5173/
```

### **2. Conecta tu móvil a la misma red WiFi**

⚠️ **IMPORTANTE:** Tu móvil y tu PC deben estar en la **misma red WiFi**

### **3. Abre en el navegador de tu móvil:**

```
http://192.168.1.75:5173
```

---

## 🔥 **Firewall de Windows:**

Si no puedes acceder desde el móvil, puede ser el firewall. Ejecuta esto en PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
```

O desactiva temporalmente el firewall para probar.

---

## 🔍 **Verificar que funciona:**

### **Desde tu PC:**
```
http://localhost:5173
```

### **Desde tu móvil:**
```
http://192.168.1.75:5173
```

Ambos deberían mostrar la misma aplicación.

---

## 📊 **Probar la API desde el móvil:**

Abre estos enlaces en el navegador de tu móvil:

1. `http://192.168.1.75:5173/api/polls`
2. `http://192.168.1.75:5173/api/featured-users`
3. `http://192.168.1.75:5173/api/votes/geo?poll=1`

---

## 🛠️ **Troubleshooting:**

### **No puedo acceder desde el móvil:**

1. ✅ Verifica que ambos estén en la misma WiFi
2. ✅ Verifica que el servidor esté corriendo (`npm run dev`)
3. ✅ Verifica la IP con: `ipconfig | findstr IPv4`
4. ✅ Desactiva temporalmente el firewall de Windows
5. ✅ Prueba con `http://` (no `https://`)

### **Cambió mi IP:**

Si tu IP cambia, ejecuta:
```bash
ipconfig | findstr IPv4
```

Y usa la nueva IP que aparezca.

---

## 📱 **Crear un código QR (opcional):**

Puedes usar un generador de QR online para crear un código QR con la URL:
```
http://192.168.1.75:5173
```

Y escanearlo con tu móvil para acceder rápidamente.

---

## ✨ **¡Listo!**

Ahora puedes:
- ✅ Ver la aplicación en tu móvil
- ✅ Probar la API desde el móvil
- ✅ Votar con geolocalización real
- ✅ Desarrollar y ver cambios en tiempo real

**¡Disfruta probando en móvil!** 🚀
