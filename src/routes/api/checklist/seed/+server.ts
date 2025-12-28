import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * POST /api/checklist/seed
 * Inicializa la base de datos con los datos del checklist existente
 * Solo ejecutar una vez para migrar los datos hardcoded
 */
export const POST: RequestHandler = async ({ locals }) => {
    try {
        // Verificar si ya hay datos
        const existingCount = await prisma.checklistGroup.count();

        // Si ya hay datos, requiere auth para reseed
        if (existingCount > 0) {
            const user = locals.user;
            if (!user || (user.email !== 'voutop.oficial@gmail.com' && user.role !== 'admin')) {
                return json({
                    success: false,
                    error: 'Database already seeded. Delete existing data first if you want to reseed.',
                    existingGroups: existingCount
                }, { status: 400 });
            }
        }

        // Si está vacío, permitir seed sin auth (primera vez)

        // Datos del checklist original
        const checklistData = [
            {
                title: "📝 Prioridad Inmediata (User Feedback)",
                icon: "Zap",
                color: "text-pink-500",
                items: [
                    { label: "Navegación 'Mi Perfil' unificada", status: "done", detail: "El botón de perfil del menú principal ahora abre el mismo modal completo (UserProfileModal) que al pulsar en el avatar de un usuario, mostrando estadísticas y reels." },
                    { label: "Más gráficos en estadísticas", status: "done", detail: "Añadidos gráficos de Barras, Radar y Polar al modal de estadísticas, además del Donut original." },
                    { label: "Priorizar Reels al pulsar Avatar", status: "done", detail: "Al abrir un reel desde el perfil, se muestran solo las encuestas de ese usuario. Al salir del modo reels, se restaura el feed general." },
                    { label: "Indicador de Reels Vistos (Borde Verde)", status: "done", detail: "Marcar en BD los reels vistos. Si se han visto todos los de un usuario, quitar el borde verde de su avatar (estilo Instagram).", action: "Crear endpoint de 'view', actualizar modelo PollInteraction, lógica en frontend para llamar al endpoint y actualizar UI." },
                    { label: "Refinar Estadísticas en Globo 3D", status: "missing", detail: "Mejorar la visualización y funcionalidad de las estadísticas en el globo terráqueo." },
                    { label: "Corregir Menú de Opciones (3 puntos)", status: "done", critical: true, detail: "Menú funcional con opciones de Reportar, Dejar de Seguir, No me interesa y Copiar enlace, todo conectado al backend y UI.", action: "Revisar eventos click y dispatch en PostOptionsModal y PostCard." },
                    { label: "Embed de Encuesta (Iframe)", status: "missing", detail: "Generar código iframe para poder incrustar la encuesta en otros sitios webs." },
                    { label: "Mejorar Compartir Encuesta", status: "missing", detail: "Revisar y arreglar la funcionalidad de compartir encuesta (link, redes sociales)." },
                    { label: "Organizar Iconos Tab en Perfil", status: "done", detail: "Pestañas de Encuestas, Votaciones y Guardadas organizadas con iconos y contadores." },
                    { label: "Simplificar Botón Seguir", status: "done", detail: "El botón 'Seguir' solo aparece si no sigues al usuario. Si ya lo sigues o está pendiente, se oculta para limpiar la interfaz." },
                    { label: "Bug Votación Swipe", status: "done", critical: true, detail: "La encuesta tipo swipe ahora guarda correctamente la votación y recupera bien el estado al recargar." },
                    { label: "Cambiar ID de usuario por hash", status: "missing", critical: true, detail: "Al igual que con las encuestas, debemos ocultar el ID numérico secuencial del usuario en las URLs y respuestas de la API usando un hash único.", action: "Implementar hashing de IDs en los modelos de Usuario, actualizar transformadores de API y corregir rutas que dependan del ID numérico." },
                ]
            },
            {
                title: "🔐 Autenticación y Seguridad",
                icon: "Shield",
                color: "text-blue-500",
                items: [
                    { label: "Login con Google (OAuth)", status: "done", detail: "El login con Google está completamente implementado. El AuthModal abre un popup de OAuth, el backend procesa el callback y crea/actualiza usuarios automáticamente. Ver GOOGLE_OAUTH_SETUP.md para la configuración." },
                    { label: "Persistencia JWT (LocalStorage)", status: "done", detail: "Cuando el usuario inicia sesión, guardamos un 'token' en el navegador para que no tenga que volver a loguearse cada vez que abre la app." },
                    { label: "Modales de Feedback", status: "done", detail: "Cuando hay un error o algo sale bien, aparecen mensajes visuales (toasts) informando al usuario." },
                    { label: "Lógica de Refresh Token", status: "done", detail: "Sistema completo implementado: endpoint /api/auth/refresh, auto-refresh proactivo antes de expiración, y fetchWithAuth() que reintenta automáticamente en errores 401." },
                    { label: "Rutas Protegidas (Middleware)", status: "done", detail: "Middleware completo implementado en hooks.server.ts: App Signature, JWT extraction, Rate Limiting, Security Headers. Helpers en auth.ts: requireAuth(), requireRole(), requireOwnership() para protección granular de endpoints." },
                    { label: "Página de Mantenimiento (Under Construction)", status: "done", detail: "Diseño profesional 'dark mode' con logo oficial, animaciones orbitales y acceso mediante código secreto (5 clicks) para proteger el acceso durante el desarrollo." },
                ]
            },
            {
                title: "📱 Experiencia de Feed (Core)",
                icon: "Smartphone",
                color: "text-indigo-400",
                items: [
                    { label: "Scroll Virtual (Rendimiento)", status: "done", detail: "El feed carga solo las encuestas visibles para no saturar la memoria del móvil." },
                    { label: "Vista Reels (Inmersiva)", status: "done", detail: "Puedes ver encuestas a pantalla completa estilo TikTok/Instagram Reels." },
                    { label: "Renderizado de Encuestas (Todos los tipos)", status: "done", detail: "Se muestran correctamente todos los tipos: estándar, quiz, ranking (tierlist) y swipe." },
                    { label: "Gestos de Swipe", status: "done", detail: "Puedes deslizar hacia arriba/abajo para navegar y hacia los lados en ciertos tipos de encuesta." },
                    { label: "Rastreo de 'Vistos'", status: "missing", note: "Evitar ver la misma encuesta dos veces", detail: "Cada vez que refrescas el feed, pueden aparecer las mismas encuestas que ya viste. Sería mucho mejor recordar cuáles ya viste y mostrarte solo contenido nuevo.", action: "Guardar en la base de datos o en el dispositivo las encuestas que el usuario ya ha visto." },
                    { label: "Skeleton Loaders", status: "done", detail: "Componente Skeleton.svelte creado con variantes: text, card, poll, reel, avatar, image, button. Integrado en VotingFeed para la carga inicial y placeholders de avatares." },
                    { label: "Optimización de Imágenes (CDN)", status: "missing", note: "Usa URLs crudas sin caché/resize", detail: "Las imágenes de las encuestas se cargan en su tamaño original, lo que puede ser muy lento en móviles. Lo ideal es usar un servicio que las comprima y redimensione automáticamente.", action: "Integrar un servicio como Cloudinary o imgix para servir imágenes optimizadas." },
                    { label: "Pull-to-Refresh", status: "done", detail: "Implementado en VotingFeed: arrastra hacia abajo cuando estés arriba del todo para refrescar. Indicador visual con flecha que se invierte al alcanzar el umbral y spinner durante la carga." },
                ]
            },
            {
                title: "⚡ Mecánicas de Encuestas",
                icon: "Zap",
                color: "text-amber-400",
                items: [
                    { label: "Actualización de Votos (Real-time)", status: "done", detail: "Cuando votas, los porcentajes se actualizan inmediatamente sin recargar la página." },
                    { label: "Guardado de Borradores", status: "done", detail: "Si empiezas a crear una encuesta y cierras, la app recuerda lo que escribiste para que puedas continuar después." },
                    { label: "UI Optimista (Feedback instantáneo)", status: "done", detail: "Cuando votas, la app muestra el cambio inmediatamente sin esperar confirmación del servidor, haciendo la experiencia más fluida." },
                    { label: "Cuenta Atrás (Expiración)", status: "done", detail: "Cuando la cuenta atrás llega a cero, la encuesta se cierra automáticamente y muestra los resultados sin necesidad de recargar la página." },
                    { label: "Feedback Visual Trivial (Quiz)", status: "done", detail: "Implementado sistema completo: Confetti/Cara Triste animados. Feedback limpio mediante bordes de color (Verde=Correcta / Rojo=Fallo) y opacidad reducida en opciones irrelevantes." },
                    { label: "Protección de Voto y Acciones (Auth)", status: "done", detail: "Integración profunda del AuthModal. Si un usuario anónimo intenta votar o seguir, se abre automáticamente el popup de login sin perder el contexto." },
                    { label: "Menú de Opciones de Encuesta", status: "done", detail: "Implementado PostOptionsModal activado desde el icono de 3 puntos. Incluye acciones contextuales: Reportar, Copiar Enlace, Dejar de Seguir y Borrar (si eres autor)." },
                    { label: "Reportar Contenido", status: "done", critical: true, detail: "Botón de 'Reportar' accesible desde el menú de opciones de cada encuesta. Interfaz lista y conectada al flujo de usuario." },
                    { label: "Editar Encuesta (Typos/Duración)", status: "missing", detail: "Si te equivocas escribiendo o quieres cambiar la duración, no puedes. Una vez publicada, la encuesta es inmutable.", action: "Permitir editar texto si aún no hay votos, y siempre permitir extender la duración." },
                    { label: "Ajustes de Visibilidad", status: "done", detail: "Selector de visibilidad añadido al crear encuesta: Público, Solo seguidores, o Solo amigos mutuos. Campo visibility en la BD y UI completa." },
                ]
            },
            {
                title: "🌍 Social y Engagement",
                icon: "Globe",
                color: "text-emerald-400",
                items: [
                    { label: "Sistema de Seguir (API)", status: "done", detail: "Sistema completo conectado backend y frontend. Botón 'Seguir' funcional con estados optimistas y soporte para cuentas privadas (solicitudes pendientes vs. aprobadas)." },
                    { label: "Navegación en Avatar", status: "done", critical: true, detail: "Implementado. Al pulsar en el avatar se abre el modal de perfil del usuario." },
                    { label: "Buscador Global (Usuarios/Tags)", status: "partial", critical: true, note: "UI existe, funcionalidad básica", detail: "El buscador tiene la interfaz lista pero la búsqueda de usuarios puede no mostrar resultados correctos y los hashtags no funcionan.", action: "Revisar que el backend devuelva resultados correctos y añadir soporte de hashtags." },
                    { label: "Actividad/Notificaciones", status: "done", detail: "Implementación completa. Backend registra eventos (Follow, Vote, Comment, Mention). Modal muestra notificaciones reales con filtros, avatares, tiempos relativos ('hace 5 min') y navegación al contenido." },
                    { label: "Sistema de Menciones (@usuario)", status: "done", detail: "Implementado autocompletado de @menciones en comentarios con filtrado de privacidad (solo públicos o amigos mutuos) y notificaciones automáticas al usuario mencionado." },
                    { label: "Mensajes Directos (DM)", status: "partial", detail: "Backend (Modelos, API básica) y conteo de no leídos implementado. Falta UI completa para listar conversaciones y chat.", action: "Crear pantalla de conversaciones y chat individual." },
                    { label: "Compartir en Apps Externas", status: "partial", note: "Modal existe, falta Native Share", detail: "Hay un modal de compartir con Twitter, WhatsApp, etc. pero no usa el menú nativo del móvil que aparece al compartir en otras apps.", action: "Integrar la Web Share API para que en móviles aparezca el menú nativo de compartir." },
                    { label: "Comentarios Anidados", status: "done", detail: "Implementado sistema de respuestas (Reply) con indentación visual, agrupación correcta en la UI y soporte para menciones." },
                ]
            },
            {
                title: "👤 Identidad y Ajustes",
                icon: "Users",
                color: "text-purple-400",
                items: [
                    { label: "Perfil de Usuario (Lectura)", status: "done", detail: "Puedes ver el perfil de otros usuarios con sus encuestas y estadísticas." },
                    { label: "Historial de Votos", status: "done", detail: "En el perfil se muestran las encuestas en las que has participado." },
                    { label: "Editar Perfil (Bio/Avatar)", status: "missing", detail: "No hay forma de cambiar tu foto, tu nombre o escribir una biografía. Estás atrapado con lo que Google te asignó.", action: "Crear una pantalla de 'Editar Perfil' con formulario para cambiar estos datos." },
                    { label: "Selector de Tema (Oscuro/Claro)", status: "partial", note: "Componente existe pero no está conectado", detail: "Hay un componente de cambio de tema pero no está visible ni accesible para el usuario en la configuración.", action: "Añadir acceso al selector de tema en la pantalla de ajustes." },
                    { label: "Borrar Cuenta (GDPR)", status: "done", detail: "Implementado endpoint /api/user/delete-account que elimina todos los datos del usuario de forma segura, anonimizando votos pero eliminando contenido creado." },
                    { label: "Lista de Bloqueados", status: "missing", detail: "Si bloqueas a alguien (si esa función existiera), no hay forma de ver o gestionar a quién has bloqueado.", action: "Crear pantalla de gestión de usuarios bloqueados." },
                ]
            },
            {
                title: "⚖️ Legal & GDPR",
                icon: "Shield",
                color: "text-green-500",
                items: [
                    { label: "Página Legal Completa (/legal)", status: "done", detail: "Página con pestañas para Aviso Legal, Política de Privacidad, Términos y Condiciones, y Política de Cookies. Textos finales en español adaptados a legislación española y europea." },
                    { label: "Banner de Cookies (GDPR)", status: "done", detail: "CookieBanner.svelte implementado: aparece en primera visita, permite aceptar todas, solo esenciales, o personalizar. Guarda preferencias en localStorage y servidor si está logueado." },
                    { label: "Verificación de Edad (+16)", status: "done", detail: "AgeVerificationModal.svelte: requiere confirmar ser mayor de 16 años antes de interactuar. Checkboxes integrados en AuthModal durante el registro." },
                    { label: "Consentimiento de Términos", status: "done", detail: "Durante el login, el usuario debe aceptar Términos de Uso y Política de Privacidad. Checkboxes obligatorios en AuthModal antes de continuar con Google OAuth." },
                    { label: "API de Consentimiento", status: "done", detail: "Endpoint /api/user/consent (GET/POST) para obtener y guardar consentimiento del usuario. Modelo UserConsent en Prisma con versionado de documentos." },
                    { label: "Modelo UserConsent (BD)", status: "done", detail: "Tabla en PostgreSQL que almacena: isOver16, termsAccepted, privacyAccepted, cookiesEssential/Analytics/Advertising, versiones de documentos, IP y timestamps." },
                ]
            },
            {
                title: "🛡️ Seguridad Anti-Bot",
                icon: "Shield",
                color: "text-red-500",
                items: [
                    { label: "Rate Limiting Estricto", status: "done", detail: "Sistema de rate limiting por minuto: 5 votos/min, 3 comentarios/min, 1 encuesta/min, 10 follows/min. Diferenciado por rol (user/premium/admin). Respuesta 429 sin detalles." },
                    { label: "Verificación Server-Side", status: "done", detail: "userGuard.ts: cada acción verifica token válido, usuario +16, cuenta no baneada. guardUserAction() y guardUserRead() para protección granular de endpoints." },
                    { label: "Sistema Honeypot", status: "done", detail: "honeypot.ts: campos ocultos en formularios que bots rellenan pero humanos ignoran. Si detectado, respuesta de éxito falso sin procesar acción." },
                    { label: "Detector de Comportamiento", status: "done", detail: "behaviorDetector.ts: analiza patrones sospechosos (votación rápida, comentarios repetitivos, user agents de bots). Acumula puntos de sospecha automáticamente." },
                    { label: "Sistema Shadowban", status: "done", detail: "Usuarios sospechosos son shadowbanned: sus acciones parecen funcionar pero no tienen efecto real. El bot cree que ganó mientras sus datos no contaminan métricas." },
                    { label: "Campos de Seguridad en User", status: "done", detail: "Modelo User extendido con: isBanned, banReason, bannedAt, isShadowbanned, isSuspect, suspectScore, lastActiveAt. Auto-shadowban al superar umbral de sospecha." },
                    { label: "Helper secureAction()", status: "done", detail: "Función unificada para proteger endpoints: verifica honeypot, usuario, comportamiento, y devuelve respuesta apropiada (shadowban o acción real). Uso simple en cualquier endpoint." },
                    { label: "CAPTCHA Invisible", status: "missing", note: "Preparado para Cloudflare Turnstile", detail: "Infraestructura lista pero falta integrar Cloudflare Turnstile en puntos críticos: crear cuenta, crear encuesta, picos de spam.", action: "Registrar en Cloudflare, obtener keys, integrar en frontend y validar en backend." },
                ]
            },
        ];

        // Insertar en la base de datos
        let groupOrder = 0;
        for (const groupData of checklistData) {
            const group = await prisma.checklistGroup.create({
                data: {
                    title: groupData.title,
                    icon: groupData.icon,
                    color: groupData.color,
                    displayOrder: groupOrder++
                }
            });

            let itemOrder = 0;
            for (const itemData of groupData.items) {
                await prisma.checklistItem.create({
                    data: {
                        groupId: group.id,
                        label: itemData.label,
                        status: itemData.status,
                        detail: itemData.detail,
                        note: (itemData as any).note || null,
                        action: (itemData as any).action || null,
                        critical: (itemData as any).critical || false,
                        displayOrder: itemOrder++
                    }
                });
            }
        }

        return json({
            success: true,
            message: 'Checklist seeded successfully',
            groupsCreated: checklistData.length,
            itemsCreated: checklistData.reduce((sum, g) => sum + g.items.length, 0)
        });
    } catch (error) {
        console.error('[API Checklist Seed] Error:', error);
        return json({ success: false, error: 'Error seeding checklist' }, { status: 500 });
    }
};
