<script lang="ts">
  import { onMount } from 'svelte';

  type User = {
    name: string;
    avatar: string;
  };
  type HeaderProps = {
    users: User[];
  };

  let users: User[] = [];

  onMount(async () => {
    try {
      const res = await fetch('/api/featured-users');
      if (res.ok) {
        const { data } = await res.json();
        // Mapear del shape de featuredUsers al shape local { name, avatar }
        users = (Array.isArray(data) ? data : []).map((u: any) => ({ name: u.name, avatar: u.image || u.avatar }));
      }
    } catch (e) {
      console.warn('No se pudieron cargar featured users:', e);
    }
  });

  let hidden = $state(false);
  let expandedPoll = $state(false);
  let showAvatars = $state(false);

</script>

{#if !expandedPoll}
<header
	class="top-0 left-0 right-0 z-50"
	style="position: relative;"
>
	<!-- Botón avatar arriba -->
	<div class="w-full flex flex-col">
		

		<!-- Contenedor del Logo -->
		<div
			class="transition-opacity transition-max-h duration-300 ease-in-out overflow-hidden px-2 sm:px-4 "
			class:max-h-0={hidden}
			class:opacity-0={hidden}
			class:max-h-20={!hidden}
			class:opacity-100={!hidden}
			class:py-0={hidden}
		>
			<div class="flex items-center justify-between h-10 sm:h-12 w-full">
				<div>
  <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">VoteTok</h1>
</div>

			</div>
		</div>

	
	</div>
</header>
{/if}
