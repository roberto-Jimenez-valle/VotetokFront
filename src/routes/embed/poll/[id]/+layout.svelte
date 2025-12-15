<script>
  // Layout vacío para embeds - sin header, footer ni otros elementos de la app
</script>

<slot />

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
