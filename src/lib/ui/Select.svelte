<script lang="ts">
    import { createEventDispatcher } from "svelte";

    // Props using legacy export let syntax for Svelte 4/5 compatibility without runes if not fully migrated
    export let value: any;
    export let options: { label: string; value: any }[] = [];
    export let className: string = "";

    let isOpen = false;
    let container: HTMLDivElement;
    let menuHeight: number;

    const dispatch = createEventDispatcher();

    function toggle() {
        isOpen = !isOpen;
    }

    function select(opt: any) {
        value = opt.value;
        isOpen = false;
        dispatch("change", value);
    }

    function handleClickOutside(event: MouseEvent) {
        if (container && !container.contains(event.target as Node)) {
            isOpen = false;
        }
    }

    // Get current label safely
    $: currentLabel = options.find((o) => o.value == value)?.label || value;
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative inline-block {className}" bind:this={container}>
    <button
        type="button"
        class="flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 text-white text-xs font-medium rounded-lg pl-3 pr-2 py-1.5 border border-white/10 transition-all w-full focus:outline-none focus:ring-1 focus:ring-white/20 select-none"
        on:click={toggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
    >
        <span class="truncate">{currentLabel}</span>
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-slate-400 transition-transform duration-200 flex-shrink-0 {isOpen
                ? 'rotate-180'
                : ''}"
        >
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    </button>

    {#if isOpen}
        <div
            class="absolute top-full right-0 mt-1 min-w-[140px] bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1 z-50 overflow-hidden origin-top-right animate-scale-in"
        >
            <div class="max-h-[240px] overflow-y-auto custom-scrollbar">
                {#each options as opt}
                    <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 group
                {opt.value === value
                            ? 'bg-white/10 text-white font-bold'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
                        on:click={() => select(opt)}
                    >
                        <span class="truncate">{opt.label}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .animate-scale-in {
        animation: scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scaleIn {
        from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
    }
</style>
