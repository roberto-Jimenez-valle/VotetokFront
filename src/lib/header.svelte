<script lang="ts">
  import { onMount } from 'svelte';

  type User = {
    name: string;
    avatar: string;
  };
  type HeaderProps = {
    users: User[];
  };

  type PollOption = {
    key: string;
    color: string;
    avatar?: string;
  };

  // Props from parent
  let { pollTitle = '', pollOptions = [], isWorldView = true } = $props<{
    pollTitle?: string;
    pollOptions?: PollOption[];
    isWorldView?: boolean;
  }>();
  

  let users = $state<User[]>([]);
  let selectedUser = $state<User | null>(null);
  let selectedOption = $state<PollOption | null>(null);

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

  function handleOptionClick(option: PollOption) {
    selectedOption = option;
  }

  function closeOptionModal() {
    selectedOption = null;
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
			<div class="flex items-center h-8 sm:h-10 w-full">
				<h1 class="text-xl sm:text-3xl font-extrabold tracking-tight">VoteTok</h1>
			</div>
		</div>

		<!-- Poll title when not in world view -->
		{#if !isWorldView && pollTitle && !hidden}
		<div class="poll-title-container">
			<h2 class="poll-title">{pollTitle}</h2>
		</div>
		{/if}


		<!-- Poll options when not in world view, or user avatars when in world view -->
		{#if !hidden}
			{#if !isWorldView && pollOptions.length > 0}
				<!-- Poll Options -->
				<div class="avatars-scroll-wrapper">
					<div class="avatars-scroll-container">
						<div class="avatars-inner-container">
							{#each pollOptions as option, i}
								<button 
									class="avatar-lg clickable poll-option" 
									style="z-index: {pollOptions.length - i}; border-color: {option.color};"
									onclick={() => handleOptionClick(option)}
									title={option.key}
								>
									<img 
										src={option.avatar || `https://i.pravatar.cc/48?u=${encodeURIComponent(option.key)}`} 
										alt={option.key}
										loading="lazy"
										style="width: 100%; height: 100%; object-fit: cover; border-radius: 999px;"
									/>
								</button>
							{/each}
						</div>
					</div>
				</div>
			{:else if isWorldView && users.length > 0}
				<!-- User Avatars (Stories) -->
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

<!-- Modal de opción de encuesta -->
{#if selectedOption}
<div 
	class="avatar-modal-overlay" 
	onclick={closeOptionModal}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Escape' && closeOptionModal()}
>
	<div 
		class="avatar-modal-content option-modal" 
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="option-modal-title"
		tabindex="-1"
	>
		<button class="avatar-modal-close" onclick={closeOptionModal}>×</button>
		<div 
			class="option-modal-circle"
			style="border-color: {selectedOption.color}; box-shadow: 0 0 30px {selectedOption.color}40;"
		>
			<img 
				src={selectedOption.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(selectedOption.key)}`} 
				alt={selectedOption.key}
				class="avatar-modal-image"
			/>
		</div>
		<h3 id="option-modal-title" class="avatar-modal-name">{selectedOption.key}</h3>
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
	
	/* Poll option specific styles */
	.avatar-lg.poll-option {
		border-width: 3px;
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-width 0.2s ease;
	}
	
	.avatar-lg.poll-option:hover {
		border-width: 4px;
	}
	
	/* Poll title styles */
	.poll-title-container {
		width: 100%;
		padding: 0 12px;
		margin-top: 4px;
		max-height: 32px;
		overflow: hidden;
	}
	
	.poll-title {
		font-size: 14px;
		font-weight: 600;
		color: white;
		text-align: center;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		animation: fadeInTitle 0.3s ease;
		/* Truncate long text */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.4;
	}
	
	@keyframes fadeInTitle {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	/* Option modal specific styles */
	.option-modal-circle {
		width: 220px;
		height: 220px;
		border-radius: 50%;
		border: 5px solid;
		padding: 10px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
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
