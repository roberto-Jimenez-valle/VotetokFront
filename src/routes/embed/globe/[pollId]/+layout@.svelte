<script>
  import "../../../../app.css";
  
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    width: 100%;
    height: 100%;
    background: #0a0a0f;
  }
</style>
