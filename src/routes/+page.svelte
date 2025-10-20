<script lang="ts">
	import Header from '$lib/header.svelte';
	// Usamos un componente dedicado GlobeGL basado en Globe.gl
	import GlobeGL from '$lib/GlobeGL.svelte';
	import NavBottom from '$lib/nav-bottom.svelte';
	import CreatePollModal from '$lib/CreatePollModal.svelte';
	import type { Poll } from '$lib/types';

	// topUsers eliminado - usar API

	let expandedPoll: Poll | null = $state(null);
	let navBottomHeight = $state(0);
	let hideNav = $state(false);
	let currentAltitude = $state(0);
	let bottomSheetVisible = $state(false);
	
	// Estado de poll eliminado - ya no se necesita PollOptionsBar
	let isCreatePollModalOpen = $state(false);
	let buttonColors = $state<string[]>([]);
	
	function handleOpenCreatePoll(event: CustomEvent<{ colors: string[] }>) {
		buttonColors = event.detail.colors;
		isCreatePollModalOpen = true;
	}
	
	function handlePollCreated(event: CustomEvent<any>) {
		const newPoll = event.detail;
		console.log('Poll created:', newPoll);
		// Aquí podrías recargar las encuestas o mostrar un mensaje de éxito
		// TODO: Implementar lógica para mostrar la encuesta recién creada en el globo
	}
	
	function handleSheetStateChange(event: CustomEvent<{ state: string }>) {
		const state = event.detail.state;
				// Ocultar nav cuando está en peek, mostrar en otros estados
		hideNav = state === 'peek';
		// BottomSheet visible cuando NO está en estado "hidden"
		bottomSheetVisible = state !== 'hidden';
			}
	
	function handleAltitudeChange(event: CustomEvent<{ altitude: number }>) {
		currentAltitude = event.detail.altitude;
	}
	
	// handlePollSelected eliminado - ya no se necesita

</script>


<div class="min-h-screen text-white font-sans">
	<!-- Globo de fondo a pantalla completa -->
	<GlobeGL 
		on:sheetstatechange={handleSheetStateChange} 
		on:altitudechange={handleAltitudeChange}
	/>

	<!-- Contenido por encima del globo -->
	<div class="relative">
		<Header />
		<div class="w-full flex flex-col">
			
		</div>
		<main
		class="w-full flex flex-col items-center text-center px-2 {expandedPoll ? 'opacity-0 pointer-events-none select-none overflow-x-hidden' : ''}"
		style="padding-bottom: {navBottomHeight}px;"
		>

    </main>

		<!-- Barra inferior sobre el globo -->
		<div class="relative ">
			<NavBottom bind:hidden={hideNav} modalOpen={isCreatePollModalOpen} on:openCreatePoll={handleOpenCreatePoll} />
		</div>
		
		<!-- Modal para crear encuestas -->
		<CreatePollModal 
			bind:isOpen={isCreatePollModalOpen}
			on:created={handlePollCreated}
			buttonColors={buttonColors}
		/>
		
		<!-- Barra de opciones eliminada: ya se muestra en BottomSheet -->
	</div>


</div>
