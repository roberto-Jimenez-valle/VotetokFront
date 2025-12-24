<script lang="ts">
    import {
        CheckCircle,
        Circle,
        AlertCircle,
        Shield,
        Zap,
        Users,
        Smartphone,
        Globe,
        ChevronDown,
        ChevronUp,
        ArrowLeft,
    } from "lucide-svelte";
    import { fly } from "svelte/transition";

    // Estado de expansión de cada item
    let expandedItems = $state<Record<string, boolean>>({});

    function toggleItem(groupIndex: number, itemIndex: number) {
        const key = `${groupIndex}-${itemIndex}`;
        expandedItems[key] = !expandedItems[key];
    }

    // Datos de la lista de control con detalles extendidos
    const checklistGroups = [
        {
            title: "🔐 Autenticación y Seguridad",
            icon: Shield,
            color: "text-blue-500",
            items: [
                {
                    label: "Login con Google (OAuth)",
                    status: "done",
                    detail: "El login con Google está completamente implementado. El AuthModal abre un popup de OAuth, el backend procesa el callback y crea/actualiza usuarios automáticamente. Ver GOOGLE_OAUTH_SETUP.md para la configuración.",
                },
                {
                    label: "Persistencia JWT (LocalStorage)",
                    status: "done",
                    detail: "Cuando el usuario inicia sesión, guardamos un 'token' en el navegador para que no tenga que volver a loguearse cada vez que abre la app.",
                },
                {
                    label: "Modales de Feedback",
                    status: "done",
                    detail: "Cuando hay un error o algo sale bien, aparecen mensajes visuales (toasts) informando al usuario.",
                },
                {
                    label: "Lógica de Refresh Token",
                    status: "done",
                    detail: "Sistema completo implementado: endpoint /api/auth/refresh, auto-refresh proactivo antes de expiración, y fetchWithAuth() que reintenta automáticamente en errores 401.",
                },
                {
                    label: "Rutas Protegidas (Middleware)",
                    status: "done",
                    detail: "Middleware completo implementado en hooks.server.ts: App Signature, JWT extraction, Rate Limiting, Security Headers. Helpers en auth.ts: requireAuth(), requireRole(), requireOwnership() para protección granular de endpoints.",
                },
            ],
        },
        {
            title: "📱 Experiencia de Feed (Core)",
            icon: Smartphone,
            color: "text-indigo-400",
            items: [
                {
                    label: "Scroll Virtual (Rendimiento)",
                    status: "done",
                    detail: "El feed carga solo las encuestas visibles para no saturar la memoria del móvil.",
                },
                {
                    label: "Vista Reels (Inmersiva)",
                    status: "done",
                    detail: "Puedes ver encuestas a pantalla completa estilo TikTok/Instagram Reels.",
                },
                {
                    label: "Renderizado de Encuestas (Todos los tipos)",
                    status: "done",
                    detail: "Se muestran correctamente todos los tipos: estándar, quiz, ranking (tierlist) y swipe.",
                },
                {
                    label: "Gestos de Swipe",
                    status: "done",
                    detail: "Puedes deslizar hacia arriba/abajo para navegar y hacia los lados en ciertos tipos de encuesta.",
                },
                {
                    label: "Rastreo de 'Vistos'",
                    status: "missing",
                    note: "Evitar ver la misma encuesta dos veces",
                    detail: "Cada vez que refrescas el feed, pueden aparecer las mismas encuestas que ya viste. Sería mucho mejor recordar cuáles ya viste y mostrarte solo contenido nuevo.",
                    action: "Guardar en la base de datos o en el dispositivo las encuestas que el usuario ya ha visto.",
                },
                {
                    label: "Skeleton Loaders",
                    status: "done",
                    detail: "Componente Skeleton.svelte creado con variantes: text, card, poll, avatar, image, button. Integrado en VotingFeed para la carga inicial y placeholders de avatares.",
                },
                {
                    label: "Optimización de Imágenes (CDN)",
                    status: "missing",
                    note: "Usa URLs crudas sin caché/resize",
                    detail: "Las imágenes de las encuestas se cargan en su tamaño original, lo que puede ser muy lento en móviles. Lo ideal es usar un servicio que las comprima y redimensione automáticamente.",
                    action: "Integrar un servicio como Cloudinary o imgix para servir imágenes optimizadas.",
                },
                {
                    label: "Pull-to-Refresh",
                    status: "done",
                    detail: "Implementado en VotingFeed: arrastra hacia abajo cuando estés arriba del todo para refrescar. Indicador visual con flecha que se invierte al alcanzar el umbral y spinner durante la carga.",
                },
            ],
        },
        {
            title: "⚡ Mecánicas de Encuestas",
            icon: Zap,
            color: "text-amber-400",
            items: [
                {
                    label: "Actualización de Votos (Real-time)",
                    status: "done",
                    detail: "Cuando votas, los porcentajes se actualizan inmediatamente sin recargar la página.",
                },
                {
                    label: "Guardado de Borradores",
                    status: "done",
                    detail: "Si empiezas a crear una encuesta y cierras, la app recuerda lo que escribiste para que puedas continuar después.",
                },
                {
                    label: "UI Optimista (Feedback instantáneo)",
                    status: "done",
                    detail: "Cuando votas, la app muestra el cambio inmediatamente sin esperar confirmación del servidor, haciendo la experiencia más fluida.",
                },
                {
                    label: "Cuenta Atrás (Expiración)",
                    status: "done",
                    detail: "Cuando la cuenta atrás llega a cero, la encuesta se cierra automáticamente y muestra los resultados sin necesidad de recargar la página.",
                },
                {
                    label: "Reportar Contenido",
                    status: "missing",
                    critical: true,
                    detail: "Si alguien publica contenido ofensivo, no hay forma de denunciarlo. Esto es crítico para cualquier red social, tanto por seguridad como por requisitos legales.",
                    action: "Añadir un botón de 'Reportar' en cada encuesta que envíe el reporte a un panel de moderación.",
                },
                {
                    label: "Editar Encuesta (Typos/Duración)",
                    status: "missing",
                    detail: "Si te equivocas escribiendo o quieres cambiar la duración, no puedes. Una vez publicada, la encuesta es inmutable.",
                    action: "Permitir editar texto si aún no hay votos, y siempre permitir extender la duración.",
                },
                {
                    label: "Ajustes de Visibilidad",
                    status: "done",
                    detail: "Selector de visibilidad añadido al crear encuesta: Público, Solo seguidores, o Solo amigos mutuos. Campo visibility en la BD y UI completa.",
                },
            ],
        },
        {
            title: "🌍 Social y Engagement",
            icon: Globe,
            color: "text-emerald-400",
            items: [
                {
                    label: "Sistema de Seguir (API)",
                    status: "done",
                    detail: "Sistema completo conectado backend y frontend. Botón 'Seguir' funcional con estados optimistas y soporte para cuentas privadas (solicitudes pendientes vs. aprobadas).",
                },
                {
                    label: "Navegación en Avatar",
                    status: "missing",
                    critical: true,
                    detail: "Cuando pulsas en la foto de perfil de alguien en el feed, no pasa nada. Debería abrirse su perfil.",
                    action: "Hacer clicable el avatar y que abra el modal de perfil del usuario.",
                },
                {
                    label: "Buscador Global (Usuarios/Tags)",
                    status: "partial",
                    critical: true,
                    note: "UI existe, funcionalidad básica",
                    detail: "El buscador tiene la interfaz lista pero la búsqueda de usuarios puede no mostrar resultados correctos y los hashtags no funcionan.",
                    action: "Revisar que el backend devuelva resultados correctos y añadir soporte de hashtags.",
                },
                {
                    label: "Actividad/Notificaciones",
                    status: "done",
                    detail: "Implementación completa. Backend registra eventos (Follow, Vote, Comment). Modal muestra notificaciones reales con filtros, avatares, tiempos relativos ('hace 5 min') y navegación al contenido.",
                },
                {
                    label: "Mensajes Directos (DM)",
                    status: "partial",
                    detail: "Backend (Modelos, API básica) y conteo de no leídos implementado. Falta UI completa para listar conversaciones y chat.",
                    action: "Crear pantalla de conversaciones y chat individual.",
                },
                {
                    label: "Compartir en Apps Externas",
                    status: "partial",
                    note: "Modal existe, falta Native Share",
                    detail: "Hay un modal de compartir con Twitter, WhatsApp, etc. pero no usa el menú nativo del móvil que aparece al compartir en otras apps.",
                    action: "Integrar la Web Share API para que en móviles aparezca el menú nativo de compartir.",
                },
                {
                    label: "Comentarios Anidados",
                    status: "partial",
                    note: "Sistema básico existe",
                    detail: "Se pueden escribir comentarios pero las respuestas a comentarios (hilos) tienen limitaciones visuales.",
                    action: "Mejorar la UI de respuestas y añadir indicadores visuales de hilos.",
                },
            ],
        },
        {
            title: "👤 Identidad y Ajustes",
            icon: Users,
            color: "text-purple-400",
            items: [
                {
                    label: "Perfil de Usuario (Lectura)",
                    status: "done",
                    detail: "Puedes ver el perfil de otros usuarios con sus encuestas y estadísticas.",
                },
                {
                    label: "Historial de Votos",
                    status: "done",
                    detail: "En el perfil se muestran las encuestas en las que has participado.",
                },
                {
                    label: "Editar Perfil (Bio/Avatar)",
                    status: "missing",
                    detail: "No hay forma de cambiar tu foto, tu nombre o escribir una biografía. Estás atrapado con lo que Google te asignó.",
                    action: "Crear una pantalla de 'Editar Perfil' con formulario para cambiar estos datos.",
                },
                {
                    label: "Selector de Tema (Oscuro/Claro)",
                    status: "partial",
                    note: "Componente existe pero no está conectado",
                    detail: "Hay un componente de cambio de tema pero no está visible ni accesible para el usuario en la configuración.",
                    action: "Añadir acceso al selector de tema en la pantalla de ajustes.",
                },
                {
                    label: "Borrar Cuenta (GDPR)",
                    status: "missing",
                    critical: true,
                    detail: "Legalmente, los usuarios europeos tienen derecho a eliminar todos sus datos. Ahora mismo no pueden. Esto puede ser un problema legal importante.",
                    action: "Añadir opción en ajustes para solicitar eliminación completa de cuenta y datos.",
                },
                {
                    label: "Lista de Bloqueados",
                    status: "missing",
                    detail: "Si bloqueas a alguien (si esa función existiera), no hay forma de ver o gestionar a quién has bloqueado.",
                    action: "Crear pantalla de gestión de usuarios bloqueados.",
                },
            ],
        },
    ];

    // Calculate stats
    let totalItems = 0;
    let completedItems = 0;

    checklistGroups.forEach((group) => {
        group.items.forEach((item) => {
            totalItems++;
            if (item.status === "done") completedItems++;
            if (item.status === "partial") completedItems += 0.5;
        });
    });

    const progress = Math.round((completedItems / totalItems) * 100);

    const readinessColor =
        progress > 80
            ? "text-emerald-400"
            : progress > 50
              ? "text-amber-400"
              : "text-red-400";
