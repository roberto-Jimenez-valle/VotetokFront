<!--
  Skeleton Loader Component
  Componente reutilizable para mostrar estados de carga con animación de "shimmer"
  
  Uso:
  <Skeleton />                              // Línea de texto
  <Skeleton width="200px" />                // Ancho específico
  <Skeleton height="100px" />               // Altura específica
  <Skeleton circle size="48px" />           // Círculo (avatar)
  <Skeleton rounded="12px" />               // Bordes redondeados
  <Skeleton variant="text" lines={3} />     // Múltiples líneas de texto
  <Skeleton variant="card" />               // Tarjeta completa
  <Skeleton variant="poll" />               // Skeleton de encuesta
  <Skeleton variant="avatar" />             // Avatar con nombre
-->

<script lang="ts">
    interface Props {
        /** Tipo de skeleton predefinido */
        variant?:
            | "text"
            | "card"
            | "poll"
            | "reel"
            | "avatar"
            | "image"
            | "button"
            | "custom";
        /** Ancho del skeleton */
        width?: string;
        /** Altura del skeleton */
        height?: string;
        /** Si es true, hace el skeleton circular */
        circle?: boolean;
        /** Tamaño del círculo (si circle=true) */
        size?: string;
        /** Border radius */
        rounded?: string;
        /** Número de líneas (para variant="text") */
        lines?: number;
        /** Si es true, desactiva la animación */
        static?: boolean;
        /** Clase CSS adicional */
        class?: string;
    }

    let {
        variant = "custom",
        width = "100%",
        height = "16px",
        circle = false,
        size = "48px",
        rounded = "8px",
        lines = 1,
        static: isStatic = false,
        class: className = "",
    }: Props = $props();

    // Estilos computados
    const computedStyles = $derived(() => {
        if (circle) {
            return `width: ${size}; height: ${size}; border-radius: 50%;`;
        }
        return `width: ${width}; height: ${height}; border-radius: ${rounded};`;
    });
</script>

