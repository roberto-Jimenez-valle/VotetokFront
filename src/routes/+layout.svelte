<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import UnifiedThemeToggle from '$lib/components/UnifiedThemeToggle.svelte';
	import UnderConstruction from '$lib/UnderConstruction.svelte';
	import { setCurrentUser } from '$lib/stores';
	import { currentUser as authUser, isAuthenticated, setAuth } from '$lib/stores/auth';
	
	let { children } = $props();
	let hasAccess = $state(false);
	
	function handlePaletteChange(event: CustomEvent) {
		const palette = event.detail;
		// Disparar evento global para que GlobeGL lo escuche
		window.dispatchEvent(new CustomEvent('palettechange', { detail: palette }));
	}
	
	function handleThemeChange(event: CustomEvent) {
		const { mode } = event.detail;
		// Disparar evento global si es necesario
		window.dispatchEvent(new CustomEvent('themechange', { detail: { mode } }));
	}
	
	let showSplash = $state(true);
	let showFullscreenBtn = $state(false);
	let isFullscreen = $state(false);
	
	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().then(() => {
				isFullscreen = true;
				showFullscreenBtn = false;
			}).catch((err) => {
							});
		} else {
			document.exitFullscreen().then(() => {
				isFullscreen = false;
			});
		}
	}
	
	onMount(() => {
		// 🔐 Verificar acceso
		const access = localStorage.getItem('voutop-access');
		hasAccess = access === 'granted';
		
		// Si no tiene acceso, no continuar con el resto de la inicialización
		if (!hasAccess) {
			console.log('🔒 Acceso restringido - mostrando página en construcción');
			return;
		}
		
		// 🔑 Capturar token de OAuth callback si existe en la URL
		const urlParams = new URLSearchParams(window.location.search);
		const authSuccess = urlParams.get('auth');
		const tokenFromUrl = urlParams.get('token');
		const userFromUrl = urlParams.get('user');
		
		if (authSuccess === 'success' && tokenFromUrl && userFromUrl) {
			try {
				const userData = JSON.parse(decodeURIComponent(userFromUrl));
				
				// Usar setAuth para guardar token y actualizar stores correctamente
				setAuth(tokenFromUrl, userData);
				
				// También actualizar el store currentUser con el formato esperado
				setCurrentUser({
					id: userData.userId,
					username: userData.username,
					displayName: userData.displayName,
					email: userData.email,
					avatarUrl: userData.avatarUrl,
					verified: userData.verified || false,
					countryIso3: userData.countryIso3,
					subdivisionId: userData.subdivisionId,
					role: userData.role
				});
				
				console.log('✅ Token de OAuth guardado exitosamente para:', userData.username);
				
				// Limpiar URL sin recargar la página
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, document.title, cleanUrl);
			} catch (error) {
				console.error('❌ Error al procesar callback de OAuth:', error);
			}
		}
		
		// 👤 Cargar usuario: primero intenta OAuth real, luego test user
		// 1. Verificar autenticación real (OAuth/JWT)
		const realAuthToken = localStorage.getItem('voutop-auth-token');
		const realAuthUser = localStorage.getItem('voutop-user');
		
		if (realAuthToken && realAuthUser) {
			// Usuario autenticado con OAuth - PRIORIDAD
			try {
				const user = JSON.parse(realAuthUser);
				
				// Guardar token en el store authToken para que apiCall funcione
				setAuth(realAuthToken, user);
				
				// También actualizar el store currentUser con el formato esperado
				setCurrentUser({
					id: user.userId,
					username: user.username,
					displayName: user.displayName,
					email: user.email,
					avatarUrl: user.avatarUrl,
					verified: user.verified || false,
					countryIso3: user.countryIso3,
					subdivisionId: user.subdivisionId,
					role: user.role
				});
				console.log('✅ Usuario autenticado con OAuth:', user.username, '(ID:', user.userId + ')');
			} catch (error) {
				console.error('❌ Error al cargar usuario OAuth:', error);
			}
		} else {
			// 2. Fallback: Usuario de prueba (solo desarrollo)
			const savedUser = localStorage.getItem('voutop-test-user');
			if (savedUser) {
				try {
					const user = JSON.parse(savedUser);
					setCurrentUser({
						id: user.id,
						username: user.username,
						displayName: user.displayName,
						email: user.email,
						avatarUrl: user.avatarUrl,
						verified: user.verified,
						countryIso3: user.countryIso3,
						subdivisionId: user.subdivisionId,
						role: user.role
					});
					console.log('🧪 Usuario de prueba cargado:', user.username, '(ID:', user.id + ')');
				} catch (error) {
					console.error('❌ Error al cargar usuario de prueba:', error);
				}
			} else {
				console.log('👤 Sin usuario - modo autenticación disponible');
			}
		}
		
		// Activar modo dark por defecto
		document.documentElement.classList.add('dark');
		
		// Detectar si es móvil
		const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
		
		// Mostrar botón de fullscreen en móvil después de 3 segundos
		if (isMobile) {
			setTimeout(() => {
				if (!document.fullscreenElement) {
					showFullscreenBtn = true;
				}
			}, 3000);
		}
		
		// Listener para cambios de fullscreen
		document.addEventListener('fullscreenchange', () => {
			isFullscreen = !!document.fullscreenElement;
			if (!isFullscreen) {
				showFullscreenBtn = true;
			}
		});
		
		if (isMobile) {
			// Crear un elemento temporal con altura para forzar scroll
			const scrollHelper = document.createElement('div');
			scrollHelper.style.cssText = 'position: absolute; top: 0; left: 0; width: 1px; height: 101vh; pointer-events: none;';
			document.body.appendChild(scrollHelper);
			
			// Hacer scroll automático para ocultar la barra
			setTimeout(() => {
				window.scrollTo(0, 1);
				setTimeout(() => {
					window.scrollTo(0, 0);
					// Remover el helper
					if (scrollHelper.parentNode) {
						scrollHelper.parentNode.removeChild(scrollHelper);
					}
				}, 50);
			}, 100);
			
			// Ocultar splash después de la animación
			const hideSplash = () => {
				showSplash = false;
			};
			
			setTimeout(hideSplash, 2000);
		} else {
			showSplash = false;
		}
		
		// DESHABILITADO: Este código estaba bloqueando el scroll vertical
		// Prevenir zoom con pinch (mantener solo esto)
		const preventZoom = (e: TouchEvent) => {
			if (e.touches.length > 1) {
				e.preventDefault();
			}
		};

		document.addEventListener('touchstart', preventZoom, { passive: false });
		
		// Prevenir double-tap zoom
		let lastTouchEnd = 0;
		document.addEventListener('touchend', (e) => {
			const now = Date.now();
			if (now - lastTouchEnd <= 300) {
				e.preventDefault();
			}
			lastTouchEnd = now;
		}, false);

		return () => {
			document.removeEventListener('touchstart', preventZoom);
		};
	});
