<script lang="ts">
	import { Home, Search, Bell, Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import SearchModal from '$lib/SearchModal.svelte';
	import NotificationsModal from '$lib/NotificationsModal.svelte';
	import ProfileModal from '$lib/ProfileModal.svelte';
	import AuthModal from '$lib/AuthModal.svelte';
	import { currentUser } from '$lib/stores';

	interface Props {
		hidden?: boolean;
		modalOpen?: boolean;
	}
	
	let { hidden = $bindable(false), modalOpen = false }: Props = $props();
	let activeItem = $state('home');
	let isLaunching = $state(false);
	
	// Estados de los modales
	let searchModalOpen = $state(false);
	let notificationsModalOpen = $state(false);
	let profileModalOpen = $state(false);
	let authModalOpen = $state(false);
	
	// Colores aleatorios para el borde y las ondas
	const colors = [
		'#06b6d4', // cyan
		'#8b5cf6', // purple
		'#ec4899', // pink
		'#f59e0b', // amber
		'#10b981', // emerald
		'#3b82f6', // blue
		'#ef4444', // red
		'#f97316', // orange
	];
	
	const randomBorderColor = $state(colors[Math.floor(Math.random() * colors.length)]);
	const randomColor2 = $state(colors[Math.floor(Math.random() * colors.length)]);
	const randomColor3 = $state(colors[Math.floor(Math.random() * colors.length)]);

	// Debug: monitorear cambios en hidden
	$effect(() => {
			});

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	function irANuevaEncuesta() {
		// Activar animación de lanzamiento
		isLaunching = true;
		
		// Abrir modal casi inmediatamente para transición minimalista (200ms)
		setTimeout(() => {
			isLaunching = false;
			dispatch('openCreatePoll', {
				colors: [randomBorderColor, randomColor2, randomColor3]
			});
		}, 200);
	}
	
	function openSearch() {
		activeItem = 'search';
		// Cerrar otros modales
		notificationsModalOpen = false;
		profileModalOpen = false;
		searchModalOpen = true;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch('closeCreatePoll');
		}
	}
	
	function openNotifications() {
		activeItem = 'notifications';
		// Cerrar otros modales
		searchModalOpen = false;
		profileModalOpen = false;
		notificationsModalOpen = true;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch('closeCreatePoll');
		}
	}
	
	function openProfile() {
		// Verificar si el usuario está autenticado
		if (!$currentUser) {
			// Si no está autenticado, mostrar modal de login
			activeItem = 'profile';
			searchModalOpen = false;
			notificationsModalOpen = false;
			profileModalOpen = false;
			authModalOpen = true;
			if (modalOpen) {
				dispatch('closeCreatePoll');
			}
			return;
		}
		
		// Si está autenticado, abrir perfil normalmente
		activeItem = 'profile';
		// Cerrar otros modales
		searchModalOpen = false;
		notificationsModalOpen = false;
		authModalOpen = false;
		profileModalOpen = true;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch('closeCreatePoll');
		}
	}
	
	function goHome() {
		activeItem = 'home';
		// Cerrar todas las modales
		searchModalOpen = false;
		notificationsModalOpen = false;
		profileModalOpen = false;
		authModalOpen = false;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch('closeCreatePoll');
		}
		// Disparar evento para abrir el bottomsheet
		dispatch('openBottomSheet');
	}
	
	// Propagar evento para abrir encuesta en globo
	function handleOpenPollInGlobe(event: CustomEvent<{ poll: any }>) {
		dispatch('openPollInGlobe', event.detail);
	}
</script>

<nav
	class="nav-bottom-fixed"
	style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom)); z-index:30050;"
	class:translate-y-full={hidden}
