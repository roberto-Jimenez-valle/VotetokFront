<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import { fade, fly, scale } from "svelte/transition";
	import { cubicOut, quintOut, backOut } from "svelte/easing";
	import UnifiedThemeToggle from "$lib/components/UnifiedThemeToggle.svelte";
	import UnderConstruction from "$lib/UnderConstruction.svelte";
	import InstallPWABanner from "$lib/InstallPWABanner.svelte";
	import MediaEmbed from "$lib/components/MediaEmbed.svelte";
	import CookieBanner from "$lib/CookieBanner.svelte";
	import AuthModal from "$lib/AuthModal.svelte";
	// Store unificado de autenticación
	import { setCurrentUser, setAuth, initAuth } from "$lib/stores/auth";
	// Store para fullscreen iframe
	import {
		fullscreenIframe,
		closeFullscreenIframe,
		initFullscreenIframeHistoryHandler,
		preloadIframeUrl,
		loginModalOpen,
	} from "$lib/stores/globalState";

	let { children } = $props();
	let hasAccess = $state(false);

	function handlePaletteChange(event: CustomEvent) {
		const palette = event.detail;
		// Disparar evento global para que GlobeGL lo escuche
		window.dispatchEvent(
			new CustomEvent("palettechange", { detail: palette }),
		);
	}

	function handleThemeChange(event: CustomEvent) {
		const { mode } = event.detail;
		// Disparar evento global si es necesario
		window.dispatchEvent(
			new CustomEvent("themechange", { detail: { mode } }),
		);
	}

	let showFullscreenBtn = $state(false);
	let isFullscreen = $state(false);

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement
				.requestFullscreen()
				.then(() => {
					isFullscreen = true;
					showFullscreenBtn = false;
				})
				.catch((err) => {});
		} else {
			document.exitFullscreen().then(() => {
				isFullscreen = false;
			});
		}
	}

	onMount(() => {
		// 🔐 Verificar acceso
		const access = localStorage.getItem("voutop-access");

		// Auto-bypass disable for testing
		/* const isLocalNetwork =
			window.location.hostname.startsWith("192.168.") ||
			window.location.hostname.startsWith("172.") ||
			window.location.hostname.startsWith("10.") ||
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1"; */

		// hasAccess = access === "granted" || isLocalNetwork;
		hasAccess = access === "granted";

		// Si no tiene acceso, no continuar con el resto de la inicialización
		if (!hasAccess) {
			console.log(
				"🔒 Acceso restringido - mostrando página en construcción",
			);
			return;
		}

		if (isLocalNetwork) {
			console.log("🏠 Acceso automático desde red local");
		}

		// 🔑 Capturar token de OAuth callback si existe en la URL
		const urlParams = new URLSearchParams(window.location.search);
		const authSuccess = urlParams.get("auth");
		const tokenFromUrl = urlParams.get("token");
		const userFromUrl = urlParams.get("user");

		if (authSuccess === "success" && tokenFromUrl && userFromUrl) {
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
					role: userData.role,
				});

				console.log(
					"✅ Token de OAuth guardado exitosamente para:",
					userData.username,
				);

				// Limpiar URL sin recargar la página
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, document.title, cleanUrl);
			} catch (error) {
				console.error("❌ Error al procesar callback de OAuth:", error);
			}
		}

		// 👤 Inicializar autenticación desde el store unificado
		// initAuth() se llama automáticamente al importar el módulo,
		// pero lo llamamos explícitamente para asegurar que se ejecute después del callback
		initAuth();

		// Activar modo dark por defecto
		document.documentElement.classList.add("dark");

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
		document.addEventListener("fullscreenchange", () => {
			isFullscreen = !!document.fullscreenElement;
			if (!isFullscreen) {
				showFullscreenBtn = true;
			}
		});

		if (isMobile) {
			// Crear un elemento temporal con altura para forzar scroll
			const scrollHelper = document.createElement("div");
			scrollHelper.style.cssText =
				"position: absolute; top: 0; left: 0; width: 1px; height: 101vh; pointer-events: none;";
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
		}

		// DESHABILITADO: Este código estaba bloqueando el scroll vertical
		// Prevenir zoom con pinch (mantener solo esto)
		const preventZoom = (e: TouchEvent) => {
			if (e.touches.length > 1) {
				e.preventDefault();
			}
		};

		document.addEventListener("touchstart", preventZoom, {
			passive: false,
		});

		// Prevenir double-tap zoom
		let lastTouchEnd = 0;
		document.addEventListener(
			"touchend",
			(e) => {
				const now = Date.now();
				if (now - lastTouchEnd <= 300) {
					e.preventDefault();
				}
				lastTouchEnd = now;
			},
			false,
		);

		// Inicializar handler para cerrar fullscreen con botón atrás
		const cleanupFullscreenHistory = initFullscreenIframeHistoryHandler();

		return () => {
			document.removeEventListener("touchstart", preventZoom);
			cleanupFullscreenHistory?.();
		};
	});
</script>

