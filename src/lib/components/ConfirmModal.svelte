<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { AlertTriangle, X } from "lucide-svelte";

    let {
        isOpen = false,
        title = "¿Estás seguro?",
        message = "Esta acción no se puede deshacer.",
        confirmText = "Confirmar",
        cancelText = "Cancelar",
        isDangerous = false,
        onConfirm,
        onCancel,
    } = $props<{
        isOpen: boolean;
        title?: string;
        message?: string;
        confirmText?: string;
        cancelText?: string;
        isDangerous?: boolean;
        onConfirm: () => void;
        onCancel: () => void;
    }>();
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[99999999] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
    >
        <!-- Backdrop -->
        <div
            class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onclick={onCancel}
            transition:fade={{ duration: 200 }}
        ></div>

        <!-- Modal Panel -->
        <div
            class="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
            transition:fly={{ y: 20, duration: 300 }}
        >
            <div class="p-6 text-center space-y-4">
                {#if isDangerous}
                    <div
                        class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2"
                    >
                        <AlertTriangle class="text-red-500" size={24} />
                    </div>
                {/if}

                <h3 class="text-xl font-bold text-white leading-tight">
                    {title}
                </h3>

                <p class="text-slate-400 text-sm leading-relaxed">
                    {message}
                </p>
            </div>

            <!-- Buttons -->
            <div
                class="grid grid-cols-2 gap-px bg-white/10 border-t border-white/10"
            >
                <button
                    class="p-4 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                    onclick={onCancel}
                >
                    {cancelText}
                </button>
                <button
                    class="p-4 text-sm font-bold transition-colors {isDangerous
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-indigo-400 hover:bg-indigo-500/10'}"
                    onclick={onConfirm}
                >
                    {confirmText}
                </button>
            </div>
        </div>
    </div>
{/if}