>
	<div class="nav-bottom-container">
			<button
				onclick={goHome}
				class="nav-btn"
				class:nav-btn-active={activeItem === 'home'}
				aria-label="Inicio"
			>
				<Home class="w-7 h-7 sm:w-8 sm:h-8" />
			</button>
			<button
			onclick={openSearch}
			class="nav-btn"
			class:nav-btn-active={activeItem === 'search'}
			aria-label="Buscar"
		>
			<Search class="w-7 h-7 sm:w-8 sm:h-8" />
		</button>
		<!-- Botón Añadir Publicación - Destacado -->
		{#if !modalOpen}
		<button
			onclick={irANuevaEncuesta}
			class="nav-btn-add"
			class:launching={isLaunching}
			style="--border-color: {randomBorderColor}; --wave-color-2: {randomColor2}; --wave-color-3: {randomColor3}"
			aria-label="Añadir publicación"
		>
			<Plus class="w-6 h-6" stroke-width="2.5" />
		</button>
		{/if}
		<button
			onclick={openNotifications}
			class="nav-btn"
			class:nav-btn-active={activeItem === 'notifications'}
			aria-label="Notificaciones"
		>
			<Bell class="w-7 h-7 sm:w-8 sm:h-8" />
		</button>
	<button
		onclick={openProfile}
		class="nav-btn-profile"
		aria-label="Perfil"
	>
		{#if $currentUser?.avatarUrl}
			<img src={$currentUser.avatarUrl} alt={$currentUser.displayName || $currentUser.username} class="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover" />
		{:else}
			<!-- Avatar por defecto cuando NO está logueado -->
			<div class="default-avatar">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
					<circle cx="12" cy="7" r="4"></circle>
				</svg>
			</div>
		{/if}
	</button>
	</div>
</nav>

<style>
	/* Nav siempre con fondo negro, independiente del tema */
	.nav-bottom-fixed {
		position: fixed;
		bottom: 0;
		left: 0;
		max-width: 700px;
		width: 100%;
		background-color: #000000 !important;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.75rem 0.5rem 0.5rem 0.5rem;
		transition: transform 0.3s ease-in-out;
		border-top: none;
	}

	@media (min-width: 640px) {
		.nav-bottom-fixed {
			padding: 0.75rem 1rem 0.5rem 1rem;
		}
	}
	
	/* Bordes redondeados en pantallas grandes */
	@media (min-width: 700px) {
		.nav-bottom-fixed {
			border-radius: 20px 20px 0 0;
		}
	}

	.nav-bottom-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 2.25rem;
		width: 100%;
	}

	@media (min-width: 640px) {
		.nav-bottom-container {
			height: 2.5rem;
		}
	}

	/* Botones normales del nav - colores fijos */
	.nav-btn {
		padding: 0.25rem;
		border-radius: 9999px;
		transition: all 0.2s ease;
		background: transparent;
		border: none;
		cursor: pointer;
		color: #9ca3af !important; /* Gris fijo */
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-btn:hover {
		background: #1a1c20;
		color: #d1d5db !important;
	}

	.nav-btn-active {
		color: #ffffff !important; /* Blanco fijo cuando activo */
	}

	/* Botón de añadir - bordes dobles de colores diferentes */
	.nav-btn-add {
		width: 54px;
		height: 32px;
		border-radius: 8px;
		background: #2a2c31;
		border: none;
		border-bottom: 2px solid var(--border-color, #06b6d4);
		border-right: 2px solid var(--border-color, #06b6d4);
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0 0.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		position: relative;
	}

	/* Segundo borde inferior y derecho con ::before */
	.nav-btn-add::before {
		content: '';
		position: absolute;
		bottom: -4px;
		right: -4px;
		width: 100%;
		height: 100%;
		border-radius: 8px;
		border-bottom: 3px solid var(--wave-color-2, #8b5cf6);
		border-right: 3px solid var(--wave-color-2, #8b5cf6);
		pointer-events: none;
		z-index: -1;
	}

	/* Animación minimalista del botón */
	@keyframes fadeOut {
		0% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateY(-40px) scale(0.95);
			opacity: 0;
		}
	}

	.nav-btn-add.launching {
		animation: fadeOut 250ms cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	.nav-btn-add.launching::before {
		opacity: 0;
		transition: opacity 200ms ease-out;
	}

	.nav-btn-add.launching::after {
		opacity: 0;
		transition: opacity 200ms ease-out;
	}

	/* Botón de perfil */
	.nav-btn-profile {
		padding: 0;
		border-radius: 9999px;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-btn-profile:hover {
		transform: scale(1.05);
	}

	/* Avatar por defecto cuando no está logueado */
	.default-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: #2a2c31;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca3af;
		transition: all 0.2s ease;
	}

	.default-avatar svg {
		width: 20px;
		height: 20px;
	}

	.nav-btn-profile:hover .default-avatar {
		background: #3a3c41;
		color: #d1d5db;
	}

	@media (min-width: 640px) {
		.default-avatar {
			width: 40px;
			height: 40px;
		}

		.default-avatar svg {
			width: 22px;
			height: 22px;
		}
	}

	/* Transición de ocultación */
	.translate-y-full {
		transform: translateY(100%);
	}
</style>

<!-- Modales -->
<SearchModal bind:isOpen={searchModalOpen} on:openPollInGlobe={handleOpenPollInGlobe} />
<NotificationsModal bind:isOpen={notificationsModalOpen} />
<ProfileModal bind:isOpen={profileModalOpen} />
<AuthModal bind:isOpen={authModalOpen} />
