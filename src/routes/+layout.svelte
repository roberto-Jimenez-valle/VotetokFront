<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import UnifiedThemeToggle from '$lib/components/UnifiedThemeToggle.svelte';
	import { setCurrentUser } from '$lib/stores';
	
	let { children } = $props();
	
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
		// 🎯 DESHABILITADO: Usuario de prueba para testing de autenticación
		// Para habilitar el usuario hardcodeado, descomenta el siguiente bloque:
		/*
		setCurrentUser({
			id: 1, // ✅ Cambiado a ID existente (maria_gonzalez)
			username: 'maria_gonzalez',
			displayName: 'María González',
			email: 'maria@votetok.com',
			avatarUrl: 'https://i.pravatar.cc/150?u=maria',
			verified: true,
			countryIso3: 'ESP',
			subdivisionId: '1',
			role: 'user'
		});
		console.log('👤 Usuario de prueba configurado: maria_gonzalez (ID: 1)');
		*/
		console.log('👤 Iniciando sin usuario (modo autenticación)');
		
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

{#if showSplash}
<div class="splash-screen">
	<div class="splash-content">
		<!-- Logo VouTop -->
		<div class="logo-text">VouTop</div>
		<!-- Imagen debajo del logo -->
		<img 
			src="/textures/image.png" 
			alt="VouTop" 
			class="splash-image"
		/>
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
	
	/* Imagen del splash */
	.splash-image {
		max-width: 400px;
		width: 90%;
		height: auto;
		object-fit: contain;
		animation: fadeInUp 1s ease-out 0.2s backwards;
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