</script>

{#if !hasAccess}
	<!-- Página en construcción -->
	<UnderConstruction />
{:else}
	{#if showSplash}
	<div class="splash-screen">
		<div class="splash-content">
			<!-- Logo VouTop -->
			<div class="logo-text">VouTop</div>
			<!-- Barra de opciones eliminada: ya se muestra en BottomSheet -->
		</div>
	</div>
	{/if}

	<!-- Unified Theme Toggle (renderizado en el header) -->
	<UnifiedThemeToggle 
		on:palettechange={handlePaletteChange}
		on:themechange={handleThemeChange}
	/>

	<!-- Botón de pantalla completa movido al BottomSheet -->

	{@render children()}
{/if}

<style>
	.splash-screen {
		position: fixed;
		inset: 0;
		background: #000000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-bottom: 20vh;
		z-index: 999999;
		animation: fadeOut 1s ease 1.5s forwards;
	}
	
	.splash-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}
	
	/* Logo VouTop */
	.logo-text {
		font-size: 32px;
		font-weight: 700;
		color: #c9d1d9;
		letter-spacing: 1px;
		animation: fadeInUp 1s ease-out;
	}
	
	/* Animaciones */
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	@keyframes fadeOut {
		to {
			opacity: 0;
			pointer-events: none;
		}
	}
</style>
