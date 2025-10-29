# 🤖 Configuración del GPT Generador de Encuestas

Guía completa para entrenar un GPT personalizado que genere encuestas para VouTop con enlaces embebibles.

---

## 📁 Archivos Disponibles

### 1. **GPT_POLL_GENERATOR_PROMPT.md**
**Uso:** Prompt completo y detallado con ejemplos extensos
**Cuándo usar:** Para entrenar un Custom GPT desde cero o como referencia completa
**Tamaño:** ~15KB
**Contenido:**
- Instrucciones detalladas
- 10+ ejemplos por categoría
- Lista completa de 500+ dominios soportados
- Mejores prácticas y errores comunes

### 2. **GPT_PROMPT_QUICK.txt**
**Uso:** Versión rápida para copiar-pegar en ChatGPT
**Cuándo usar:** Para sesiones individuales sin crear Custom GPT
**Tamaño:** ~3KB
**Contenido:**
- Formato obligatorio
- Lista resumida de plataformas
- 3 ejemplos rápidos
- Reglas esenciales

### 3. **GPT_CUSTOM_CONFIG.json**
**Uso:** Configuración estructurada para Custom GPT
**Cuándo usar:** Al crear un GPT personalizado en ChatGPT Plus/Enterprise
**Tamaño:** ~5KB
**Contenido:**
- Metadatos del GPT
- Instrucciones optimizadas
- Ejemplos por categoría
- Lista de plataformas soportadas

---

## 🚀 Opción 1: Crear Custom GPT (Recomendado)

### Paso 1: Acceder a Custom GPTs
1. Ir a https://chat.openai.com/
2. Click en tu perfil → "My GPTs"
3. Click en "Create a GPT"

### Paso 2: Configuración Básica
En la pestaña **"Create"**, usa estos valores:

**Name:**
```
VouTop Poll Generator
```

**Description:**
```
Genera encuestas en formato Markdown con enlaces embebibles para VouTop. 
Soporta 30+ plataformas oEmbed y 500+ dominios seguros.
```

### Paso 3: Instrucciones
Copia TODO el contenido de `GPT_POLL_GENERATOR_PROMPT.md` en el campo **"Instructions"**

O usa la versión JSON:
1. Abre `GPT_CUSTOM_CONFIG.json`
2. Copia el valor del campo `"instructions"`
3. Pégalo en el campo de instrucciones

### Paso 4: Conversation Starters
Añade estos iniciadores de conversación:

```
- Genera una encuesta sobre tecnología con enlace de YouTube
- Crea 3 encuestas variadas: noticias, cultura y deportes
- Encuesta sobre último iPhone con fuentes tech
- Pregunta política neutral con enlaces a periódicos
- Encuesta de entretenimiento sobre streaming
```

### Paso 5: Capacidades
- ❌ Web Browsing: Desactivado (no necesario)
- ❌ DALL-E: Desactivado
- ❌ Code Interpreter: Desactivado

### Paso 6: Publicar
1. Click en "Create"
2. Elige visibilidad: "Only me" (privado) o "Anyone with the link"
3. Guarda

---

## 💬 Opción 2: Usar en ChatGPT Normal

