<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/header.svelte';
	// Usamos un componente dedicado GlobeGL basado en Globe.gl
	import GlobeGL from '$lib/GlobeGL.svelte';
	import NavBottom from '$lib/nav-bottom.svelte';
	import CreatePollModal from '$lib/CreatePollModal.svelte';
	import UserProfileModal from '$lib/UserProfileModal.svelte';
	import type { Poll } from '$lib/types';
	import { handleAuthCallback } from '$lib/utils/handleAuthCallback';

	// topUsers eliminado - usar API

	let expandedPoll: Poll | null = $state(null);
	let navBottomHeight = $state(0);
	let hideNav = $state(false);
	let currentAltitude = $state(0);
	let bottomSheetVisible = $state(false);
	let sheetExpanded = $state(false); // Track if sheet is expanded
	let dropdownOpen = $state(false); // Track dropdown state
	let forceHideNav = $state(false); // Forzar ocultación del nav
	
	// Estado de poll eliminado - ya no se necesita PollOptionsBar
	let isCreatePollModalOpen = $state(false);
	let buttonColors = $state<string[]>([]);
	
	// Estado para modal de perfil (a nivel de aplicación)
	let isProfileModalOpen = $state(false);
	let selectedProfileUserId = $state<number | null>(null);
	
	// Debug: observar cambios
	$effect(() => {
		console.log('[+page] Profile modal state changed:', { isProfileModalOpen, selectedProfileUserId });
	});
	
	// Manejar callback de autenticación OAuth
	onMount(() => {
		handleAuthCallback();
	});
	
	// Referencia al componente GlobeGL
	let globeGLComponent: any;
	
	function handleOpenCreatePoll(event: CustomEvent<{ colors: string[] }>) {
		buttonColors = event.detail.colors;
		isCreatePollModalOpen = true;
	}
	
	function handleCloseCreatePoll() {
		isCreatePollModalOpen = false;
	}
	
	function handlePollCreated(event: CustomEvent<any>) {
		const newPoll = event.detail;
		console.log('Poll created:', newPoll);
		// Aquí podrías recargar las encuestas o mostrar un mensaje de éxito
		// TODO: Implementar lógica para mostrar la encuesta recién creada en el globo
	}
	
	function handleSheetStateChange(event: CustomEvent<{ state: string }>) {
		const state = event.detail.state;
		
		// Actualizar si el sheet está expandido (para el Header)
		sheetExpanded = state === 'expanded';
		
		// Si forceHideNav está activo, no cambiar nada
		if (forceHideNav) return;
		
		// Si el dropdown está abierto, no cambiar el estado del nav
		if (!dropdownOpen) {
			// Ocultar nav cuando está en peek, mostrar en otros estados
			hideNav = state === 'peek';
		}
		// BottomSheet visible cuando NO está en estado "hidden"
		bottomSheetVisible = state !== 'hidden';
	}
	
	function handleAltitudeChange(event: CustomEvent<{ altitude: number }>) {
		currentAltitude = event.detail.altitude;
	}
	
	function handleDropdownStateChange(event: CustomEvent<{ open: boolean }>) {
		console.log('[+page] 🎯 handleDropdownStateChange EJECUTADO:', event.detail);
		// Actualizar estado del dropdown
		dropdownOpen = event.detail.open;
		forceHideNav = event.detail.open;
		// Ocultar/mostrar nav según el estado del dropdown
		hideNav = event.detail.open;
		console.log(`[+page] ✅ Estado actualizado - dropdownOpen=${dropdownOpen}, forceHideNav=${forceHideNav}, hideNav=${hideNav}`);
	}
	
	function handleOpenPollInGlobeFromHeader(event: CustomEvent<{ poll: any }>) {
		const { poll } = event.detail;
		console.log('[+page] 🌍 Abrir encuesta en globo desde header:', poll);
		
		// Llamar directamente a la función exportada de GlobeGL
		if (globeGLComponent && globeGLComponent.openPollInGlobe) {
			globeGLComponent.openPollInGlobe(poll);
			console.log('[+page] ✅ Función openPollInGlobe llamada en GlobeGL');
		} else {
			console.error('[+page] ❌ globeGLComponent o su método openPollInGlobe no disponible');
		}
	}
	
	function handleOpenBottomSheet() {
		console.log('[+page] 📊 Abrir BottomSheet desde botón Inicio');
		
		// Llamar directamente a la función exportada de GlobeGL
		if (globeGLComponent && globeGLComponent.openBottomSheet) {
			globeGLComponent.openBottomSheet();
			console.log('[+page] ✅ Función openBottomSheet llamada en GlobeGL');
		} else {
			console.error('[+page] ❌ globeGLComponent o su método openBottomSheet no disponible');
		}
	}
	
	// handlePollSelected eliminado - ya no se necesita
	
	// Escuchar cambios en la variable global
	$effect(() => {
		const checkGlobalState = () => {
			if (typeof window !== 'undefined') {
				const globalState = (window as any).globalNavDropdownOpen;
				if (globalState !== undefined && globalState !== forceHideNav) {
					console.log(`[+page] 🌐 Variable global cambió a: ${globalState}`);
					forceHideNav = globalState;
					hideNav = globalState;
					dropdownOpen = globalState;
				}
			}
		};
		
		// Verificar cada 100ms (rápido pero no excesivo)
		const interval = setInterval(checkGlobalState, 100);
		return () => clearInterval(interval);
	});

</script>


<div class="min-h-screen text-white font-sans">
	<!-- Globo de fondo a pantalla completa -->
	<GlobeGL 
		bind:this={globeGLComponent}
		on:sheetstatechange={handleSheetStateChange} 
		on:altitudechange={handleAltitudeChange}
		on:dropdownstatechange={handleDropdownStateChange}
	/>

	<!-- Contenido por encima del globo -->
	<div class="relative">
		<Header 
			on:openPollInGlobe={handleOpenPollInGlobeFromHeader}
			bind:isProfileModalOpen={isProfileModalOpen}
			bind:selectedProfileUserId={selectedProfileUserId}
			{sheetExpanded}
		/>
		<div class="w-full flex flex-col">
			
		</div>
		<main
		class="w-full flex flex-col items-center text-center px-2 {expandedPoll ? 'opacity-0 pointer-events-none select-none overflow-x-hidden' : ''}"
		style="padding-bottom: {navBottomHeight}px;"
		>

    </main>

		<!-- Barra inferior sobre el globo -->
		<div class="relative ">
			<NavBottom 
				bind:hidden={hideNav} 
				modalOpen={isCreatePollModalOpen} 
				on:openCreatePoll={handleOpenCreatePoll}
				on:closeCreatePoll={handleCloseCreatePoll}
				on:openPollInGlobe={handleOpenPollInGlobeFromHeader}
				on:openBottomSheet={handleOpenBottomSheet}
			/>
		</div>
		
		<!-- Modal para crear encuestas -->
		<CreatePollModal 
			bind:isOpen={isCreatePollModalOpen}
			on:created={handlePollCreated}
			buttonColors={buttonColors}
		/>
		
		<!-- Modal de perfil de usuario (a nivel superior) -->
		<UserProfileModal 
			bind:isOpen={isProfileModalOpen}
			bind:userId={selectedProfileUserId}
			on:pollClick={handleOpenPollInGlobeFromHeader}
		/>
		
		<!-- Barra de opciones eliminada: ya se muestra en BottomSheet -->
	</div>


</div>
