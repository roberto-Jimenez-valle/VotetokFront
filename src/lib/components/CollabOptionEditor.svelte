<script lang="ts">
    import {
        X,
        Palette,
        Sparkles,
        Image as ImageIcon,
        Send,
        RefreshCw,
        Trash2,
    } from "lucide-svelte";
    import { fly, fade } from "svelte/transition";
    import { onMount } from "svelte";

    interface Props {
        isOpen: boolean;
        optionNumber?: number;
        initialColor?: string;
        onClose: () => void;
        onSubmit: (text: string, imageUrl?: string, color?: string) => void;
    }

    let {
        isOpen = $bindable(),
        optionNumber = 1,
        initialColor = "#9ec264",
        onClose,
        onSubmit,
    }: Props = $props();

    // State
    let optionText = $state("");
    let optionColor = $state(initialColor);
    let optionImage = $state<string | null>(null);
    let inputRef = $state<HTMLTextAreaElement | null>(null);
    let showColorPicker = $state(false);
    let isClosingViaBack = $state(false);

    // Colors for quick selection (matching CreatePollModal)
    const quickColors = [
        "#9ec264", // lime
        "#10b981", // emerald
        "#06b6d4", // cyan
        "#3b82f6", // blue
        "#6366f1", // indigo
        "#8b5cf6", // violet
        "#ec4899", // pink
        "#f43f5e", // rose
        "#f97316", // orange
        "#eab308", // yellow
    ];

    // Focus input when modal opens
    $effect(() => {
        if (isOpen && inputRef) {
            setTimeout(() => inputRef?.focus(), 300);
        }
    });

    // Reset state when modal opens
    $effect(() => {
        if (isOpen) {
            optionText = "";
            optionImage = null;
            showColorPicker = false;
            optionColor = initialColor;
        }
    });

    function handleSubmit() {
        if (!optionText.trim()) return;
        onSubmit(optionText.trim(), optionImage || undefined, optionColor);
        handleClose();
    }

    function handleClose() {
        if (!isClosingViaBack) {
            history.back();
        }
        onClose();
    }

    function selectColor(c: string) {
        optionColor = c;
        showColorPicker = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    $effect(() => {
        if (isOpen) {
            // Reset back navigation flag
            isClosingViaBack = false;

            history.pushState({ modal: "collabOptionEditor" }, "");

            const handlePopState = () => {
                isClosingViaBack = true;
                onClose();
            };

            window.addEventListener("popstate", handlePopState);
            return () => window.removeEventListener("popstate", handlePopState);
        }
    });
</script>

{#if isOpen}
    <!-- Fullscreen Modal Container -->
    <div class="poll-editor-fullscreen" transition:fade={{ duration: 200 }}>
        <!-- Close button top left -->
        <button
            type="button"
            class="close-btn"
            onclick={handleClose}
            aria-label="Cerrar"
        >
            <X size={22} />
        </button>

        <!-- MAIN CARD -->
        <main class="card-canvas">
            <div class="card-slide">
                <div
                    class="main-card"
                    style="--card-gradient: linear-gradient(to bottom right, {optionColor}, {optionColor}dd);"
                >
                    <!-- Decorative Pattern -->
                    <div class="card-pattern"></div>

                    <!-- Badge -->
                    <div class="option-badge">
                        <span>#{optionNumber}</span>
                    </div>

                    <!-- Floating Actions (Right Side) - REPLICA EXACTA DE CreatePollModal y Captura -->
                    <div
                        class="absolute bottom-6 right-4 z-30 flex flex-col gap-2"
                    >
                        <!-- Grupo Principal: Imagen y Color -->
                        <div
                            class="flex flex-col items-center rounded-[1.5rem] border backdrop-blur-lg transition-all overflow-hidden bg-black/20 border-white/10 text-white shadow-xl"
                        >
                            {#if !optionImage}
                                <!-- Botón Imagen -->
                                <button
                                    type="button"
                                    class="p-3 w-full hover:bg-white/5 border-b border-white/5 transition-colors flex items-center justify-center"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        /* TODO: Implementar selección imagen */
                                    }}
                                    title="Añadir imagen/GIF"
                                >
                                    <ImageIcon
                                        class="w-[1.25rem] h-[1.25rem]"
                                        strokeWidth={1.5}
                                    />
                                </button>

                                <!-- Botón Color -->
                                <div
                                    class="relative w-full flex flex-col items-center"
                                >
                                    <button
                                        type="button"
                                        class={`p-3 w-full transition-all flex items-center justify-center ${showColorPicker ? "bg-white text-black" : "hover:bg-white/10 text-white/70"}`}
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            showColorPicker = !showColorPicker;
                                        }}
                                        title="Cambiar color"
                                    >
                                        <Palette
                                            fill={showColorPicker
                                                ? "currentColor"
                                                : "none"}
                                            class="w-[1.25rem] h-[1.25rem]"
                                            strokeWidth={1.5}
                                        />
                                    </button>

                                    <!-- Dropdown de Color -->
                                    {#if showColorPicker}
                                        <div
                                            class="absolute right-full bottom-0 mr-2 p-2 bg-black/90 backdrop-blur-xl rounded-xl border border-white/20 grid grid-cols-5 gap-1.5 w-[160px]"
                                            transition:fly={{
                                                x: 10,
                                                duration: 200,
                                            }}
                                            role="presentation"
                                            onclick={(e) => e.stopPropagation()}
                                            onkeydown={() => {}}
                                        >
                                            {#each quickColors as c}
                                                <button
                                                    class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 {c ===
                                                    optionColor
                                                        ? 'border-white scale-110'
                                                        : 'border-transparent'}"
                                                    style="background: {c};"
                                                    onclick={(e) => {
                                                        e.stopPropagation();
                                                        selectColor(c);
                                                    }}
                                                ></button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <!-- Controles cuando HAY imagen -->
                                <button
                                    type="button"
                                    class="p-3 hover:bg-black/20 border-b border-white/5 transition-colors flex items-center justify-center"
                                    onclick={(e) => e.stopPropagation()}
                                    title="Siguiente GIF"
                                >
                                    <RefreshCw
                                        class="w-[1.25rem] h-[1.25rem]"
                                        strokeWidth={1.5}
                                    />
                                </button>

                                <button
                                    type="button"
                                    class="p-3 hover:bg-red-500/20 text-red-500/60 hover:text-red-500 transition-colors flex items-center justify-center"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        optionImage = null;
                                    }}
                                    title="Eliminar imagen"
                                >
                                    <Trash2
                                        class="w-[1.25rem] h-[1.25rem]"
                                        strokeWidth={1.5}
                                    />
                                </button>
                            {/if}
                        </div>
                    </div>

                    <!-- Content Area -->
                    <div class="card-content">
                        <!-- Spacer -->
                        <div class="spacer"></div>

                        <!-- Text Input -->
                        <textarea
                            bind:this={inputRef}
                            class="card-textarea font-black text-2xl sm:text-3xl placeholder-white/30"
                            placeholder={"Opción " +
                                (optionNumber || 1) +
                                "..."}
                            bind:value={optionText}
                            onkeydown={handleKeydown}
                            rows={3}
                            maxlength={200}
                        ></textarea>

                        <!-- Character Count -->
                        <div class="char-count px-1">
                            <span>{optionText.length}/200</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- BOTTOM ACTION -->
        <div class="bottom-action">
            <button
                type="button"
                class="submit-btn"
                disabled={!optionText.trim()}
                onclick={handleSubmit}
            >
                <Send size={18} />
                Añadir opción
            </button>
        </div>
    </div>
{/if}