### Método: Prompt por Sesión
1. Abre ChatGPT (https://chat.openai.com/)
2. Copia el contenido de `GPT_PROMPT_QUICK.txt`
3. Pégalo al inicio de una nueva conversación
4. Usa comandos como:

```
"Genera una encuesta sobre el nuevo iPhone con enlaces de YouTube y TechCrunch"

"Crea 5 encuestas variadas: 2 de tecnología, 2 de noticias y 1 de deportes"

"Encuesta sobre Netflix vs HBO con enlaces a artículos de comparativa"
```

---

## 🎯 Ejemplos de Uso

### Comando 1: Encuesta Simple
```
Usuario: "Genera encuesta sobre ChatGPT vs Claude con enlaces tech"

GPT: 
# ¿Qué modelo de IA prefieres para trabajo?

Comparativa actualizada de LLMs:
https://www.techcrunch.com/ai-models-comparison-2024

## Opciones:
- ChatGPT (OpenAI)
- Claude (Anthropic)
- Gemini (Google)
- Llama (Meta)
- Otro
```

### Comando 2: Encuesta con Contexto
```
Usuario: "Encuesta sobre última película de Marvel, tono informal, con trailer de YouTube"

GPT:
# ¿Qué te pareció [última película de Marvel]?

Trailer oficial:
https://www.youtube.com/watch?v=trailer_marvel

Crítica de IGN:
https://www.ign.com/articles/marvel-movie-review

## Opciones:
- Increíble, mejor que las anteriores
- Buena pero no épica
- Decepcionante
- No la he visto aún
```

### Comando 3: Múltiples Encuestas
```
Usuario: "Crea 3 encuestas: una sobre iPhone 15, otra sobre cambio climático, y otra sobre la Champions"

GPT: [Genera 3 encuestas bien estructuradas con enlaces relevantes]
```

### Comando 4: Con Especificaciones
```
Usuario: "Encuesta sobre teletrabajo, tono profesional, con estadísticas de Forbes y Bloomberg, 5 opciones"

GPT: [Genera encuesta formal con enlaces a Forbes/Bloomberg y 5 opciones balanceadas]
```

---

## 🔧 Personalización Avanzada

### Añadir Contexto Regional
Añade al final del prompt:

```
PRIORIZA FUENTES EN ESPAÑOL Y DE ESPAÑA/LATAM cuando sea relevante.
Usa periódicos locales: El País, Clarín, El Tiempo, etc.
```

### Ajustar Tono
Añade al prompt:

```
TONO POR DEFECTO: [Neutral / Informal / Profesional / Humorístico]
```

### Longitud de Descripciones
Añade:

```
DESCRIPCIONES: [Cortas (1-2 líneas) / Medianas (3-4 líneas) / Largas (5+ líneas)]
```

### Número de Enlaces
Añade:

```
ENLACES POR ENCUESTA: [Mínimo 1, Máximo 3] (recomendado: 1-2)
```

---

## ✅ Verificación de Calidad

### Checklist Automático
El GPT debe generar encuestas que cumplan:

- [ ] Título < 280 caracteres
- [ ] 2-6 opciones (idealmente 4)
- [ ] 1-3 enlaces relevantes
- [ ] URLs válidas (dominios soportados)
- [ ] Formato Markdown correcto
- [ ] Sin sesgos o marcados claramente
- [ ] Lenguaje inclusivo
- [ ] Opciones mutuamente excluyentes

### Prueba Inicial
Prueba con estos comandos:

```
1. "Genera encuesta sobre tecnología"
2. "Crea encuesta de noticias con enlace a El País"
3. "Encuesta sobre fútbol con video de YouTube"
4. "5 encuestas variadas sobre temas actuales"
```

Si todas funcionan correctamente, ¡tu GPT está listo! 🎉

---

## 🐛 Solución de Problemas

### Problema: GPT no incluye enlaces
**Solución:** Asegúrate de que la sección "PLATAFORMAS EMBEBIBLES" está incluida en las instrucciones

### Problema: Enlaces rotos o no soportados
**Solución:** Añade esta regla:
```
VALIDACIÓN: Solo usa dominios de la lista SUPPORTED_PLATFORMS. Si no estás seguro, omite el enlace.
```

### Problema: Opciones desequilibradas
**Solución:** Añade:
```
BALANCE: Revisa que las opciones cubran todo el espectro de opiniones posibles sin solaparse.
```

### Problema: Formato incorrecto
**Solución:** Enfatiza en el prompt:
```
FORMATO ESTRICTO - Siempre seguir esta estructura EXACTAMENTE:
# [Título]
[Descripción con enlaces]
## Opciones:
- Opción 1
...
```

---

## 📊 Métricas de Éxito

Tu GPT funciona correctamente si:

✅ **Precisión**: 95%+ de encuestas con formato correcto
✅ **Relevancia**: Enlaces relacionados con el tema
✅ **Diversidad**: Varía fuentes (no siempre YouTube)
✅ **Balance**: Opciones equilibradas
✅ **URLs**: 100% de enlaces válidos
✅ **Velocidad**: Genera en < 30 segundos

---

## 🔄 Actualización del Prompt

### Cuándo actualizar:
- Se añaden nuevas plataformas embebibles
- Cambian URLs de servicios
- Se detectan patrones problemáticos
- Feedback de usuarios

### Cómo actualizar:
1. Edita `GPT_POLL_GENERATOR_PROMPT.md`
2. Si es Custom GPT: Settings → Edit → Pega nuevo prompt
3. Si es prompt normal: Guarda nueva versión del .txt

---

## 💡 Tips Pro

### Tip 1: Plantillas Rápidas
Crea comandos guardados:

```
/tech → "Encuesta sobre tecnología con enlaces de TechCrunch y YouTube"
/news → "Encuesta de actualidad con periódicos español e internacional"
/fun → "Encuesta entretenida sobre cultura pop con enlaces de Instagram"
```

### Tip 2: Batch Generation
Para generar múltiples:

```
"Genera 10 encuestas para la semana: 
- Lunes: Tech
- Martes: Deportes
- Miércoles: Economía
..."
```

### Tip 3: Estilo Consistente
Guarda configuraciones:

```
TEMA_HOY: Tecnología
TONO: Profesional
FUENTES_PRIORITARIAS: TechCrunch, Wired, The Verge
ENLACES: 2 por encuesta
```

---

## 🎓 Ejemplos de Uso Real

### Caso 1: Creador de Contenido
**Objetivo:** 5 encuestas diarias sobre tendencias

**Comando matutino:**
```
"Genera 5 encuestas sobre los trending topics de hoy:
1. Tecnología (nueva IA)
2. Entretenimiento (serie viral)
3. Deportes (último partido)
4. Política (noticia destacada)
5. Lifestyle (tendencia social)

Usa enlaces de Twitter, YouTube y noticias. Tono informal."
```

### Caso 2: Medio Digital
**Objetivo:** Encuesta diaria con artículo propio

**Comando:**
```
"Encuesta sobre [TEMA]. 
Enlace principal: https://nuestromedio.com/articulo
Enlace secundario: fuente externa relevante
Tono: Periodístico neutral
4 opciones equilibradas"
```

### Caso 3: Community Manager
**Objetivo:** Engagement en redes

**Comando:**
```
"3 encuestas virales sobre:
- Lo más comentado hoy en Twitter/X
- Meme o trend actual
- Tema polémico pero respetuoso

Con enlaces a tweets originales y videos de TikTok"
```

---

## 📚 Recursos Adicionales

- **LINK_PREVIEW_PLATFORMS.md**: Lista completa de plataformas
- **AMAZON_LINK_PREVIEW.md**: Detalles de extracción Amazon
- `src/lib/server/oembed-providers.ts`: Código de proveedores
- `src/routes/api/link-preview/+server.ts`: API de preview

---

**¿Preguntas? ¿Mejoras?**
Documenta feedback en `GPT_FEEDBACK.md` (crear si no existe)

---

**Estado:** ✅ Listo para producción  
**Versión:** 1.0  
**Última actualización:** Octubre 2024