</script>

<div
    class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 p-4 md:p-12"
>
    <div class="max-w-4xl mx-auto space-y-10">
        <!-- Header -->
        <header class="border-b border-white/10 pb-6 relative overflow-hidden">
            <div
                class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"
            >
                <Shield class="w-48 h-48 text-white" />
            </div>

            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-2">
                    <span
                        class="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest border border-indigo-500/30"
                        >Herramienta Interna</span
                    >
                    <span
                        class="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono"
                        >v0.9.3</span
                    >
                </div>
                <h1
                    class="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight"
                >
                    Checklist de <span
                        class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400"
                        >Producción</span
                    >
                </h1>
                <p class="text-lg text-slate-400 max-w-2xl">
                    Pulsa en cualquier ítem para ver qué hay que hacer y cómo
                    proceder.
                </p>
            </div>
        </header>

        <!-- Progress Overview -->
        <section
            class="bg-slate-900/50 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-center gap-6"
        >
            <div
                class="relative w-28 h-28 flex items-center justify-center shrink-0"
            >
                <svg class="w-full h-full transform -rotate-90">
                    <circle
                        cx="56"
                        cy="56"
                        r="48"
                        stroke="currentColor"
                        stroke-width="10"
                        fill="transparent"
                        class="text-slate-800"
                    />
                    <circle
                        cx="56"
                        cy="56"
                        r="48"
                        stroke="currentColor"
                        stroke-width="10"
                        fill="transparent"
                        class={readinessColor}
                        stroke-dasharray="301.6"
                        stroke-dashoffset={301.6 - (301.6 * progress) / 100}
                        stroke-linecap="round"
                    />
                </svg>
                <span class="absolute text-2xl font-black {readinessColor}"
                    >{progress}%</span
                >
            </div>
            <div class="text-center md:text-left">
                <h2 class="text-xl font-bold text-white mb-1">
                    Progreso Global
                </h2>
                <p class="text-slate-400 text-sm">
                    <span class="text-emerald-400 font-bold"
                        >{Math.floor(completedItems)}</span
                    >
                    de <span class="text-white font-bold">{totalItems}</span>
                    ítems completados.
                    {#if progress < 50}
                        Aún queda bastante trabajo por hacer.
                    {:else if progress < 80}
                        Buen avance, pero hay puntos críticos pendientes.
                    {:else}
                        ¡Casi listos para producción!
                    {/if}
                </p>
            </div>
        </section>

        <!-- Detailed Checklist -->
        <div class="space-y-6">
            {#each checklistGroups as group, groupIndex}
                <section
                    class="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden"
                >
                    <header
                        class="p-5 bg-white/5 border-b border-white/5 flex items-center gap-3"
                    >
                        <div
                            class="p-2 rounded-lg bg-slate-950 border border-white/10 {group.color}"
                        >
                            <svelte:component this={group.icon} size={20} />
                        </div>
                        <h3 class="font-bold text-lg text-white">
                            {group.title}
                        </h3>
                    </header>
                    <div class="divide-y divide-white/5">
                        {#each group.items as item, itemIndex}
                            {@const isExpanded =
                                expandedItems[`${groupIndex}-${itemIndex}`]}
                            <div
                                class="transition-colors {item.status !== 'done'
                                    ? 'hover:bg-white/5'
                                    : ''}"
                            >
                                <button
                                    class="w-full flex items-start gap-3 p-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    onclick={() =>
                                        toggleItem(groupIndex, itemIndex)}
                                    disabled={item.status === "done" &&
                                        !item.detail}
                                >
                                    <div class="mt-0.5 shrink-0">
                                        {#if item.status === "done"}
                                            <CheckCircle
                                                class="text-emerald-500"
                                                size={20}
                                            />
                                        {:else if item.status === "partial"}
                                            <AlertCircle
                                                class="text-amber-500"
                                                size={20}
                                            />
                                        {:else}
                                            <Circle
                                                class="text-slate-600"
                                                size={20}
                                            />
                                        {/if}
                                    </div>
                                    <div class="flex-1">
                                        <div
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <span
                                                class="text-sm font-medium {item.status ===
                                                'done'
                                                    ? 'text-white/50 line-through'
                                                    : 'text-slate-200'}"
                                            >
                                                {item.label}
                                            </span>
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                {#if item.critical}
                                                    <span
                                                        class="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded"
                                                        >Crítico</span
                                                    >
                                                {/if}
                                                {#if item.detail && item.status !== "done"}
                                                    {#if isExpanded}
                                                        <ChevronUp
                                                            size={16}
                                                            class="text-slate-500"
                                                        />
                                                    {:else}
                                                        <ChevronDown
                                                            size={16}
                                                            class="text-slate-500"
                                                        />
                                                    {/if}
                                                {/if}
                                            </div>
                                        </div>
                                        {#if item.note && !isExpanded}
                                            <p
                                                class="text-xs text-slate-500 mt-1"
                                            >
                                                {item.note}
                                            </p>
                                        {/if}
                                    </div>
                                </button>

                                <!-- Expanded Detail -->
                                {#if isExpanded && item.detail}
                                    <div
                                        class="px-4 pb-4 ml-8 border-l-2 border-indigo-500/30 space-y-3"
                                        transition:fly={{
                                            y: -10,
                                            duration: 200,
                                        }}
                                    >
                                        <div
                                            class="bg-slate-800/50 rounded-lg p-4"
                                        >
                                            <h4
                                                class="text-sm font-bold text-white mb-2"
                                            >
                                                ¿Qué significa esto?
                                            </h4>
                                            <p
                                                class="text-sm text-slate-300 leading-relaxed"
                                            >
                                                {item.detail}
                                            </p>
                                        </div>
                                        {#if item.action}
                                            <div
                                                class="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4"
                                            >
                                                <h4
                                                    class="text-sm font-bold text-indigo-300 mb-2"
                                                >
                                                    📋 Cómo proceder:
                                                </h4>
                                                <p
                                                    class="text-sm text-indigo-200/80 leading-relaxed"
                                                >
                                                    {item.action}
                                                </p>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </section>
            {/each}
        </div>

        <footer class="mt-10 text-center text-slate-600 text-sm">
            <p>
                Generado por Asistente Antigravity &bullet; {new Date().toLocaleDateString()}
            </p>
        </footer>
    </div>
</div>

<style>
    :global(body) {
        background-color: #020617;
    }
</style>