{#if !hasAccess}
	<!-- Página en construcción -->
	<UnderConstruction />
{:else}
	<!-- Unified Theme Toggle movido a GlobeGL -->
	<!-- <UnifiedThemeToggle 
		on:palettechange={handlePaletteChange}
		on:themechange={handleThemeChange}
	/> -->

	{@render children()}

	<!-- Banner de instalación PWA -->
	<InstallPWABanner />

	<!-- Banner de Cookies GDPR -->
	<CookieBanner />

	<!-- Global Auth Modal -->
	<AuthModal bind:isOpen={$loginModalOpen} />
{/if}

<!-- FULLSCREEN IFRAME OVERLAY (renderizado desde layout para evitar problemas de z-index) -->
{#if $fullscreenIframe}
	<div
		class="fullscreen-iframe-overlay"
		style="background-image: url('{$fullscreenIframe.thumbnail}');"
		in:scale={{ duration: 450, start: 0.4, opacity: 1, easing: quintOut }}
		out:scale={{ duration: 280, start: 0.85, opacity: 0, easing: cubicOut }}
	>
		<!-- Overlay oscuro suave sobre el thumbnail -->
		<div
			class="fullscreen-overlay-dim"
			in:fade={{ duration: 400, delay: 100 }}
			out:fade={{ duration: 200 }}
		></div>

		<button
			class="fullscreen-back-btn"
			onclick={closeFullscreenIframe}
			type="button"
			aria-label="Volver a la encuesta"
			in:fly={{ y: -40, duration: 500, delay: 200, easing: backOut }}
			out:fly={{ y: -30, duration: 200, easing: cubicOut }}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			<span>Volver</span>
		</button>

		<div
			class="fullscreen-iframe-container"
			in:scale={{
				duration: 500,
				start: 0.8,
				opacity: 0,
				delay: 150,
				easing: quintOut,
			}}
			out:scale={{
				duration: 200,
				start: 0.92,
				opacity: 0,
				easing: cubicOut,
			}}
		>
			<MediaEmbed
				url={$fullscreenIframe.url}
				mode="full"
				width="100%"
				height="100%"
				autoplay={true}
				unmuted={true}
			/>
		</div>
	</div>
{/if}

<!-- IFRAME PRELOAD OCULTO (precarga en segundo plano) -->
{#if $preloadIframeUrl && !$fullscreenIframe}
	<div class="preload-iframe-container">
		<MediaEmbed
			url={$preloadIframeUrl}
			mode="full"
			width="100%"
			height="100%"
			autoplay={false}
		/>
	</div>
{/if}

<style>
	/* Estilos generales del layout */

	.fullscreen-iframe-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		z-index: 99999999999;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.fullscreen-overlay-dim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 0;
	}

	.fullscreen-back-btn {
		position: fixed;
		top: env(safe-area-inset-top, 16px);
		left: 16px;
		margin-top: 16px;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 50px;
		color: white;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
	}

	.fullscreen-back-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.08);
		box-shadow: 0 6px 30px rgba(0, 0, 0, 0.5);
	}

	.fullscreen-back-btn:active {
		transform: scale(0.95);
	}

	.fullscreen-back-btn svg {
		width: 22px;
		height: 22px;
	}

	.fullscreen-iframe-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 20px;
		box-sizing: border-box;
	}

	.fullscreen-iframe-container :global(.media-embed),
	.fullscreen-iframe-container :global(.embed-container) {
		position: relative !important;
		width: 100% !important;
		height: 100% !important;
		max-width: min(100%, calc(100vh * 16 / 9)) !important;
		max-height: 100% !important;
		background: transparent !important;
		overflow: hidden;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	.fullscreen-iframe-container :global(iframe) {
		position: relative !important;
		background: #000 !important;
		width: 100% !important;
		height: 100% !important;
		max-width: 100% !important;
		max-height: 100% !important;
		aspect-ratio: 16 / 9;
		object-fit: contain !important;
	}

	/* Desktop - limitar ancho máximo para mejor visualización */
	@media (min-width: 601px) {
		.fullscreen-iframe-container {
			padding: 40px;
		}

		.fullscreen-iframe-container :global(.media-embed),
		.fullscreen-iframe-container :global(.embed-container) {
			max-width: min(95vw, calc((100vh - 80px) * 16 / 9)) !important;
			max-height: calc(100vh - 80px) !important;
		}
	}

	/* Móvil - espacio para botón volver */
	@media (max-width: 600px) {
		.fullscreen-iframe-container {
			padding: 10px;
			padding-top: calc(70px + env(safe-area-inset-top, 0px));
		}

		.fullscreen-iframe-container :global(.media-embed),
		.fullscreen-iframe-container :global(.embed-container) {
			max-width: 100% !important;
			max-height: calc(
				100dvh - 80px - env(safe-area-inset-top, 0px)
			) !important;
		}

		.fullscreen-back-btn {
			padding: 10px 16px;
			font-size: 14px;
		}
	}

	/* Iframe de precarga oculto */
	.preload-iframe-container {
		position: fixed;
		top: -9999px;
		left: -9999px;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}
</style>
