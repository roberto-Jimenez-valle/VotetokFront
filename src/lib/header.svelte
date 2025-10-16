<script lang="ts">
  import { onMount } from 'svelte';

  type TrendingUser = {
    name: string;
    avatar: string;
  };

  let users = $state<TrendingUser[]>([]);
  let selectedUser = $state<TrendingUser | null>(null);

  onMount(async () => {
        try {
      // Cargar usuarios trending INDEPENDIENTES (no vinculados a encuestas)
      const res = await fetch('/api/users/trending?limit=10');
      if (res.ok) {
        const { data } = await res.json();
        users = data.slice(0, 8).map((user: any) => ({
          name: user.displayName || user.username,
          avatar: user.avatarUrl || '/default-avatar.png'
        }));
              } else {
        // Fallback: cargar desde encuestas pero SIN colores
                const pollsRes = await fetch('/api/polls/trending-by-region?region=Global&limit=10');
        if (pollsRes.ok) {
          const { data } = await pollsRes.json();
          const userMap = new Map<string, TrendingUser>();
          data.forEach((poll: any) => {
            if (poll.user && !userMap.has(poll.user.username)) {
              userMap.set(poll.user.username, {
                name: poll.user.displayName || poll.user.username,
                avatar: poll.user.avatarUrl || '/default-avatar.png'
                // NO incluir pollColor - los avatares son independientes
              });
            }
          });
          users = Array.from(userMap.values()).slice(0, 8);
                  }
      }
    } catch (e) {
      console.warn('[Header] ⚠️ No se pudieron cargar trending users:', e);
      users = [];
    }
  });

  function handleAvatarClick(user: TrendingUser) {
    selectedUser = user;
  }

  function closeModal() {
    selectedUser = null;
  }

</script>

<header class="top-0 left-0 right-0 z-50" style="position: fixed;">
	<div class="w-full flex flex-col">
		<!-- Logo y Toggle unificado -->
		<div class="transition-opacity duration-300 ease-in-out px-2 sm:px-4">
			<div class="flex items-center justify-between h-8 sm:h-10 w-full">
				<h1 
					class="logo-text text-xl sm:text-3xl font-extrabold tracking-tight"
					style="color: var(--logo-color, white);"
				>VoteTok</h1>
				<div id="theme-toggle-slot"></div>
			</div>
		</div>

		<!-- User Avatars (Trending) -->
		{#if users.length > 0}
			<div class="avatars-scroll-wrapper">
				<div class="avatars-scroll-container">
					<div class="avatars-inner-container">
						{#each users as user, i}
							<button 
								class="avatar-lg clickable" 
								style="z-index: {users.length - i};"
								onclick={() => handleAvatarClick(user)}
								title={user.name}
							>
								<img 
									src={user.avatar} 
									alt={user.name}
									loading="lazy"
									style="width: 100%; height: 100%; object-fit: cover; border-radius: 999px;"
								/>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</header>
<!-- Modal de avatar grande -->
{#if selectedUser}
<div 
	class="avatar-modal-overlay" 
	onclick={closeModal}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Escape' && closeModal()}
>
	<div 
		class="avatar-modal-content" 
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="user-modal-title"
		tabindex="-1"
	>
		<button class="avatar-modal-close" onclick={closeModal}>×</button>
		<img 
			src={selectedUser.avatar} 
			alt={selectedUser.name}
			class="avatar-modal-image"
		/>
		<h3 id="user-modal-title" class="avatar-modal-name">{selectedUser.name}</h3>
	</div>
</div>
{/if}


<style>
	.avatars-scroll-wrapper {
		width: 100%;
		margin-top: 8px; /* Reducido para ocupar menos espacio */
		padding-bottom: 6px;
		position: relative;
		/* CRÍTICO para móvil: permitir scroll horizontal */
		touch-action: pan-x;
		-webkit-overflow-scrolling: touch;
	}
	
	.avatars-scroll-container {
		overflow-x: scroll; /* Forzar scroll horizontal */
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
		width: 100%;
		padding: 5px 16px; /* Padding de 5px arriba y abajo */
		/* CRÍTICO para móvil: permitir scroll horizontal */
		touch-action: pan-x;
		/* Ocultar scrollbar */
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE y Edge */
	}
	
	/* Ocultar scrollbar en WebKit (Chrome, Safari, Edge) */
	.avatars-scroll-container::-webkit-scrollbar {
		display: none !important;
		width: 0 !important;
		height: 0 !important;
	}
	
	.avatars-inner-container {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: max-content; /* Forzar que el contenido no se envuelva */
		width: max-content;
		/* Asegurar que funcione en móvil */
		flex-wrap: nowrap;
		white-space: nowrap;
	}
	
	/* Centrar avatares en desktop */
	@media (min-width: 768px) {
		.avatars-scroll-container {
			display: flex;
			justify-content: center;
			overflow-x: auto;
		}
		
		.avatars-inner-container {
			width: auto;
			min-width: auto;
		}
	}
	
	.avatar-lg {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		border: 3px solid rgba(255, 255, 255, 0.4);
		flex-shrink: 0;
	}
	
	.avatar-lg.clickable {
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
		background: none;
		padding: 0;
	}
	
	.avatar-lg.clickable:hover {
		transform: scale(1.15);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
		border-color: rgba(255, 255, 255, 0.8);
	}
	
	.avatar-lg.clickable:active {
		transform: scale(1.05);
	}
	
	
	.avatar-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		animation: fadeIn 0.2s ease;
	}
	
	.avatar-modal-content {
		position: relative;
		background: linear-gradient(180deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%);
		border-radius: 20px;
		padding: 30px;
		max-width: 400px;
		width: 90%;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
		animation: scaleIn 0.3s ease;
	}
	
	.avatar-modal-close {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		font-size: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.avatar-modal-close:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: rotate(90deg);
	}
	
	.avatar-modal-image {
		width: 200px;
		height: 200px;
		border-radius: 50%;
		object-fit: cover;
		margin: 0 auto;
		display: block;
		border: 4px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
	}
	
	.avatar-modal-name {
		text-align: center;
		color: white;
		font-size: 24px;
		font-weight: 600;
		margin-top: 20px;
		margin-bottom: 0;
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	
	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
