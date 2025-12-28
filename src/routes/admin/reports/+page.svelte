<script lang="ts">
    import { onMount } from "svelte";
    import {
        AlertTriangle,
        CheckCircle,
        XCircle,
        Eye,
        EyeOff,
        Trash2,
        Ban,
        Clock,
        Filter,
        RefreshCw,
        ChevronDown,
        ExternalLink,
        User,
        Flag,
        Shield,
    } from "lucide-svelte";
    import { fly, fade } from "svelte/transition";

    interface ReportData {
        id: number;
        reason: string;
        notes: string | null;
        status: string;
        reviewNotes: string | null;
        createdAt: string;
        reviewedAt: string | null;
        poll: {
            id: number;
            hashId: string;
            title: string;
            status: string;
            isHidden: boolean;
            createdAt: string;
            author: {
                id: number;
                hashId: string;
                username: string;
                displayName: string;
                avatarUrl: string;
            } | null;
            totalReports: number;
        } | null;
        reporter: {
            id: number;
            hashId: string;
            username: string;
            displayName: string;
            avatarUrl: string;
        } | null;
        reviewer: {
            id: number;
            username: string;
            displayName: string;
        } | null;
    }

    interface Stats {
        pending: number;
        reviewed: number;
        dismissed: number;
        actioned: number;
    }

    let reports = $state<ReportData[]>([]);
    let stats = $state<Stats>({
        pending: 0,
        reviewed: 0,
        dismissed: 0,
        actioned: 0,
    });
    let isLoading = $state(true);
    let error = $state<string | null>(null);
    let selectedFilter = $state("pending");
    let selectedReport = $state<ReportData | null>(null);
    let actionInProgress = $state<number | null>(null);

    const reasonLabels: Record<string, string> = {
        spam: "🚫 Spam",
        inappropriate: "🔞 Contenido inapropiado",
        misleading: "⚠️ Información falsa",
        hate: "💔 Discurso de odio",
        harassment: "😠 Acoso",
        violence: "⚔️ Violencia",
        other: "❓ Otro",
    };

    const statusColors: Record<string, string> = {
        pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        reviewed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        dismissed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
        actioned: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };

    const statusLabels: Record<string, string> = {
        pending: "Pendiente",
        reviewed: "Revisado",
        dismissed: "Descartado",
        actioned: "Acción tomada",
    };

    async function loadReports() {
        isLoading = true;
        error = null;
        try {
            const url =
                selectedFilter === "all"
                    ? "/api/admin/reports"
                    : `/api/admin/reports?status=${selectedFilter}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                reports = data.data || [];
                stats = data.meta?.stats || stats;
            } else {
                error = data.error || "Error loading reports";
            }
        } catch (e) {
            error = "Error de conexión";
            console.error(e);
        } finally {
            isLoading = false;
        }
    }

    async function updateReportStatus(
        reportId: number,
        status: string,
        action?: string,
    ) {
        actionInProgress = reportId;
        try {
            const res = await fetch(`/api/admin/reports/${reportId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, action }),
            });

            if (res.ok) {
                await loadReports();
                selectedReport = null;
            }
        } catch (e) {
            console.error("Error updating report:", e);
        } finally {
            actionInProgress = null;
        }
    }

    function formatDate(dateStr: string) {
        const date = new Date(dateStr);
        return date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function getTimeAgo(dateStr: string) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "ahora";
        if (diffMins < 60) return `hace ${diffMins}m`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays}d`;
        return formatDate(dateStr);
    }

    onMount(() => {
        loadReports();
    });

    $effect(() => {
        // Reload when filter changes
        selectedFilter;
        loadReports();
    });
</script>

<svelte:head>
    <title>Panel de Reportes - VoTok Admin</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
        <!-- Header -->
        <header
            class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <div class="p-2 rounded-lg bg-red-500/20 text-red-400">
                        <Shield size={24} />
                    </div>
                    <h1 class="text-2xl md:text-3xl font-black text-white">
                        Panel de Reportes
                    </h1>
                </div>
                <p class="text-slate-400">
                    Gestiona los reportes de contenido de la plataforma
                </p>
            </div>
            <button
                onclick={loadReports}
                disabled={isLoading}
                class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
                <RefreshCw size={16} class={isLoading ? "animate-spin" : ""} />
                Actualizar
            </button>
        </header>

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
                onclick={() => (selectedFilter = "pending")}
                class="p-4 rounded-xl border transition-all {selectedFilter ===
                'pending'
                    ? 'bg-amber-500/20 border-amber-500/50'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'}"
            >
                <div class="flex items-center gap-3">
                    <Clock size={20} class="text-amber-400" />
                    <div class="text-left">
                        <p class="text-2xl font-black text-amber-400">
                            {stats.pending}
                        </p>
                        <p class="text-xs text-slate-400">Pendientes</p>
                    </div>
                </div>
            </button>
            <button
                onclick={() => (selectedFilter = "reviewed")}
                class="p-4 rounded-xl border transition-all {selectedFilter ===
                'reviewed'
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'}"
            >
                <div class="flex items-center gap-3">
                    <Eye size={20} class="text-blue-400" />
                    <div class="text-left">
                        <p class="text-2xl font-black text-blue-400">
                            {stats.reviewed}
                        </p>
                        <p class="text-xs text-slate-400">Revisados</p>
                    </div>
                </div>
            </button>
            <button
                onclick={() => (selectedFilter = "dismissed")}
                class="p-4 rounded-xl border transition-all {selectedFilter ===
                'dismissed'
                    ? 'bg-slate-500/20 border-slate-500/50'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'}"
            >
                <div class="flex items-center gap-3">
                    <XCircle size={20} class="text-slate-400" />
                    <div class="text-left">
                        <p class="text-2xl font-black text-slate-400">
                            {stats.dismissed}
                        </p>
                        <p class="text-xs text-slate-400">Descartados</p>
                    </div>
                </div>
            </button>
            <button
                onclick={() => (selectedFilter = "actioned")}
                class="p-4 rounded-xl border transition-all {selectedFilter ===
                'actioned'
                    ? 'bg-emerald-500/20 border-emerald-500/50'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'}"
            >
                <div class="flex items-center gap-3">
                    <CheckCircle size={20} class="text-emerald-400" />
                    <div class="text-left">
                        <p class="text-2xl font-black text-emerald-400">
                            {stats.actioned}
                        </p>
                        <p class="text-xs text-slate-400">Con acción</p>
                    </div>
                </div>
            </button>
        </div>

        <!-- Filter Tab -->
        <div class="flex items-center gap-2 overflow-x-auto pb-2">
            {#each ["all", "pending", "reviewed", "dismissed", "actioned"] as filter}
                <button
                    onclick={() => (selectedFilter = filter)}
                    class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                        {selectedFilter === filter
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'}"
                >
                    {filter === "all" ? "Todos" : statusLabels[filter]}
                </button>
            {/each}
        </div>

        <!-- Reports List -->
        {#if isLoading}
            <div class="flex items-center justify-center py-20">
                <RefreshCw size={32} class="animate-spin text-indigo-400" />
                <span class="ml-3 text-slate-400">Cargando reportes...</span>
            </div>
        {:else if error}
            <div
                class="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center"
            >
                <p class="text-red-300">{error}</p>
            </div>
        {:else if reports.length === 0}
            <div
                class="bg-slate-900/50 border border-white/10 rounded-xl p-10 text-center"
            >
                <Flag size={48} class="mx-auto text-slate-600 mb-4" />
                <h3 class="text-xl font-bold text-white mb-2">Sin reportes</h3>
                <p class="text-slate-400">
                    No hay reportes {selectedFilter !== "all"
                        ? statusLabels[selectedFilter]?.toLowerCase()
                        : ""} en este momento.
                </p>
            </div>
        {:else}
            <div class="space-y-4">
                {#each reports as report (report.id)}
                    <div
                        class="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors"
                    >
                        <!-- Report Header -->
                        <div
                            class="p-4 flex flex-col md:flex-row md:items-center gap-4"
                        >
                            <!-- Poll Info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-start gap-3">
                                    {#if report.poll?.author?.avatarUrl}
                                        <img
                                            src={report.poll.author.avatarUrl}
                                            alt=""
                                            class="w-10 h-10 rounded-full bg-slate-800"
                                        />
                                    {:else}
                                        <div
                                            class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center"
                                        >
                                            <User
                                                size={20}
                                                class="text-slate-600"
                                            />
                                        </div>
                                    {/if}
                                    <div class="flex-1 min-w-0">
                                        <p
                                            class="text-white font-medium truncate"
                                        >
                                            {report.poll?.title ||
                                                "Encuesta eliminada"}
                                        </p>
                                        <p class="text-sm text-slate-400">
                                            por @{report.poll?.author
                                                ?.username || "desconocido"}
                                            {#if report.poll?.isHidden}
                                                <span class="ml-2 text-red-400"
                                                    >• Oculta</span
                                                >
                                            {/if}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- Report Meta -->
                            <div class="flex flex-wrap items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded text-xs font-medium border {statusColors[
                                        report.status
                                    ]}"
                                >
                                    {statusLabels[report.status]}
                                </span>
                                <span
                                    class="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300"
                                >
                                    {reasonLabels[report.reason] ||
                                        report.reason}
                                </span>
                                {#if report.poll && report.poll.totalReports > 1}
                                    <span
                                        class="px-2 py-1 rounded text-xs font-bold
                                        {report.poll.totalReports >= 5
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-amber-500/20 text-amber-400'}"
                                    >
                                        {report.poll.totalReports} reportes
                                    </span>
                                {/if}
                                <span class="text-xs text-slate-500">
                                    {getTimeAgo(report.createdAt)}
                                </span>
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-2">
                                {#if report.status === "pending"}
                                    <button
                                        onclick={() =>
                                            updateReportStatus(
                                                report.id,
                                                "dismissed",
                                            )}
                                        disabled={actionInProgress ===
                                            report.id}
                                        class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                        title="Descartar"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                    <button
                                        onclick={() =>
                                            updateReportStatus(
                                                report.id,
                                                "actioned",
                                                "hide",
                                            )}
                                        disabled={actionInProgress ===
                                            report.id}
                                        class="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                                        title="Ocultar encuesta"
                                    >
                                        <EyeOff size={18} />
                                    </button>
                                    <button
                                        onclick={() => {
                                            if (
                                                confirm(
                                                    "¿Eliminar esta encuesta permanentemente?",
                                                )
                                            ) {
                                                updateReportStatus(
                                                    report.id,
                                                    "actioned",
                                                    "delete",
                                                );
                                            }
                                        }}
                                        disabled={actionInProgress ===
                                            report.id}
                                        class="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                                        title="Eliminar encuesta"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                {:else if report.poll?.isHidden}
                                    <button
                                        onclick={() =>
                                            updateReportStatus(
                                                report.id,
                                                "reviewed",
                                                "unhide",
                                            )}
                                        disabled={actionInProgress ===
                                            report.id}
                                        class="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                                        title="Restaurar encuesta"
                                    >
                                        <Eye size={18} />
                                    </button>
                                {/if}
                                {#if report.poll}
                                    <a
                                        href="/poll/{report.poll.hashId}"
                                        target="_blank"
                                        class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                        title="Ver encuesta"
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                {/if}
                            </div>
                        </div>

                        <!-- Reporter Info & Notes -->
                        {#if report.notes || report.reporter}
                            <div class="px-4 pb-4 border-t border-white/5 pt-3">
                                <div
                                    class="flex items-center gap-2 text-sm text-slate-400"
                                >
                                    <Flag size={14} />
                                    <span
                                        >Reportado por @{report.reporter
                                            ?.username || "anónimo"}</span
                                    >
                                </div>
                                {#if report.notes}
                                    <p
                                        class="mt-2 text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3"
                                    >
                                        "{report.notes}"
                                    </p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    :global(body) {
        background-color: #020617;
    }
</style>
