<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import PaletteRandomizer from '$lib/components/PaletteRandomizer.svelte';
	import { setCurrentUser } from '$lib/stores';
	
	let { children } = $props();
	
	function handlePaletteChange(event: CustomEvent) {
		const palette = event.detail;
		// Disparar evento global para que GlobeGL lo escuche
		window.dispatchEvent(new CustomEvent('palettechange', { detail: palette }));
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
		// 🎯 Configurar usuario de prueba para sistema de recomendaciones
		setCurrentUser({
			id: 15,
			username: 'testuser',
			displayName: 'Usuario de Prueba',
			email: 'testuser@votetok.com',
			avatarUrl: 'https://i.pravatar.cc/150?u=testuser',
			verified: false,
			countryIso3: 'ESP',
			subdivisionId: '1',
			role: 'user'
		});
		console.log('👤 Usuario de prueba configurado: testuser (ID: 15)');
		
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
		
		// Prevenir scroll en toda la página excepto en áreas permitidas
		const preventScroll = (e: TouchEvent) => {
			if (showSplash) return; // Permitir scroll en splash
			
			const target = e.target as HTMLElement;
			const isScrollable = target.closest('.sheet-content, .vote-cards-grid, .nav-minimal, .avatars-scroll-container, .avatars-scroll-wrapper');
			
			if (!isScrollable) {
				e.preventDefault();
			}
		};

		// Prevenir zoom con pinch
		const preventZoom = (e: TouchEvent) => {
			if (e.touches.length > 1) {
				e.preventDefault();
			}
		};

		document.addEventListener('touchmove', preventScroll, { passive: false });
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
			document.removeEventListener('touchmove', preventScroll);
			document.removeEventListener('touchstart', preventZoom);
		};
	});
</script>

{#if showSplash}
<div class="splash-screen">
	<!-- Logo VoteTok -->
	<div class="logo-text">VoteTok</div>
</div>
{/if}

<!-- Theme Toggle -->
<ThemeToggle />

<!-- Palette Randomizer -->
<PaletteRandomizer on:palettechange={handlePaletteChange} />

<!-- Botón de pantalla completa movido al BottomSheet -->

{@render children()}

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
	
	/* Logo VoteTok */
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
