<script lang="ts">
  import { createEventDispatcher, tick, onMount, onDestroy } from "svelte";

  export let active: "Para ti" | "Tendencias" | "Amigos" | "Live" = "Para ti";

  // Referencia al menú para moverlo al body
  let menuElement: HTMLDivElement | null = null;
  export let options: Array<"Para ti" | "Tendencias" | "Amigos" | "Live"> = [
    "Para ti",
    "Tendencias",
    "Amigos",
    "Live",
  ];
  // Label personalizado para mostrar en el trigger (ej: "Encuesta" cuando hay poll activa)
  export let customActiveLabel: string | null = null;

  // Filtro de tiempo para Tendencias
  export let timeFilter: "24h" | "7d" | "30d" | "90d" | "1y" | "5y" = "30d";
  export let timeFilterOptions: Array<
    "24h" | "7d" | "30d" | "90d" | "1y" | "5y"
  > = ["24h", "7d", "30d", "90d", "1y", "5y"];
  export let availableTimeFilters: Record<string, boolean> = {
    "24h": true,
    "7d": true,
    "30d": true,
    "90d": true,
    "1y": true,
    "5y": true,
  };
  export let isLoadingTimeFilters: boolean = false;

  const dispatch = createEventDispatcher<{
    change: string;
    symbolChange: "#" | "@";
    timeFilterChange: string;
    menuOpen: boolean;
  }>();
  let open = false;
  let rootEl: HTMLDivElement | null = null;
  // Estado del toggle minimal "# / @"
  export let symbolMode: "#" | "@" = "#";

  async function toggle() {
    open = !open;
    // Notificar a otros dropdowns que se cierre
    if (open) {
      window.dispatchEvent(
        new CustomEvent("closeOtherDropdowns", { detail: "topTabs" }),
      );
      // Notificar que el menú se abrió (para cargar filtros de tiempo)
      if (active === "Tendencias") {
        dispatch("menuOpen", true);
      }
      // Mover menú al body después de que Svelte lo renderice
      await tick();
      if (menuElement && menuElement.parentNode !== document.body) {
        document.body.appendChild(menuElement);
      }
    }
  }

  function select(tab: (typeof options)[number]) {
    console.log("[TopTabs] 🔘 Tab seleccionado:", tab);
    console.log("[TopTabs] 🔘 Tab anterior:", active);
    active = tab;
    console.log("[TopTabs] 📤 Disparando evento change con:", tab);
    dispatch("change", tab);
    // Siempre cerrar el menú al seleccionar
    open = false;
    // Si es Tendencias, seguir disparando menuOpen por si acaso se usa en otro lado
    if (tab === "Tendencias") {
      dispatch("menuOpen", true);
    }
  }

  function selectTimeFilter(time: (typeof timeFilterOptions)[number]) {
    console.log("[TopTabs] ⏱️ Time filter seleccionado:", time);
    timeFilter = time;
    dispatch("timeFilterChange", time);
    open = false;
  }

  function formatTimeLabel(time: string): string {
    if (time === "1y") return "1 año";
    if (time === "5y") return "5 años";
    if (time === "24h") return "24 horas";
    if (time === "7d") return "7 días";
    if (time === "30d") return "30 días";
    if (time === "90d") return "90 días";
    return time;
  }

  function formatTimeShort(time: string): string {
    if (time === "1y") return "1a";
    if (time === "5y") return "5a";
    return time;
  }
  function formatTabLabel(tab: string): string {
    if (!tab) return "";
    // Normalizar para asegurar coincidencia
    if (tab.trim().toLowerCase() === "live") return "Finalizan pronto";
    return tab;
  }
  function toggleSymbol() {
    symbolMode = symbolMode === "#" ? "@" : "#";
    dispatch("symbolChange", symbolMode);
  }

  function onWindowClick(e: MouseEvent) {
    if (!rootEl) return;
    if (!(e.target instanceof Node)) return;
    // Verificar si el clic fue en el menú flotante (ahora en el body)
    if (menuElement && menuElement.contains(e.target)) return;
    if (!rootEl.contains(e.target)) open = false;
  }

  function onCloseOtherDropdowns(e: CustomEvent) {
    if (e.detail !== "topTabs") {
      open = false;
    }
  }

  onMount(() => {
    window.addEventListener("click", onWindowClick, { passive: true } as any);
    window.addEventListener(
      "closeOtherDropdowns",
      onCloseOtherDropdowns as any,
    );
    return () => {
      window.removeEventListener("click", onWindowClick as any);
      window.removeEventListener(
        "closeOtherDropdowns",
        onCloseOtherDropdowns as any,
      );
    };
  });

  onDestroy(() => {
    if (menuElement && menuElement.parentNode === document.body) {
      document.body.removeChild(menuElement);
    }
  });