<style>
    .poll-editor-fullscreen {
        position: fixed;
        inset: 0;
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        background: #0f1115;
        color: white;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        overflow: hidden;
    }

    .close-btn {
        position: absolute;
        top: max(16px, env(safe-area-inset-top));
        left: 16px;
        z-index: 100;
        padding: 12px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    /* CARD CANVAS */
    .card-canvas {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 16px 16px;
        min-height: 0;
    }

    .card-slide {
        width: 100%;
        max-width: 400px;
        height: 100%;
        max-height: 500px;
    }

    .main-card {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--card-gradient);
        border-radius: 32px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        padding: 24px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .card-pattern {
        position: absolute;
        inset: 0;
        opacity: 0.1;
        background: radial-gradient(
            circle at 30% 20%,
            white 0%,
            transparent 50%
        );
        pointer-events: none;
    }

    .option-badge {
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 30;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(12px);
        padding: 6px 12px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .option-badge span {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.7);
    }

    /* Content Area */
    .card-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        z-index: 10;
        padding-right: 50px;
    }

    .spacer {
        flex: 0.3;
    }

    .card-textarea {
        width: 100%;
        background: transparent;
        border: none;
        color: white;
        line-height: 1.3;
        resize: none;
        outline: none;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }

    .card-textarea::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }

    .char-count {
        margin-top: 8px;
    }

    .char-count span {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.4);
    }

    /* Bottom Action */
    .bottom-action {
        padding: 16px 24px;
        padding-bottom: max(24px, env(safe-area-inset-bottom));
        background: linear-gradient(to top, #0f1115 0%, transparent 100%);
    }

    .submit-btn {
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 16px 32px;
        background: white;
        color: #0f1115;
        border: none;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .submit-btn:hover:not(:disabled) {
        transform: scale(1.02);
    }

    .submit-btn:active:not(:disabled) {
        transform: scale(0.98);
    }

    .submit-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