{#if variant === "text" && lines > 1}
    <!-- Múltiples líneas de texto -->
    <div class="skeleton-text-block {className}">
        {#each Array(lines) as _, i}
            <div
                class="skeleton-base skeleton-text-line"
                class:skeleton-animate={!isStatic}
                style="width: {i === lines - 1 ? '75%' : '100%'};"
            ></div>
        {/each}
    </div>
{:else if variant === "avatar"}
    <!-- Avatar con nombre -->
    <div class="skeleton-avatar-row {className}">
        <div
            class="skeleton-base skeleton-circle"
            class:skeleton-animate={!isStatic}
            style="width: {size}; height: {size};"
        ></div>
        <div class="skeleton-avatar-info">
            <div
                class="skeleton-base skeleton-name"
                class:skeleton-animate={!isStatic}
            ></div>
            <div
                class="skeleton-base skeleton-username"
                class:skeleton-animate={!isStatic}
            ></div>
        </div>
    </div>
{:else if variant === "card"}
    <!-- Tarjeta completa -->
    <div class="skeleton-card {className}">
        <div
            class="skeleton-base skeleton-card-image"
            class:skeleton-animate={!isStatic}
        ></div>
        <div class="skeleton-card-content">
            <div
                class="skeleton-base skeleton-card-title"
                class:skeleton-animate={!isStatic}
            ></div>
            <div
                class="skeleton-base skeleton-card-desc"
                class:skeleton-animate={!isStatic}
            ></div>
            <div
                class="skeleton-base skeleton-card-desc short"
                class:skeleton-animate={!isStatic}
            ></div>
        </div>
    </div>
{:else if variant === "poll"}
    <!-- Skeleton de encuesta -->
    <div class="skeleton-poll {className}">
        <!-- Header -->
        <div class="skeleton-poll-header">
            <div
                class="skeleton-base skeleton-circle"
                class:skeleton-animate={!isStatic}
                style="width: 40px; height: 40px;"
            ></div>
            <div class="skeleton-poll-author">
                <div
                    class="skeleton-base"
                    class:skeleton-animate={!isStatic}
                    style="width: 120px; height: 14px; border-radius: 4px;"
                ></div>
                <div
                    class="skeleton-base"
                    class:skeleton-animate={!isStatic}
                    style="width: 80px; height: 12px; border-radius: 4px; margin-top: 4px;"
                ></div>
            </div>
        </div>

        <!-- Pregunta -->
        <div
            class="skeleton-base skeleton-poll-question"
            class:skeleton-animate={!isStatic}
        ></div>

        <!-- Opciones -->
        <div class="skeleton-poll-options">
            {#each Array(4) as _}
                <div
                    class="skeleton-base skeleton-poll-option"
                    class:skeleton-animate={!isStatic}
                ></div>
            {/each}
        </div>
    </div>
{:else if variant === "reel"}
    <!-- Skeleton de Reel (pantalla completa estilo TikTok/Stories) -->
    <div class="skeleton-reel {className}">
        <!-- Background shimmer -->
        <div
            class="skeleton-reel-bg skeleton-base"
            class:skeleton-animate={!isStatic}
        ></div>

        <!-- Header with avatar and username -->
        <div class="skeleton-reel-header">
            <div
                class="skeleton-base skeleton-circle"
                class:skeleton-animate={!isStatic}
                style="width: 48px; height: 48px; flex-shrink: 0;"
            ></div>
            <div class="skeleton-reel-user-info">
                <div
                    class="skeleton-base"
                    class:skeleton-animate={!isStatic}
                    style="width: 120px; height: 16px; border-radius: 6px;"
                ></div>
                <div
                    class="skeleton-base"
                    class:skeleton-animate={!isStatic}
                    style="width: 80px; height: 12px; border-radius: 4px; margin-top: 6px;"
                ></div>
            </div>
        </div>

        <!-- Center content area - Question placeholder -->
        <div class="skeleton-reel-center">
            <div
                class="skeleton-base"
                class:skeleton-animate={!isStatic}
                style="width: 85%; height: 28px; border-radius: 8px; margin: 0 auto;"
            ></div>
            <div
                class="skeleton-base"
                class:skeleton-animate={!isStatic}
                style="width: 65%; height: 28px; border-radius: 8px; margin: 16px auto 0;"
            ></div>
        </div>

        <!-- Bottom options area -->
        <div class="skeleton-reel-bottom">
            <div class="skeleton-reel-options">
                {#each Array(4) as _}
                    <div
                        class="skeleton-base skeleton-reel-option"
                        class:skeleton-animate={!isStatic}
                    ></div>
                {/each}
            </div>
        </div>

        <!-- Side actions bar -->
        <div class="skeleton-reel-actions">
            {#each Array(5) as _}
                <div class="skeleton-reel-action">
                    <div
                        class="skeleton-base skeleton-circle"
                        class:skeleton-animate={!isStatic}
                        style="width: 44px; height: 44px;"
                    ></div>
                    <div
                        class="skeleton-base"
                        class:skeleton-animate={!isStatic}
                        style="width: 28px; height: 10px; border-radius: 4px; margin-top: 6px;"
                    ></div>
                </div>
            {/each}
        </div>
    </div>
{:else if variant === "image"}
    <!-- Imagen -->
    <div
        class="skeleton-base skeleton-image {className}"
        class:skeleton-animate={!isStatic}
        style="width: {width}; height: {height}; border-radius: {rounded};"
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
        >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21,15 16,10 5,21"></polyline>
        </svg>
    </div>
{:else if variant === "button"}
    <!-- Botón -->
    <div
        class="skeleton-base skeleton-button {className}"
        class:skeleton-animate={!isStatic}
        style="width: {width}; height: {height}; border-radius: {rounded};"
    ></div>
{:else}
    <!-- Custom skeleton -->
    <div
        class="skeleton-base {className}"
        class:skeleton-animate={!isStatic}
        class:skeleton-circle={circle}
        style={computedStyles()}
    ></div>
{/if}

<style>
    /* ===== BASE SKELETON ===== */
    .skeleton-base {
        background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.04) 100%
        );
        background-size: 200% 100%;
        position: relative;
        overflow: hidden;
    }

    .skeleton-animate {
        animation: skeleton-shimmer 1.5s ease-in-out infinite;
    }

    @keyframes skeleton-shimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }

    .skeleton-circle {
        border-radius: 50% !important;
    }

    /* ===== TEXT BLOCK ===== */
    .skeleton-text-block {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .skeleton-text-line {
        height: 14px;
        border-radius: 4px;
    }

    /* ===== AVATAR ROW ===== */
    .skeleton-avatar-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .skeleton-avatar-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .skeleton-name {
        width: 120px;
        height: 14px;
        border-radius: 4px;
    }

    .skeleton-username {
        width: 80px;
        height: 12px;
        border-radius: 4px;
    }

    /* ===== CARD ===== */
    .skeleton-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 16px;
        overflow: hidden;
    }

    .skeleton-card-image {
        width: 100%;
        height: 180px;
        border-radius: 0;
    }

    .skeleton-card-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .skeleton-card-title {
        width: 70%;
        height: 18px;
        border-radius: 4px;
    }

    .skeleton-card-desc {
        width: 100%;
        height: 14px;
        border-radius: 4px;
    }

    .skeleton-card-desc.short {
        width: 60%;
    }

    /* ===== POLL ===== */
    .skeleton-poll {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 16px;
        padding: 16px;
    }

    .skeleton-poll-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .skeleton-poll-author {
        flex: 1;
    }

    .skeleton-poll-question {
        width: 85%;
        height: 20px;
        border-radius: 4px;
        margin-bottom: 16px;
    }

    .skeleton-poll-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .skeleton-poll-option {
        width: 100%;
        height: 48px;
        border-radius: 12px;
    }

    /* ===== REEL (fullscreen story/tiktok style) ===== */
    .skeleton-reel {
        position: absolute;
        inset: 0;
        background: #000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .skeleton-reel-bg {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            180deg,
            rgba(30, 30, 50, 0.3) 0%,
            rgba(20, 20, 40, 0.5) 30%,
            rgba(10, 10, 30, 0.4) 70%,
            rgba(0, 0, 0, 0.6) 100%
        ) !important;
    }

    .skeleton-reel-header {
        position: absolute;
        top: 20px;
        left: 16px;
        right: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        z-index: 10;
    }

    .skeleton-reel-user-info {
        display: flex;
        flex-direction: column;
        flex: 1;
    }

    .skeleton-reel-center {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        transform: translateY(-100%);
        padding: 0 24px;
        text-align: center;
        z-index: 10;
    }

    .skeleton-reel-bottom {
        position: absolute;
        bottom: 100px;
        left: 16px;
        right: 80px;
        z-index: 10;
    }

    .skeleton-reel-options {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .skeleton-reel-option {
        height: 60px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.08) !important;
    }

    .skeleton-reel-actions {
        position: absolute;
        right: 12px;
        bottom: 100px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        z-index: 10;
    }

    .skeleton-reel-action {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* ===== IMAGE ===== */
    .skeleton-image {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .skeleton-image svg {
        width: 32px;
        height: 32px;
        color: rgba(255, 255, 255, 0.15);
    }

    /* ===== BUTTON ===== */
    .skeleton-button {
        min-width: 80px;
        min-height: 36px;
    }

    /* ===== LIGHT MODE ===== */
    :global(html:not(.dark)) .skeleton-base {
        background: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.06) 0%,
            rgba(0, 0, 0, 0.1) 50%,
            rgba(0, 0, 0, 0.06) 100%
        );
        background-size: 200% 100%;
    }

    :global(html:not(.dark)) .skeleton-card,
    :global(html:not(.dark)) .skeleton-poll {
        background: rgba(0, 0, 0, 0.02);
        border-color: rgba(0, 0, 0, 0.08);
    }

    :global(html:not(.dark)) .skeleton-image svg {
        color: rgba(0, 0, 0, 0.2);
    }
</style>
