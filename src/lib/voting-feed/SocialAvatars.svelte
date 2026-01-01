<script lang="ts">
  import type { Friend } from "./types";

  interface Props {
    friends: Friend[];
    revealed: boolean;
    size?: "small" | "large";
  }

  let { friends = [], revealed = false, size = "small" }: Props = $props();

  const dim = $derived(size === "small" ? "w-5 h-5" : "w-8 h-8");
</script>

{#if friends && friends.length > 0}
  <div class="flex -space-x-2 items-center">
    {#each friends.slice(0, 3) as friend, idx}
      <div
        class="relative {dim} rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden shadow-sm"
        style="z-index: {10 - idx}"
      >
        <img
          src={friend.avatar}
          alt="Friend"
          class="w-full h-full object-cover transition-opacity duration-300 {revealed
            ? 'opacity-100'
            : 'opacity-0'}"
        />
        <div
          class="absolute inset-0 flex items-center justify-center bg-indigo-500/20 backdrop-blur-md transition-opacity duration-300 rounded-full {revealed
            ? 'opacity-0'
            : 'opacity-100'}"
        >
          <span class="text-[8px] font-bold text-white/70">?</span>
        </div>
      </div>
    {/each}
    {#if friends.length > 3}
      <div
        class="flex items-center justify-center {dim} rounded-full border-2 border-slate-900 bg-slate-800/80 backdrop-blur-sm text-white/60 z-0"
      >
        <span class="text-[8px] font-bold">+{friends.length - 3}</span>
      </div>
    {/if}
  </div>
{/if}
