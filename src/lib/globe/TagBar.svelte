<script lang="ts">
  import { hexToRgba } from '../utils/colors';

  export let activeTopTab: 'Para ti' | 'Tendencias' | 'Amigos' | 'Live' = 'Para ti';
  export let showAccountsLine = false;
  export let paraTiTags: Array<{ type: 'tag'; key: string }> = [];
  export let paraTiAccounts: Array<{ type: 'account'; handle: string; avatar: string }> = [];
  export let trendingTagsOnly: Array<{ type: 'tag'; key: string }> = [];
  export let trendingAccountsOnly: Array<{ type: 'account'; handle: string; avatar: string }> = [];
  export let colorMap: Record<string, string> = {};
  export let alphaForTag: (key: string) => number = () => 1;
  export let isSeen: (key: string) => boolean = () => false;
  export let seenKeyForTag: (k: string) => string = (k) => `#${k}`;
  export let seenKeyForAccount: (h: string) => string = (h) => `@${h}`;
  export let markSeen: (key: string) => void = () => {};
  export let activeTag: string | null = null; // bindable
</script>

<div class="tagbar" role="navigation" aria-label="Trending ahora">
  {#if activeTopTab === 'Para ti'}
    {#if !showAccountsLine}
      <div class="friends-row">
        {#each paraTiTags as item}
          <button
            class="friend"
            type="button"
            title={`Interés: ${item.key}`}
            on:click={() => {
              activeTag = activeTag === item.key ? null : item.key;
              markSeen(seenKeyForTag(item.key));
            }}
          >
            <div
              class="avatar-circle {isSeen(seenKeyForTag(item.key)) ? 'seen' : 'unseen'}"
              style={`background:${hexToRgba(colorMap?.[item.key] ?? '#9ca3af', alphaForTag(item.key))}; border-color: rgba(0,0,0,0.35);`}
            >
              #
            </div>
            <div class="friend-name">#{item.key}</div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="friends-row">
        {#each paraTiAccounts as item}
          <button
            class="friend"
            type="button"
            title={`Cuenta: @${item.handle}`}
            on:click={() => markSeen(seenKeyForAccount(item.handle))}
          >
            <img
              class="avatar {isSeen(seenKeyForAccount(item.handle)) ? 'seen' : 'unseen'}"
              src={item.avatar}
              alt={item.handle}
            />
            <div class="friend-name">@{item.handle}</div>
          </button>
        {/each}
      </div>
    {/if}
  {:else if activeTopTab === 'Tendencias'}
    {#if !showAccountsLine}
      <div class="friends-row">
        {#each trendingTagsOnly as item}
          <button
            class="friend"
            type="button"
            title={`Tendencia: ${item.key}`}
            on:click={() => {
              activeTag = activeTag === item.key ? null : item.key;
              markSeen(seenKeyForTag(item.key));
            }}
          >
            <div
              class="avatar-circle {isSeen(seenKeyForTag(item.key)) ? 'seen' : 'unseen'}"
              style={`background:${hexToRgba(colorMap?.[item.key] ?? '#9ca3af', alphaForTag(item.key))}; border-color: rgba(0,0,0,0.35);`}
            >
              #
            </div>
            <div class="friend-name">#{item.key}</div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="friends-row">
        {#each trendingAccountsOnly as item}
          <button
            class="friend"
            type="button"
            title={`Cuenta: @${item.handle}`}
            on:click={() => markSeen(seenKeyForAccount(item.handle))}
          >
            <img
              class="avatar {isSeen(seenKeyForAccount(item.handle)) ? 'seen' : 'unseen'}"
              src={item.avatar}
              alt={item.handle}
            />
            <div class="friend-name">@{item.handle}</div>
          </button>
        {/each}
      </div>
    {/if}
  {:else if activeTopTab === 'Amigos'}
    <div class="friends-row">
      <span style="opacity:.8">Amigos se han integrado en “Para ti”.</span>
    </div>
  {:else}
    <div class="tags-row">
      <span style="opacity:.8">Live próximamente…</span>
    </div>
  {/if}
</div>
