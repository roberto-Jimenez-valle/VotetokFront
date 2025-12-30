<script lang="ts">
    import { onMount } from "svelte";
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
        Plus,
        Trash2,
        Edit3,
        Save,
        X,
        RefreshCw,
        Database,
    } from "lucide-svelte";
    import { fly, fade } from "svelte/transition";
    import type { ComponentType } from "svelte";

    // Type definition for checklist items
    interface ChecklistItem {
        id?: number;
        label: string;
        status: "done" | "partial" | "missing";
        detail: string;
        note?: string;
        critical?: boolean;
        action?: string;
        displayOrder?: number;
        groupId?: number;
    }

    interface ChecklistGroup {
        id?: number;
        title: string;
        icon: string;
        color: string;
        items: ChecklistItem[];
        displayOrder?: number;
    }

    // Icon mapping
    const iconMap: Record<string, ComponentType> = {
        Zap,
        Shield,
        Smartphone,
        Globe,
        Users,
    };

    function getIcon(iconName: string): ComponentType {
        return iconMap[iconName] || Zap;
    }

    // State
    let checklistGroups = $state<ChecklistGroup[]>([]);
    let expandedItems = $state<Record<string, boolean>>({});
    let isLoading = $state(true);
    let error = $state<string | null>(null);
    let isSeeding = $state(false);
    let seedMessage = $state<string | null>(null);

    // Add new item state
    let showAddItem = $state<Record<number, boolean>>({});
    let newItemLabel = $state<Record<number, string>>({});
    let newItemDetail = $state<Record<number, string>>({});
    let newItemCritical = $state<Record<number, boolean>>({});

    // Add new group state
    let showAddGroup = $state(false);
    let newGroupTitle = $state("");
    let newGroupColor = $state("text-gray-500");

    // Edit item state
    let editingItemId = $state<number | null>(null);
    let editItemData = $state<Partial<ChecklistItem>>({});

    // ============================================
    // CAMBIOS DEL ASISTENTE (Hardcoded)
    // ============================================
    interface AIChange {
        id: string;
        label: string;
        detail: string;
        files: string[];
        date: string;
        status: "pending" | "validated" | "issue";
        issueNote?: string;
    }

    // Cambios implementados por el asistente - ACTUALIZAR ESTA LISTA
    const aiChangesData: Omit<AIChange, "status" | "issueNote">[] = [
        {
            id: "follow-btn-lists",
            label: 'Botones "Seguir" en listas de Seguidores/Siguiendo',
            detail: 'Añadidos botones interactivos de "Seguir", "Siguiendo" y "Solicitado" en las pestañas de seguidores y siguiendo del perfil de usuario. Permite seguir/dejar de seguir directamente desde la lista.',
            files: [
                "src/lib/UserProfileModal.svelte",
                "src/routes/api/users/[id]/followers/+server.ts",
                "src/routes/api/users/[id]/following/+server.ts",
            ],
            date: "2024-12-30",
        },
        {
            id: "follow-btn-notifs",
            label: 'Botón "Seguir" en notificaciones de follow',
            detail: 'Añadido botón de "Seguir también" en las notificaciones de tipo "ha empezado a seguirte". Permite devolver el follow sin entrar al perfil.',
            files: [
                "src/lib/NotificationsModal.svelte",
                "src/routes/api/notifications/+server.ts",
            ],
            date: "2024-12-30",
        },
        {
            id: "fix-double-name",
            label: "Corrección nombre duplicado en notificaciones",
            detail: 'Solucionado el bug donde aparecía "Roberto Jiménez Valle robertojimenezvalle ha empezado a seguirte". Ahora el mensaje es limpio.',
            files: ["src/routes/api/users/[id]/follow/+server.ts"],
            date: "2024-12-30",
        },
        {
            id: "theme-toggle",
            label: "Selector de tema conectado",
            detail: 'El interruptor de "Modo oscuro" en los ajustes del perfil ahora está conectado al estado global. Cambiarlo afecta a toda la app.',
            files: ["src/lib/UserProfileModal.svelte"],
            date: "2024-12-30",
        },
        {
            id: "search-hashtags",
            label: "Búsqueda de hashtags mejorada",
            detail: "La API de búsqueda ahora permite buscar por hashtags. Las encuestas se filtran por tags y hay una sección específica de hashtags en resultados.",
            files: ["src/routes/api/search/+server.ts"],
            date: "2024-12-30",
        },
    ];

    // Estado de validación guardado en localStorage
    let aiChangesStatus = $state<
        Record<
            string,
            { status: "pending" | "validated" | "issue"; issueNote?: string }
        >
    >({});

    // Cargar estado desde localStorage
    function loadAIChangesStatus() {
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("ai-changes-status");
            if (saved) {
                try {
                    aiChangesStatus = JSON.parse(saved);
                } catch (e) {
                    aiChangesStatus = {};
                }
            }
        }
    }

    // Guardar estado en localStorage
    function saveAIChangesStatus() {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(
                "ai-changes-status",
                JSON.stringify(aiChangesStatus),
            );
        }
    }

    function setAIChangeStatus(
        id: string,
        status: "pending" | "validated" | "issue",
        issueNote?: string,
    ) {
        aiChangesStatus[id] = { status, issueNote };
        aiChangesStatus = { ...aiChangesStatus }; // Trigger reactivity
        saveAIChangesStatus();
    }

    // Derived: AI changes with their status
    let aiChanges = $derived(
        aiChangesData.map((change) => ({
            ...change,
            status: aiChangesStatus[change.id]?.status || "pending",
            issueNote: aiChangesStatus[change.id]?.issueNote,
        })),
    );

    let aiChangesExpanded = $state<Record<string, boolean>>({});
    let aiIssueNoteInput = $state<Record<string, string>>({});
    let isSyncingAI = $state(false);
    let syncAIMessage = $state<string | null>(null);

    async function syncAIChanges() {
        isSyncingAI = true;
        syncAIMessage = null;
        try {
            const res = await fetch("/api/checklist/sync-ai", {
                method: "POST",
            });
            const data = await res.json();
            if (data.success) {
                syncAIMessage = data.message;
                // Recargar el checklist para ver los nuevos items
                await loadChecklist();
            } else {
                syncAIMessage = `❌ ${data.error}`;
            }
        } catch (e) {
            syncAIMessage = "❌ Error de conexión";
        } finally {
            isSyncingAI = false;
        }
    }

    async function loadChecklist() {
        isLoading = true;
        error = null;
        try {
            const res = await fetch("/api/checklist");
            const data = await res.json();
            if (data.success) {
                checklistGroups = data.data || [];
            } else {
                error = data.error || "Error loading checklist";
            }
        } catch (e) {
            error = "Error de conexión";
            console.error(e);
        } finally {
            isLoading = false;
        }
    }

    async function seedDatabase() {
        isSeeding = true;
        seedMessage = null;
        try {
            const res = await fetch("/api/checklist/seed", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                seedMessage = `✅ ${data.message}. Grupos: ${data.groupsCreated}, Items: ${data.itemsCreated}`;
                await loadChecklist();
            } else {
                seedMessage = `❌ ${data.error}`;
            }
        } catch (e) {
            seedMessage = "❌ Error de conexión";
        } finally {
            isSeeding = false;
        }
    }

    async function addItem(groupId: number) {
        const label = newItemLabel[groupId]?.trim();
        const detail = newItemDetail[groupId]?.trim();
        if (!label) return;

        try {
            const res = await fetch("/api/checklist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "item",
                    data: {
                        groupId,
                        label,
                        detail: detail || null,
                        status: "missing",
                        critical: newItemCritical[groupId] || false,
                    },
                }),
            });
            const data = await res.json();
            if (data.success) {
                // Add to local state
                const group = checklistGroups.find((g) => g.id === groupId);
                if (group) {
                    group.items = [
                        ...group.items,
                        {
                            ...data.data,
                            status: data.data.status as
                                | "done"
                                | "partial"
                                | "missing",
                        },
                    ];
                }
                // Reset form
                newItemLabel[groupId] = "";
                newItemDetail[groupId] = "";
                newItemCritical[groupId] = false;
                showAddItem[groupId] = false;
            }
        } catch (e) {
            console.error("Error adding item:", e);
        }
    }

    async function addGroup() {
        if (!newGroupTitle.trim()) return;

        try {
            const res = await fetch("/api/checklist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "group",
                    data: {
                        title: newGroupTitle.trim(),
                        icon: "Zap",
                        color: newGroupColor,
                    },
                }),
            });
            const data = await res.json();
            if (data.success) {
                checklistGroups = [
                    ...checklistGroups,
                    { ...data.data, items: [] },
                ];
                newGroupTitle = "";
                showAddGroup = false;
            }
        } catch (e) {
            console.error("Error adding group:", e);
        }
    }

    async function updateItemStatus(
        itemId: number,
        groupId: number,
        newStatus: "done" | "partial" | "missing",
    ) {
        try {
            const res = await fetch(`/api/checklist/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "item",
                    data: { status: newStatus },
                }),
            });
            if (res.ok) {
                // Update local state
                const group = checklistGroups.find((g) => g.id === groupId);
                if (group) {
                    group.items = group.items.map((item) =>
                        item.id === itemId
                            ? { ...item, status: newStatus }
                            : item,
                    );
                    checklistGroups = [...checklistGroups]; // Trigger reactivity
                }
            }
        } catch (e) {
            console.error("Error updating status:", e);
        }
    }

    async function deleteItem(itemId: number, groupId: number) {
        if (!confirm("¿Eliminar esta tarea?")) return;

        try {
            const res = await fetch(`/api/checklist/${itemId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "item" }),
            });
            if (res.ok) {
                const group = checklistGroups.find((g) => g.id === groupId);
                if (group) {
                    group.items = group.items.filter(
                        (item) => item.id !== itemId,
                    );
                    checklistGroups = [...checklistGroups];
                }
            }
        } catch (e) {
            console.error("Error deleting item:", e);
        }
    }

    function toggleItem(groupIndex: number, itemIndex: number) {
        const key = `${groupIndex}-${itemIndex}`;
        expandedItems[key] = !expandedItems[key];
    }

    function cycleStatus(
        item: ChecklistItem,
        groupId: number,
    ): "done" | "partial" | "missing" {
        const cycle: Record<string, "done" | "partial" | "missing"> = {
            missing: "partial",
            partial: "done",
            done: "missing",
        };
        return cycle[item.status] || "missing";
    }

    onMount(() => {
        loadChecklist();
    });

    // Calculate stats
    const stats = $derived.by(() => {
        let totalItems = 0;
        let completedItems = 0;

        checklistGroups.forEach((group) => {
            group.items.forEach((item) => {
                totalItems++;
                if (item.status === "done") completedItems++;
                if (item.status === "partial") completedItems += 0.5;
            });
        });

        const progress =
            totalItems > 0
                ? Math.round((completedItems / totalItems) * 100)
                : 0;

        const readinessColor =
            progress > 80
                ? "text-emerald-400"
                : progress > 50
                  ? "text-amber-400"
                  : "text-red-400";

        return { totalItems, completedItems, progress, readinessColor };
    });

    // Color options for groups
    const colorOptions = [
        { value: "text-pink-500", label: "Rosa" },
        { value: "text-blue-500", label: "Azul" },
        { value: "text-indigo-400", label: "Índigo" },
        { value: "text-amber-400", label: "Ámbar" },
        { value: "text-emerald-400", label: "Verde" },
        { value: "text-purple-400", label: "Púrpura" },
        { value: "text-red-500", label: "Rojo" },
        { value: "text-green-500", label: "Verde Claro" },
    ];
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
                        >v1.0.0</span
                    >
                    <span
                        class="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest border border-emerald-500/30"
                        >DB Connected</span
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
                    Pulsa en cualquier ítem para ver detalles. Haz clic en el
                    icono de estado para cambiar el progreso.
                </p>
            </div>
        </header>

        <!-- Admin Actions -->
        <div class="flex flex-wrap gap-3">
            <button
                onclick={loadChecklist}
                disabled={isLoading}
                class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
                <RefreshCw size={16} class={isLoading ? "animate-spin" : ""} />
                Recargar
            </button>

            <button
                onclick={() => {
                    if (checklistGroups.length > 0) {
                        if (
                            confirm(
                                "¿Estás seguro de que quieres REINICIALIZAR el checklist? Esto reemplazará todos los items con los datos predefinidos.",
                            )
                        ) {
                            // First delete existing data, then seed
                            fetch("/api/checklist/clear", { method: "DELETE" })
                                .then(() => seedDatabase())
                                .catch(() => seedDatabase());
                        }
                    } else {
                        seedDatabase();
                    }
                }}
                disabled={isSeeding}
                class="flex items-center gap-2 px-4 py-2 {checklistGroups.length >
                0
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'} rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                title={checklistGroups.length > 0
                    ? "Reinicializar con datos actualizados"
                    : "Cargar datos iniciales"}
            >
                <Database size={16} class={isSeeding ? "animate-pulse" : ""} />
                {isSeeding
                    ? "Cargando..."
                    : checklistGroups.length > 0
                      ? "Reinicializar BD"
                      : "Inicializar BD"}
            </button>

            <button
                onclick={() => (showAddGroup = !showAddGroup)}
                class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
            >
                <Plus size={16} />
                Nuevo Grupo
            </button>

            <button
                onclick={syncAIChanges}
                disabled={isSyncingAI}
                class="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                title="Añadir cambios del asistente sin borrar items existentes"
            >
                <Zap size={16} class={isSyncingAI ? "animate-pulse" : ""} />
                {isSyncingAI ? "Sincronizando..." : "Sincronizar Cambios IA"}
            </button>
        </div>

        {#if seedMessage}
            <div
                class="p-4 rounded-lg {seedMessage.startsWith('✅')
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/20 border border-red-500/30 text-red-300'}"
                transition:fade
            >
                {seedMessage}
            </div>
        {/if}

        {#if syncAIMessage}
            <div
                class="p-4 rounded-lg {syncAIMessage.startsWith('✅')
                    ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                    : 'bg-red-500/20 border border-red-500/30 text-red-300'}"
                transition:fade
            >
                {syncAIMessage}
            </div>
        {/if}

        <!-- Add Group Form -->
        {#if showAddGroup}
            <div
                class="bg-slate-900/50 rounded-xl p-4 border border-white/10 space-y-4"
                transition:fly={{ y: -10, duration: 200 }}
            >
                <h3 class="font-bold text-white">Crear Nuevo Grupo</h3>
                <div class="flex flex-col md:flex-row gap-3">
                    <input
                        bind:value={newGroupTitle}
                        placeholder="Título del grupo (ej: 🚀 Nueva Sección)"
                        class="flex-1 bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                        bind:value={newGroupColor}
                        class="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {#each colorOptions as opt}
                            <option value={opt.value}>{opt.label}</option>
                        {/each}
                    </select>
                    <button
                        onclick={addGroup}
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
                    >
                        Crear
                    </button>
                    <button
                        onclick={() => (showAddGroup = false)}
                        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        {/if}

        <!-- Progress Overview -->
        {#if !isLoading && checklistGroups.length > 0}
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
                            class={stats.readinessColor}
                            stroke-dasharray="301.6"
                            stroke-dashoffset={301.6 -
                                (301.6 * stats.progress) / 100}
                            stroke-linecap="round"
                        />
                    </svg>
                    <span
                        class="absolute text-2xl font-black {stats.readinessColor}"
                        >{stats.progress}%</span
                    >
                </div>
                <div class="text-center md:text-left">
                    <h2 class="text-xl font-bold text-white mb-1">
                        Progreso Global
                    </h2>
                    <p class="text-slate-400 text-sm">
                        <span class="text-emerald-400 font-bold"
                            >{Math.floor(stats.completedItems)}</span
                        >
                        de
                        <span class="text-white font-bold"
                            >{stats.totalItems}</span
                        >
                        ítems completados.
                        {#if stats.progress < 50}
                            Aún queda bastante trabajo por hacer.
                        {:else if stats.progress < 80}
                            Buen avance, pero hay puntos críticos pendientes.
                        {:else}
                            ¡Casi listos para producción!
                        {/if}
                    </p>
                </div>
            </section>
        {/if}

        <!-- Loading State -->
        {#if isLoading}
            <div class="flex items-center justify-center py-20">
                <RefreshCw size={32} class="animate-spin text-indigo-400" />
                <span class="ml-3 text-slate-400">Cargando checklist...</span>
            </div>
        {:else if error}
            <div
                class="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center"
            >
                <p class="text-red-300">{error}</p>
                <button
                    onclick={loadChecklist}
                    class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium"
                >
                    Reintentar
                </button>
            </div>
        {:else if checklistGroups.length === 0}
            <div
                class="bg-slate-900/50 border border-white/10 rounded-xl p-10 text-center"
            >
                <Database size={48} class="mx-auto text-slate-600 mb-4" />
                <h3 class="text-xl font-bold text-white mb-2">
                    Base de datos vacía
                </h3>
                <p class="text-slate-400 mb-6">
                    No hay tareas en la base de datos. Haz clic en "Inicializar
                    BD" para cargar las tareas predefinidas o crea grupos
                    manualmente.
                </p>
            </div>
        {:else}
            <!-- Detailed Checklist -->
            <div class="space-y-6">
                {#each checklistGroups as group, groupIndex (group.id)}
                    {@const GroupIcon = getIcon(group.icon)}
                    <section
                        class="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden"
                    >
                        <header
                            class="p-5 bg-white/5 border-b border-white/5 flex items-center gap-3"
                        >
                            <div
                                class="p-2 rounded-lg bg-slate-950 border border-white/10 {group.color}"
                            >
                                <svelte:component this={GroupIcon} size={20} />
                            </div>
                            <h3 class="font-bold text-lg text-white flex-1">
                                {group.title}
                            </h3>
                            <span class="text-xs text-slate-500">
                                {group.items.filter((i) => i.status === "done")
                                    .length}/{group.items.length}
                            </span>
                        </header>
                        <div class="divide-y divide-white/5">
                            {#each group.items as item, itemIndex (item.id)}
                                {@const isExpanded =
                                    expandedItems[`${groupIndex}-${itemIndex}`]}
                                <div
                                    class="transition-colors {item.status !==
                                    'done'
                                        ? 'hover:bg-white/5'
                                        : ''}"
                                >
                                    <div
                                        class="w-full flex items-start gap-3 p-4 text-left"
                                    >
                                        <!-- Status Icon (clickable to cycle) -->
                                        <button
                                            class="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                                            title="Click para cambiar estado"
                                            onclick={() => {
                                                if (item.id && group.id) {
                                                    const newStatus =
                                                        cycleStatus(
                                                            item,
                                                            group.id,
                                                        );
                                                    updateItemStatus(
                                                        item.id,
                                                        group.id,
                                                        newStatus,
                                                    );
                                                }
                                            }}
                                        >
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
                                        </button>

                                        <!-- Content (clickable to expand) -->
                                        <button
                                            class="flex-1 text-left"
                                            onclick={() =>
                                                toggleItem(
                                                    groupIndex,
                                                    itemIndex,
                                                )}
                                        >
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
                                        </button>

                                        <!-- Delete button -->
                                        <button
                                            class="text-slate-600 hover:text-red-400 transition-colors p-1"
                                            title="Eliminar"
                                            onclick={() =>
                                                item.id &&
                                                group.id &&
                                                deleteItem(item.id, group.id)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

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

                            <!-- Add Item Button/Form -->
                            <div class="p-4">
                                {#if showAddItem[group.id || 0]}
                                    <div
                                        class="space-y-3 bg-slate-800/30 rounded-lg p-4"
                                        transition:fly={{
                                            y: -10,
                                            duration: 200,
                                        }}
                                    >
                                        <input
                                            bind:value={
                                                newItemLabel[group.id || 0]
                                            }
                                            placeholder="Nombre de la tarea"
                                            class="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <textarea
                                            bind:value={
                                                newItemDetail[group.id || 0]
                                            }
                                            placeholder="Descripción detallada (opcional)"
                                            rows="2"
                                            class="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                        ></textarea>
                                        <div class="flex items-center gap-4">
                                            <label
                                                class="flex items-center gap-2 text-sm text-slate-400"
                                            >
                                                <input
                                                    type="checkbox"
                                                    bind:checked={
                                                        newItemCritical[
                                                            group.id || 0
                                                        ]
                                                    }
                                                    class="rounded bg-slate-700 border-slate-600"
                                                />
                                                Marcar como crítico
                                            </label>
                                        </div>
                                        <div class="flex gap-2">
                                            <button
                                                onclick={() =>
                                                    group.id &&
                                                    addItem(group.id)}
                                                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Agregar
                                            </button>
                                            <button
                                                onclick={() => {
                                                    if (group.id)
                                                        showAddItem[group.id] =
                                                            false;
                                                }}
                                                class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                {:else}
                                    <button
                                        onclick={() => {
                                            if (group.id)
                                                showAddItem[group.id] = true;
                                        }}
                                        class="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-400 transition-colors"
                                    >
                                        <Plus size={16} />
                                        Agregar tarea a este grupo
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </section>
                {/each}
            </div>
        {/if}

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
