<script lang="ts">
  import { onMount } from 'svelte';

  type User = {
    name: string;
    avatar: string;
  };
  type HeaderProps = {
    users: User[];
  };

  let users = $state<User[]>([]);
  let selectedUser = $state<User | null>(null);

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
      // Fallback: usar usuarios de ejemplo si falla la API
      users = [
        { name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/10.jpg' },
        { name: 'Marisol', avatar: 'https://randomuser.me/api/portraits/women/11.jpg' },
        { name: 'John', avatar: 'https://randomuser.me/api/portraits/men/12.jpg' },
        { name: 'Megan', avatar: 'https://randomuser.me/api/portraits/women/12.jpg' },
        { name: 'Adam', avatar: 'https://randomuser.me/api/portraits/men/13.jpg' }
      ];
    }
  });

  let hidden = $state(false);
  let expandedPoll = $state(false);
  let showAvatars = $state(false);

  function handleAvatarClick(user: User) {
    selectedUser = user;
  }

  function closeModal() {
    selectedUser = null;
  }

</script>

{#if !expandedPoll}
<header
	class="top-0 left-0 right-0 z-50"
	style="position: fixed;"
>
	<div class="w-full flex flex-col">
		<!-- Logo -->
		<div
			class="transition-opacity duration-300 ease-in-out px-2 sm:px-4"
			class:opacity-0={hidden}
			class:opacity-100={!hidden}
		>
			<div class="flex items-center h-10 sm:h-12 w-full">
				<h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">VoteTok</h1>
			</div>
		</div>

		<!-- Avatares de usuarios destacados - fuera del contenedor con overflow -->
		{#if users.length > 0 && !hidden}
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
{/if}

<!-- Modal de avatar grande -->
{#if selectedUser}
<div 
	class="avatar-modal-overlay" 
	onclick={closeModal}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Escape' && closeModal()}
>
	<div class="avatar-modal-content" onclick={(e) => e.stopPropagation()}>
		<button class="avatar-modal-close" onclick={closeModal}>×</button>
		<img 
			src={selectedUser.avatar} 
			alt={selectedUser.name}
			class="avatar-modal-image"
		/>
		<h3 class="avatar-modal-name">{selectedUser.name}</h3>
	</div>
</div>
{/if}

<style>
	.avatars-scroll-wrapper {
		width: 100%;
		margin-top: 16px; /* Más margen top */
		padding-bottom: 8px;
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
