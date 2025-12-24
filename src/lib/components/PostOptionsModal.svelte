<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import {
        X,
        Flag,
        AlertTriangle,
        Copy,
        Ban,
        EyeOff,
        UserMinus,
        Trash2,
        Edit2,
    } from "lucide-svelte";
    import { currentUser } from "$lib/stores/auth";
    import type { Post } from "$lib/voting-feed/types";

    interface Props {
        isOpen: boolean;
        post: Post;
        onClose: () => void;
        onReport?: () => void;
        onDelete?: () => void;
    }

    let { isOpen, post, onClose, onReport, onDelete }: Props = $props();

    const isAuthor = $derived(
        $currentUser?.userId === post.userId ||
            $currentUser?.username === post.author,
    );

    function handleAction(action: string) {
        if (action === "report") onReport?.();
        if (action === "delete") onDelete?.();

        // Copy link
        if (action === "copy") {
            const link = `${window.location.origin}/poll/${post.id}`;
            navigator.clipboard.writeText(link);
            alert("Enlace copiado al portapapeles"); // Replace with toast later
        }

        onClose();
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
    >
        <!-- Backdrop -->
        <div
            class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onclick={onClose}
            transition:fade={{ duration: 200 }}
            role="presentation"
        ></div>

        <!-- Modal Panel -->
        <div
            class="relative w-full max-w-sm bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden p-4 space-y-2 z-10"
            transition:fly={{ y: 20, duration: 300 }}
        >
            <!-- Drag Handle for Mobile -->
            <div
                class="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4 sm:hidden"
            ></div>

            <!-- Header -->
            <div class="flex items-center justify-between mb-2 px-2">
                <h3 class="text-white font-bold text-lg">Opciones</h3>
                <button
                    onclick={onClose}
                    class="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10"
                >
                    <X size={20} />
                </button>
            </div>

            <!-- Actions List -->
            <div class="space-y-1">
                {#if isAuthor}
                    <button
                        onclick={() => handleAction("delete")}
                        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-red-400 transition-colors group text-left"
                    >
                        <Trash2 size={20} />
                        <div class="flex flex-col">
                            <span class="font-bold text-sm"
                                >Eliminar encuesta</span
                            >
                            <span class="text-xs opacity-60"
                                >Esta acción no se puede deshacer</span
                            >
                        </div>
                    </button>
                    <button
                        onclick={() => handleAction("edit")}
                        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-white transition-colors text-left"
                    >
                        <Edit2 size={20} class="text-slate-400" />
                        <span class="font-medium text-sm">Editar (Beta)</span>
                    </button>
                {:else}
                    <button
                        onclick={() => handleAction("report")}
                        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-red-400 transition-colors group text-left"
                    >
                        <Flag size={20} />
                        <div class="flex flex-col">
                            <span class="font-bold text-sm"
                                >Reportar contenido</span
                            >
                            <span class="text-xs opacity-60"
                                >Es ofensivo o inapropiado</span
                            >
                        </div>
                    </button>

                    <button
                        onclick={() => handleAction("not_interested")}
                        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-white transition-colors text-left"
                    >
                        <EyeOff size={20} class="text-slate-400" />
                        <span class="font-medium text-sm">No me interesa</span>
                    </button>

                    <button
                        onclick={() => handleAction("unfollow")}
                        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-white transition-colors text-left"
                    >
                        <UserMinus size={20} class="text-slate-400" />
                        <span class="font-medium text-sm"
                            >Dejar de seguir a @{post.author}</span
                        >
                    </button>
                {/if}

                <div class="h-px bg-white/5 my-2"></div>

                <button
                    onclick={() => handleAction("copy")}
                    class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-white transition-colors text-left"
                >
                    <Copy size={20} class="text-slate-400" />
                    <span class="font-medium text-sm">Copiar enlace</span>
                </button>
            </div>
        </div>
    </div>
{/if}
