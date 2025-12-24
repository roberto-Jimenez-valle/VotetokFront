<script lang="ts">
    // Layout específico para la página legal
    // Esta página es PÚBLICA y no requiere verificación de acceso
    import "../../app.css";

    let { children } = $props();
</script>

<!-- Renderizar contenido sin verificación de acceso -->
{@render children()}

<style>
    /* Estilos base heredados del app.css */
    :global(body) {
        margin: 0;
        padding: 0;
    }
</style>