</script>

<div class="tabs-dd" bind:this={rootEl}>
  <button
    class="tabs-trigger"
    class:has-custom-label={!!customActiveLabel}
    on:click={toggle}
    aria-haspopup="menu"
    aria-expanded={open}
  >
    <span>{customActiveLabel || formatTabLabel(active)}</span>
    <svg
      class="caret"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
</div>

<!-- Menú renderizado en portal para estar por encima de todo -->
{#if open}
  <div role="menu" class="toptabs-menu" bind:this={menuElement}>
    {#each options as opt}
      <button
        role="menuitemradio"
        aria-checked={!customActiveLabel && active === opt}
        on:click={() => select(opt)}>{formatTabLabel(opt)}</button
      >
    {/each}
  </div>
{/if}

<style>
  .tabs-dd {
    position: relative;
  }
  .tabs-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.8rem;
    height: 2.5rem;
    border-radius: 9999px;
    border: 1px solid transparent;
    background: rgba(
      255,
      255,
      255,
      0.05
    ); /* Sutil fondo para el botón trigger */
    color: white;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 700;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }
  .tabs-trigger:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.1);
  }
  .tabs-trigger.has-custom-label {
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.2),
      rgba(139, 92, 246, 0.2)
    );
    border: 1px solid rgba(139, 92, 246, 0.3);
    padding: 8px 16px;
  }
  .tabs-trigger.has-custom-label span {
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  .caret {
    color: rgba(255, 255, 255, 0.6);
    transition: transform 0.2s ease;
  }
  .tabs-trigger[aria-expanded="true"] .caret {
    transform: rotate(180deg);
    color: white;
  }

  /* MENÚ DESPLEGABLE ESTILO APP */
  :global(.toptabs-menu) {
    position: fixed !important;
    top: 4rem !important;
    right: 1rem !important; /* Un poco más de margen */
    min-width: 14rem;
    max-width: 14rem;
    background: rgba(20, 20, 20, 0.95); /* Fondo casi negro */
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1); /* Borde fino */
    border-radius: 1.5rem; /* Bordes muy redondeados como el resto de la app */
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 2147483647 !important;
    isolation: isolate;
    pointer-events: auto !important;
    box-shadow:
      0 20px 50px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(0, 0, 0, 0.2);
    transform-origin: top right;
    animation: menu-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes menu-pop {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  :global(.toptabs-menu button) {
    text-align: left;
    padding: 0.9rem 1.2rem;
    border-radius: 1rem;
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 600;
    transition: all 0.2s ease;
    white-space: nowrap;
    position: relative;
    letter-spacing: 0.02em;
  }

  /* Hover state */
  :global(.toptabs-menu button:hover) {
    background: rgba(255, 255, 255, 0.08); /* Fondo blanco muy sutil al pasar */
    color: white;
    transform: translateX(4px); /* Pequeño desplazamiento */
  }

  /* Active/Selected state */
  /* Active/Selected state */
  :global(.toptabs-menu button[aria-checked="true"]) {
    color: white;
    font-weight: 700;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.05)
    );
    border-left: 3px solid #6366f1; /* Indigo acento */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
</style>
