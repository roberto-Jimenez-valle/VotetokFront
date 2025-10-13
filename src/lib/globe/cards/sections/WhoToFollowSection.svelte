<script lang="ts">
  /**
   * Sección "A quién seguir" con sugerencias de usuarios
   */
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let userSuggestions: any[] = [];
  
  // Event handlers
  function handleFollow(user: any) {
    dispatch('follow', { user });
  }
</script>

{#if userSuggestions.length > 0}
  <div class="suggestions-card">
    <h4 class="suggestions-title">A quién seguir</h4>
    <div class="suggestions-scroll">
      {#each userSuggestions as user, idx}
        <div class="suggestion-item">
          {#if user.avatarUrl}
            <img class="suggestion-avatar" src={user.avatarUrl} alt={user.displayName} />
          {:else}
            <div class="suggestion-avatar" style="background: linear-gradient({135 + idx * 30}deg, hsl({idx * 45}, 70%, 60%), hsl({idx * 45 + 40}, 70%, 50%))">
              {user.displayName.charAt(0)}
            </div>
          {/if}
          <div class="suggestion-info">
            <span class="suggestion-name">
              {user.displayName}
              {#if user.verified}
                <span class="verified-badge">✓</span>
              {/if}
            </span>
            <span class="suggestion-bio">{user.bio}</span>
          </div>
          <button 
            class="suggestion-follow"
            onclick={() => handleFollow(user)}
            type="button"
          >
            Seguir
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}
