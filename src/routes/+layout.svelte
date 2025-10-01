<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	
	let showSplash = $state(true);
	let showFullscreenBtn = $state(false);
	let isFullscreen = $state(false);
	
	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().then(() => {
				isFullscreen = true;
				showFullscreenBtn = false;
			}).catch((err) => {
				console.log('Fullscreen error:', err);
			});
		} else {
			document.exitFullscreen().then(() => {
				isFullscreen = false;
			});
		}
	}
	
	onMount(() => {
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

<!-- Botón de pantalla completa movido al BottomSheet -->

<slot />

<style>
	.splash-screen {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding-bottom: 20vh; /* Desplazar hacia arriba */
		z-index: 999999;
		animation: fadeOut 1s ease 1.5s forwards;
	}
	
	/* Anillo neon brillante */
	.globe-container {
		width: 140px;
		height: 140px;
		position: relative;
		animation: float 3s ease-in-out infinite;
	}
	
	.neon-ring {
		position: absolute;
		width: 100px;
		height: 100px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 3px solid transparent;
		background: linear-gradient(#000, #000) padding-box,
					linear-gradient(135deg, 
						#ff0080 0%,
						#ff0040 25%,
						#8000ff 50%,
						#4000ff 75%,
						#00d4ff 100%) border-box;
		box-shadow: 
			0 0 20px rgba(255, 0, 128, 0.8),
			0 0 40px rgba(128, 0, 255, 0.6),
			0 0 60px rgba(64, 0, 255, 0.4),
			0 0 80px rgba(0, 212, 255, 0.3),
			inset 0 0 20px rgba(255, 0, 128, 0.3);
		animation: rotateHue 3s linear infinite, pulse 2s ease-in-out infinite;
	}
	
	.glow-core {
		position: absolute;
		width: 20px;
		height: 20px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: radial-gradient(circle, 
			rgba(255, 255, 255, 1) 0%,
			rgba(255, 0, 128, 0.8) 40%,
			transparent 70%);
		box-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
		animation: pulse 2s ease-in-out infinite;
	}
	
	.sparkle {
		position: absolute;
		width: 3px;
		height: 3px;
		background: #fff;
		border-radius: 50%;
		box-shadow: 0 0 10px rgba(255, 255, 255, 1);
	}
	
	.sparkle-1 {
		top: 15%;
		left: 50%;
		animation: sparkle 1.5s ease-in-out infinite;
	}
	
	.sparkle-2 {
		top: 50%;
		right: 15%;
		animation: sparkle 1.5s ease-in-out 0.4s infinite;
	}
	
	.sparkle-3 {
		bottom: 15%;
		left: 50%;
		animation: sparkle 1.5s ease-in-out 0.8s infinite;
	}
	
	.sparkle-4 {
		top: 50%;
		left: 15%;
		animation: sparkle 1.5s ease-in-out 1.2s infinite;
	}
	
	/* Logo VoteTok */
	.logo-text {
		font-size: 32px;
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 1px;
		animation: fadeInUp 1s ease-out;
	}
	
	/* Animaciones */
	@keyframes rotateHue {
		0% { filter: hue-rotate(0deg); }
		100% { filter: hue-rotate(360deg); }
	}
	
	@keyframes sparkle {
		0%, 100% { 
			opacity: 0.3;
			transform: scale(0.8);
		}
		50% { 
			opacity: 1;
			transform: scale(1.5);
			box-shadow: 0 0 20px rgba(255, 255, 255, 1);
		}
	}
	
	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		50% { transform: translateY(-10px); }
	}
	
	@keyframes pulse {
		0%, 100% { 
			opacity: 0.6;
			transform: scale(1);
		}
		50% { 
			opacity: 1;
			transform: scale(1.1);
		}
	}
	
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
	
	/* Botón de pantalla completa discreto */
	.fullscreen-btn {
		position: fixed;
		bottom: calc(70px + env(safe-area-inset-bottom)); /* Alineado con altitude-indicator */
		right: 12px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 25000; /* Por encima del BottomSheet (20000) */
		transition: all 0.3s ease;
		opacity: 0.7;
		animation: slideUp 0.5s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		pointer-events: auto; /* Asegurar que sea clickeable */
	}
	
	.fullscreen-btn:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.8);
		transform: scale(1.1);
	}
	
	.fullscreen-btn:active {
		transform: scale(0.95);
	}
	
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 0.7;
			transform: translateY(0);
		}
	}
</style>
