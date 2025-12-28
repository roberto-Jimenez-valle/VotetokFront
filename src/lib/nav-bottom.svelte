<script lang="ts">
	import { Home, Search, Bell, Plus } from "lucide-svelte";
	import { goto } from "$app/navigation";
	import SearchModal from "$lib/SearchModal.svelte";
	import NotificationsModal from "$lib/NotificationsModal.svelte";
	import UserProfileModal from "$lib/UserProfileModal.svelte";
	import AuthModal from "$lib/AuthModal.svelte";
	import { currentUser } from "$lib/stores";

	interface Props {
		hidden?: boolean;
		modalOpen?: boolean;
	}

	let { hidden = $bindable(false), modalOpen = false }: Props = $props();
	let activeItem = $state("home");
	let isLaunching = $state(false);

	// Estados de los modales
	let searchModalOpen = $state(false);
	let notificationsModalOpen = $state(false);
	let profileModalOpen = $state(false);
	let selectedProfileId = $state<number | null>(null);
	let authModalOpen = $state(false);

	// Colores aleatorios para el borde y las ondas
	const colors = [
		"#06b6d4", // cyan
		"#8b5cf6", // purple
		"#ec4899", // pink
		"#f59e0b", // amber
		"#10b981", // emerald
		"#3b82f6", // blue
		"#ef4444", // red
		"#f97316", // orange
	];

	const randomBorderColor = $state(
		colors[Math.floor(Math.random() * colors.length)],
	);
	const randomColor2 = $state(
		colors[Math.floor(Math.random() * colors.length)],
	);
	const randomColor3 = $state(
		colors[Math.floor(Math.random() * colors.length)],
	);

	// Debug: monitorear cambios en hidden
	$effect(() => {});

	import { createEventDispatcher } from "svelte";
	const dispatch = createEventDispatcher();

	function irANuevaEncuesta() {
		// Activar animación de lanzamiento
		isLaunching = true;

		// Abrir modal casi inmediatamente para transición minimalista (200ms)
		setTimeout(() => {
			isLaunching = false;
			dispatch("openCreatePoll", {
				colors: [randomBorderColor, randomColor2, randomColor3],
			});
		}, 200);
	}

	function openSearch() {
		activeItem = "search";
		// Cerrar otros modales
		notificationsModalOpen = false;
		profileModalOpen = false;
		searchModalOpen = true;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch("closeCreatePoll");
		}
	}

	function openNotifications() {
		activeItem = "notifications";
		// Cerrar otros modales
		searchModalOpen = false;
		profileModalOpen = false;
		notificationsModalOpen = true;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch("closeCreatePoll");
		}
	}

	function openProfile() {
		// Verificar si el usuario está autenticado
		if (!$currentUser) {
			// Si no está autenticado, mostrar modal de login
			activeItem = "profile";
			searchModalOpen = false;
			notificationsModalOpen = false;
			profileModalOpen = false;
			authModalOpen = true;
			if (modalOpen) {
				dispatch("closeCreatePoll");
			}
			return;
		}

		// Si está autenticado, abrir perfil normalmente
		activeItem = "profile";
		// Cerrar otros modales
		searchModalOpen = false;
		notificationsModalOpen = false;
		authModalOpen = false;

		// Set user ID for the modal
		if ($currentUser) {
			selectedProfileId = $currentUser.userId || ($currentUser as any).id;
		}

		profileModalOpen = true;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch("closeCreatePoll");
		}
	}

	function goHome() {
		activeItem = "home";
		// Cerrar todas las modales
		searchModalOpen = false;
		notificationsModalOpen = false;
		profileModalOpen = false;
		authModalOpen = false;
		// Cerrar modal de crear encuesta si está abierta
		if (modalOpen) {
			dispatch("closeCreatePoll");
		}
		// Disparar evento para abrir el bottomsheet
		dispatch("openBottomSheet");
	}

	// Propagar evento para abrir encuesta en globo
	function handleOpenPollInGlobe(event: CustomEvent<{ poll: any }>) {
		dispatch("openPollInGlobe", event.detail);
	}
	import { totalUnread, notificationCounts } from "$lib/stores/notifications";
	import { onMount } from "svelte";
	import { apiCall } from "$lib/api/client";

	function handleNotificationClick(event: CustomEvent) {
		dispatch("notificationClick", event.detail);
	}

	onMount(() => {
		// Fetch initial counts if user is logged in
		if ($currentUser) {
			apiCall("/api/notifications?limit=1")
				.then(async (res) => {
					if (res.ok) {
						const data = await res.json();
						if (data.counts) {
							notificationCounts.set(data.counts);
						}
					}
				})
				.catch((e) =>
					console.error("Error fetching notification counts", e),
				);
		}
	});
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
			class:nav-btn-active={activeItem === "home"}
			aria-label="Inicio"
		>
			<Home class="w-[1.8rem] h-[1.8rem]" />
		</button>
		<button
			onclick={openSearch}
			class="nav-btn"
			class:nav-btn-active={activeItem === "search"}
			aria-label="Buscar"
		>
			<Search class="w-[1.8rem] h-[1.8rem]" />
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
				<img
					src="/add_ico.PNG"
					alt="Añadir"
					class="w-full h-full object-fill"
				/>
			</button>
		{/if}
		<button
			onclick={openNotifications}
			class="nav-btn relative"
			class:nav-btn-active={activeItem === "notifications"}
			aria-label="Notificaciones"
		>
			<div class="relative">
				<Bell class="w-[1.8rem] h-[1.8rem]" />
				{#if $totalUnread > 0}
					<span
						class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] flex items-center justify-center border border-black transform scale-90"
					>
						{$totalUnread > 99 ? "99+" : $totalUnread}
					</span>
				{/if}
			</div>
		</button>
		<button
			onclick={openProfile}
			class="nav-btn-profile"
			aria-label="Perfil"
		>
			{#if $currentUser?.avatarUrl}
				<img
					src={$currentUser.avatarUrl}
					alt={$currentUser.displayName || $currentUser.username}
					class="w-[2.2rem] h-[2.2rem] rounded-full object-cover"
				/>
			{:else}
				<!-- Avatar por defecto cuando NO está logueado -->
				<div class="default-avatar">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
						></path>
						<circle cx="12" cy="7" r="4"></circle>
					</svg>
				</div>
			{/if}
		</button>
	</div>
</nav>

<!-- Modales -->
<SearchModal
	bind:isOpen={searchModalOpen}
	on:openPollInGlobe={handleOpenPollInGlobe}
/>
<NotificationsModal
	bind:isOpen={notificationsModalOpen}
	on:notificationClick={handleNotificationClick}
/>
<UserProfileModal
	bind:isOpen={profileModalOpen}
	bind:userId={selectedProfileId}
	on:pollClick={(e) => {
		dispatch("openPollInGlobe", { poll: { id: e.detail.pollId } });
	}}
/>
<AuthModal bind:isOpen={authModalOpen} />

<style>
	/* Nav siempre con fondo negro, independiente del tema */
	.nav-bottom-fixed {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		background-color: #000000 !important;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.75rem 0.5rem 0.5rem 0.5rem;
		transition: transform 0.3s ease-in-out;
		border-top: none;
		z-index: 30050;
	}

	@media (min-width: 640px) {
		.nav-bottom-fixed {
			padding: 0.75rem 1rem 0.5rem 1rem;
		}
	}

	/* Sidebar mode for Desktop */
	@media (min-width: 1024px) {
		.nav-bottom-fixed {
			top: 0;
			left: 0;
			bottom: 0;
			width: 5rem; /* Narrow sidebar with icons */
			height: 100vh;
			flex-direction: column;
			justify-content: flex-start;
			padding: 2rem 0;
			border-radius: 0;
		}

		.nav-bottom-container {
			flex-direction: column;
			height: 100%;
			gap: 2rem;
			padding-top: 2rem;
		}

		.nav-btn-add {
			margin: 1rem 0 !important;
		}
	}

	.nav-bottom-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 2.25rem;
		width: 100%;
		max-width: 700px;
	}

	@media (min-width: 640px) {
		.nav-bottom-container {
			height: 2.5rem;
		}
	}

	/* Botones normales del nav - colores fijos */
	.nav-btn {
		padding: 0.5rem;
		border-radius: 12px;
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
		background: rgba(255, 255, 255, 0.05);
		color: #ffffff !important;
	}

	.nav-btn-active {
		color: #ffffff !important; /* Blanco fijo cuando activo */
		background: rgba(255, 255, 255, 0.1);
	}

	/* Botón de añadir - bordes dobles de colores diferentes */
	.nav-btn-add {
		width: 50px;
		height: 44px;
		border-radius: 14px;
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0 0.5rem;
		position: relative;
	}

	.nav-btn-add:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
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

	/* Botón de perfil */
	.nav-btn-profile {
		padding: 2px;
		border-radius: 9999px;
		border: 2px solid transparent;
		background: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-btn-profile:hover {
		border-color: rgba(255, 255, 255, 0.2);
		transform: scale(1.05);
	}

	/* Avatar por defecto cuando no está logueado */
	.default-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #2a2c31;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca3af;
		transition: all 0.2s ease;
	}

	.default-avatar svg {
		width: 18px;
		height: 18px;
	}

	@media (min-width: 640px) {
		.default-avatar {
			width: 36px;
			height: 36px;
		}
	}

	/* Transición de ocultación */
	.translate-y-full {
		transform: translateY(100%);
	}

	@media (min-width: 1024px) {
		.translate-y-full {
			transform: translateX(-100%);
		}
	}
</style>
