<script lang="ts">
    import { fade, fly, scale } from "svelte/transition";
    import {
        X,
        Send,
        AlertTriangle,
        ChevronRight,
        CheckCircle2,
        MessageSquare,
    } from "lucide-svelte";
    import { apiCall } from "$lib/api/client";

    interface Props {
        isOpen: boolean;
        postId: string;
        onClose: () => void;
    }

    let { isOpen, postId, onClose }: Props = $props();

    let step = $state(1); // 1: Select Reason, 2: Comments (Optional), 3: Success
    let reason = $state("");
    let notes = $state("");
    let isSubmitting = $state(false);

    const reasons = [
        {
            id: "spam",
            label: "Spam",
            icon: "📢",
            desc: "Publicidad engañosa o repetitiva",
        },
        {
            id: "inappropriate",
            label: "Contenido inapropiado",
            icon: "🔞",
            desc: "Nudismo o actos sexuales",
        },
        {
            id: "hate",
            label: "Lenguaje de odio",
            icon: "🗣️",
            desc: "Ataques por identidad o pertenencia",
        },
        {
            id: "harassment",
            label: "Acoso",
            icon: "😤",
            desc: "Insultos o intimidación",
        },
        {
            id: "violence",
            label: "Violencia",
            icon: "⚔️",
            desc: "Amenazas o actos violentos",
        },
        {
            id: "misleading",
            label: "Información falsa",
            icon: "⚠️",
            desc: "Engaños o noticias falsas",
        },
        {
            id: "other",
            label: "Otro motivo",
            icon: "❓",
            desc: "Algo que no encaja aquí",
        },
    ];

    async function submitReport() {
        if (!reason || isSubmitting) return;

        isSubmitting = true;
        try {
            const res = await apiCall(`/api/polls/${postId}/report`, {
                method: "POST",
                body: JSON.stringify({ reason, notes }),
            });

            if (res.ok) {
                step = 3;
            } else {
                const error = await res.json();
                alert(error.message || "Error al enviar el reporte");
            }
        } catch (err) {
            console.error("Error reporting poll:", err);
            alert("Error de conexión");
        } finally {
            isSubmitting = false;
        }
    }

    function handleClose() {
        step = 1;
        reason = "";
        notes = "";
        onClose();
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[10000000] flex items-end sm:items-center justify-center sm:p-4"
    >
        <!-- Backdrop with blur -->
        <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onclick={handleClose}
            transition:fade={{ duration: 250 }}
            role="presentation"
        ></div>

        <div
            class="relative w-full max-w-md bg-slate-900 border-t sm:border border-white/10 rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            transition:fly={{
                y: 100,
                duration: 400,
                easing: (t) => t * (2 - t),
            }}
            style="max-height: 85vh;"
        >
            <!-- Header -->
            <div
                class="flex items-center justify-between p-6 border-b border-white/5"
            >
                <div>
                    <h3 class="text-white font-black text-xl tracking-tight">
                        Reportar
                    </h3>
                    <p class="text-xs text-slate-400 font-medium">
                        Ayúdanos a mantener la comunidad segura
                    </p>
                </div>
                <button
                    onclick={handleClose}
                    class="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div
                class="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
            >
                {#if step === 1}
                    <!-- Step 1: Reason Selection -->
                    <div
                        class="p-4 space-y-2 animate-in fade-in slide-in-from-right-4 duration-300"
                    >
                        <p class="px-2 pb-2 text-sm font-bold text-slate-300">
                            ¿Por qué reportas esta encuesta?
                        </p>
                        {#each reasons as r}
                            <button
                                onclick={() => {
                                    reason = r.id;
                                    step = 2;
                                }}
                                class="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all group active:scale-[0.98]"
                            >
                                <div class="flex items-center gap-4">
                                    <span
                                        class="text-2xl grayscale group-hover:grayscale-0 transition-all"
                                        >{r.icon}</span
                                    >
                                    <div class="text-left">
                                        <span
                                            class="block text-sm font-bold text-white mb-0.5"
                                            >{r.label}</span
                                        >
                                        <span
                                            class="block text-[10px] text-slate-500 font-medium"
                                            >{r.desc}</span
                                        >
                                    </div>
                                </div>
                                <ChevronRight
                                    size={18}
                                    class="text-slate-600 group-hover:text-white transition-colors"
                                />
                            </button>
                        {/each}
                    </div>
                {:else if step === 2}
                    <!-- Step 2: Comments / Notes -->
                    <div
                        class="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
                    >
                        <div class="space-y-2">
                            <div class="flex items-center gap-2 mb-4">
                                <button
                                    onclick={() => (step = 1)}
                                    class="text-indigo-400 text-xs font-bold hover:underline"
                                >
                                    ← Cambiar motivo
                                </button>
                            </div>

                            <div
                                class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-4 mb-6"
                            >
                                <span class="text-2xl"
                                    >{reasons.find((r) => r.id === reason)
                                        ?.icon}</span
                                >
                                <div>
                                    <span
                                        class="block text-sm font-bold text-indigo-100"
                                        >Motivo seleccionado</span
                                    >
                                    <span class="text-xs text-indigo-300/80"
                                        >{reasons.find((r) => r.id === reason)
                                            ?.label}</span
                                    >
                                </div>
                            </div>

                            <label
                                for="report-notes"
                                class="block text-sm font-bold text-slate-300 mb-2 px-1"
                            >
                                ¿Quieres añadir más detalles? (Opcional)
                            </label>
                            <div class="relative group">
                                <textarea
                                    id="report-notes"
                                    bind:value={notes}
                                    placeholder="Explica qué es lo que está mal en este contenido..."
                                    class="w-full h-32 p-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
                                ></textarea>
                                <div
                                    class="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] text-slate-500 font-bold"
                                >
                                    <MessageSquare size={12} />
                                    <span
                                        >Tu comentario ayuda a los moderadores</span
                                    >
                                </div>
                            </div>
                        </div>

                        <button
                            onclick={submitReport}
                            disabled={isSubmitting}
                            class="w-full p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-4"
                        >
                            {#if isSubmitting}
                                <div
                                    class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                                ></div>
                                Enviando...
                            {:else}
                                Enviar reporte <Send size={16} />
                            {/if}
                        </button>
                        <p
                            class="text-[10px] text-center text-slate-500 px-4 leading-relaxed font-medium"
                        >
                            Tu reporte es anónimo. Procesaremos esta información
                            según nuestras políticas de comunidad.
                        </p>
                    </div>
                {:else}
                    <!-- Step 3: Success -->
                    <div
                        class="p-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-400"
                    >
                        <div
                            class="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-2 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                            in:scale={{
                                duration: 600,
                                start: 0.5,
                                easing: (t) => t,
                            }}
                        >
                            <CheckCircle2 size={42} strokeWidth={2.5} />
                        </div>
                        <div class="space-y-2">
                            <h4 class="text-xl font-black text-white">
                                ¡Gracias por avisarnos!
                            </h4>
                            <p
                                class="text-sm text-slate-400 max-w-[240px] mx-auto leading-relaxed"
                            >
                                Hemos recibido tu reporte. Lo revisaremos lo
                                antes posible para ver si incumple nuestras
                                normas.
                            </p>
                        </div>
                        <button
                            onclick={handleClose}
                            class="w-full max-w-[200px] p-4 rounded-2xl bg-white text-slate-950 font-black text-sm uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.95]"
                        >
                            Cerrar
                        </button>
                    </div>
                {/if}
            </div>

            <!-- Footer Info -->
            <div
                class="p-4 bg-black/20 border-t border-white/5 flex items-center justify-center gap-2"
            >
                <AlertTriangle size={12} class="text-slate-500" />
                <span
                    class="text-[9px] text-slate-500 uppercase font-black tracking-widest"
                    >Compromiso de seguridad</span
                >
            </div>
        </div>
    </div>
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
