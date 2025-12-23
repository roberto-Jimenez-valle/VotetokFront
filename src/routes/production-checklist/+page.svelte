<script>
    import {
        CheckCircle,
        Circle,
        AlertCircle,
        BarChart2,
        Shield,
        Zap,
        Users,
        Smartphone,
        Globe,
        ArrowRight,
    } from "lucide-svelte";

    // Datos de la lista de control
    const checklistGroups = [
        {
            title: "🔐 Autenticación y Seguridad",
            icon: Shield,
            color: "text-blue-500",
            items: [
                {
                    label: "Login con Google (OAuth)",
                    status: "missing",
                    critical: true,
                    note: "Único método de acceso permitido (sin password)",
                },
                { label: "Persistencia JWT (LocalStorage)", status: "done" },
                { label: "Modales de Feedback", status: "done" },
                {
                    label: "Lógica de Refresh Token",
                    status: "missing",
                    critical: true,
                    note: "Fallo silencioso en 401 actualmente",
                },
                {
                    label: "Rutas Protegidas (Middleware)",
                    status: "partial",
                    note: "Solo chequeos básicos en cliente",
                },
            ],
        },
        {
            title: "📱 Experiencia de Feed (Core)",
            icon: Smartphone,
            color: "text-indigo-400",
            items: [
                { label: "Scroll Virtual (Rendimiento)", status: "done" },
                { label: "Vista Reels (Inmersiva)", status: "done" },
                {
                    label: "Renderizado de Encuestas (Todos los tipos)",
                    status: "done",
                },
                { label: "Gestos de Swipe", status: "done" },
                {
                    label: "Rastreo de 'Vistos'",
                    status: "missing",
                    note: "Evitar ver la misma encuesta dos veces",
                },
                {
                    label: "Skeleton Loaders",
                    status: "missing",
                    note: "Actualmente usa spinners simples",
                },
                {
                    label: "Optimización de Imágenes (CDN)",
                    status: "missing",
                    note: "Usa URLs crudas sin caché/resize",
                },
                { label: "Pull-to-Refresh", status: "missing" },
            ],
        },
        {
            title: "⚡ Mecánicas de Encuestas",
            icon: Zap,
            color: "text-amber-400",
            items: [
                { label: "Actualización de Votos (Real-time)", status: "done" },
                { label: "Guardado de Borradores", status: "done" },
                {
                    label: "UI Optimista (Feedback instantáneo)",
                    status: "done",
                },
                {
                    label: "Cuenta Atrás (Expiración)",
                    status: "partial",
                    note: "Solo visual, falta evento auto-close",
                },
                {
                    label: "Reportar Contenido",
                    status: "missing",
                    critical: true,
                },
                {
                    label: "Editar Encuesta (Typos/Duración)",
                    status: "missing",
                },
                {
                    label: "Ajustes de Visibilidad",
                    status: "missing",
                    note: "Público vs Solo Amigos",
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
                    status: "missing",
                    critical: true,
                },
                {
                    label: "Navegación en Avatar",
                    status: "missing",
                    critical: true,
                },
                {
                    label: "Buscador Global (Usuarios/Tags)",
                    status: "missing",
                    critical: true,
                },
                {
                    label: "Actividad/Notificaciones",
                    status: "missing",
                    note: "Solo datos mockeados",
                },
                { label: "Mensajes Directos (DM)", status: "missing" },
                { label: "Compartir en Apps Externas", status: "missing" },
                { label: "Comentarios Anidados", status: "missing" },
            ],
        },
        {
            title: "👤 Identidad y Ajustes",
            icon: Users,
            color: "text-purple-400",
            items: [
                { label: "Perfil de Usuario (Lectura)", status: "done" },
                { label: "Historial de Votos", status: "done" },
                { label: "Editar Perfil (Bio/Avatar)", status: "missing" },
                { label: "Selector de Tema (Oscuro/Claro)", status: "missing" },
                {
                    label: "Borrar Cuenta (GDPR)",
                    status: "missing",
                    critical: true,
                },
                { label: "Lista de Bloqueados", status: "missing" },
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
    const readinessBg =
        progress > 80
            ? "bg-emerald-500"
            : progress > 50
              ? "bg-amber-500"
              : "bg-red-500";
</script>

<div
    class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 p-8 md:p-16"
>
    <div class="max-w-4xl mx-auto space-y-12">
        <!-- Header -->
        <header class="border-b border-white/10 pb-8 relative overflow-hidden">
            <div
                class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"
            >
                <Shield class="w-64 h-64 text-white" />
            </div>

            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-2">
                    <span
                        class="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest border border-indigo-500/30"
                        >Herramienta Interna</span
                    >
                    <span
                        class="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono"
                        >v0.9.2</span
                    >
                </div>
                <h1
                    class="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight"
                >
                    Checklist de <span
                        class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400"
                        >Producción</span
                    >
                </h1>
                <p class="text-xl text-slate-400 max-w-2xl">
                    Estado actual del desarrollo, funcionalidades críticas
                    pendientes y bugs bloqueantes para el lanzamiento v1.0.
                </p>
            </div>
        </header>

        <!-- Progress Overview -->
        <section class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Main Score -->
            <div
                class="md:col-span-2 bg-slate-900/50 rounded-2xl p-8 border border-white/10 relative overflow-hidden flex items-center gap-8"
            >
                <div
                    class="relative w-32 h-32 flex items-center justify-center shrink-0"
                >
                    <svg class="w-full h-full transform -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            stroke-width="12"
                            fill="transparent"
                            class="text-slate-800"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            stroke-width="12"
                            fill="transparent"
                            class={readinessColor}
                            stroke-dasharray="351.86"
                            stroke-dashoffset={351.86 -
                                (351.86 * progress) / 100}
                            stroke-linecap="round"
                        />
                    </svg>
                    <span class="absolute text-3xl font-black {readinessColor}"
                        >{progress}%</span
                    >
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-white mb-2">
                        Estado de Producción
                    </h2>
                    <p class="text-slate-400 text-sm leading-relaxed">
                        La aplicación se encuentra en una fase de
                        {#if progress > 80}
                            <span class="text-emerald-400 font-bold"
                                >Pulido Final</span
                            >. La mayoría de las funcionalidades core están
                            listas.
                        {:else if progress > 50}
                            <span class="text-amber-400 font-bold"
                                >Desarrollo Activo</span
                            >. El core funciona pero faltan integraciones clave.
                        {:else}
                            <span class="text-red-400 font-bold"
                                >Desarrollo Temprano</span
                            >. Faltan piezas fundamentales.
                        {/if}
                    </p>
                </div>
            </div>

            <!-- Quick Stats -->
            <div
                class="bg-slate-900/50 rounded-2xl p-8 border border-white/10 flex flex-col justify-center gap-4"
            >
                <div>
                    <span
                        class="text-slate-500 text-xs font-bold uppercase tracking-wider"
                        >Total Ítems</span
                    >
                    <div class="text-3xl font-black text-white">
                        {totalItems}
                    </div>
                </div>
                <div>
                    <span
                        class="text-slate-500 text-xs font-bold uppercase tracking-wider"
                        >Completados</span
                    >
                    <div class="text-3xl font-black text-emerald-400">
                        {Math.floor(completedItems)}
                    </div>
                </div>
                <div>
                    <span
                        class="text-slate-500 text-xs font-bold uppercase tracking-wider"
                        >Pendientes</span
                    >
                    <div class="text-3xl font-black text-indigo-400">
                        {Math.ceil(totalItems - completedItems)}
                    </div>
                </div>
            </div>
        </section>

        <!-- Detailed Checklist -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            {#each checklistGroups as group}
                <section
                    class="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden"
                >
                    <header
                        class="p-6 bg-white/5 border-b border-white/5 flex items-center gap-3"
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
                    <div class="p-2">
                        {#each group.items as item}
                            <div
                                class="flex items-start gap-3 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group"
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
                                            class="text-slate-600 group-hover:text-slate-500"
                                            size={20}
                                        />
                                    {/if}
                                </div>
                                <div class="flex-1">
                                    <div
                                        class="flex items-center justify-between"
                                    >
                                        <span
                                            class="text-sm font-medium {item.status ===
                                            'done'
                                                ? 'text-white line-through opacity-50'
                                                : 'text-slate-200'}"
                                        >
                                            {item.label}
                                        </span>
                                        {#if item.critical}
                                            <span
                                                class="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded border border-red-500/20"
                                                >Crítico</span
                                            >
                                        {/if}
                                    </div>
                                    {#if item.note}
                                        <p
                                            class="text-xs text-slate-500 mt-1 pl-1 border-l-2 border-slate-700"
                                        >
                                            {item.note}
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
            {/each}
        </div>

        <footer class="mt-12 text-center text-slate-600 text-sm">
            <p>
                Generado por Asistente Antigravity &bullet; {new Date().toLocaleDateString()}
            </p>
        </footer>
    </div>
</div>

<style>
    /* Global Background Override */
    :global(body) {
        background-color: #020617;
    }
</style>
