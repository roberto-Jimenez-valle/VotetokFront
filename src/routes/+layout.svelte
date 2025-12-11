<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import UnifiedThemeToggle from "$lib/components/UnifiedThemeToggle.svelte";
	import UnderConstruction from "$lib/UnderConstruction.svelte";
	import InstallPWABanner from "$lib/InstallPWABanner.svelte";
	// Store unificado de autenticación
	import { setCurrentUser, setAuth, initAuth } from "$lib/stores/auth";

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
		
		// Auto-bypass para desarrollo en red local
		const isLocalNetwork = window.location.hostname.startsWith('192.168.') ||
			window.location.hostname.startsWith('172.') ||
			window.location.hostname.startsWith('10.') ||
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1';
		
		hasAccess = access === "granted" || isLocalNetwork;

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

		return () => {
			document.removeEventListener("touchstart", preventZoom);
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
{/if}

<style>
	/* Estilos generales del layout */
</style>
