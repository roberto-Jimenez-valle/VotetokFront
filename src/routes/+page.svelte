<script lang="ts">
	import Header from '$lib/header.svelte';
	import PollOptionsBar from '$lib/PollOptionsBar.svelte';
	// Usamos un componente dedicado GlobeGL basado en Globe.gl
	import GlobeGL from '$lib/GlobeGL.svelte';
	import NavBottom from '$lib/nav-bottom.svelte';
	import type { Poll } from '$lib/types';

	// topUsers eliminado - usar API

	let expandedPoll: Poll | null = $state(null);
	let navBottomHeight = $state(0);
	let hideNav = $state(false);
	let currentAltitude = $state(0);
	let bottomSheetVisible = $state(false);
	
	// Poll seleccionada para mostrar en la barra de opciones
	type SelectedPoll = {
		id: number;
		title: string;
		options: Array<{
			key: string;
			label: string;
			color: string;
			votes: number;
			avatarUrl?: string;
		}>;
	} | null;
	
	let selectedPoll = $state<SelectedPoll>(null);
	
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
	
	function handlePollSelected(event: CustomEvent<{ poll: any; options: any[] }>) {
		const { poll, options } = event.detail;
				
		if (poll === null) {
			// Vista global - ocultar barra
						selectedPoll = null;
		} else {
			// Encuesta seleccionada - mostrar barra
			const pollTitle = poll.title || poll.question || 'Encuesta';
						
			selectedPoll = {
				id: typeof poll.id === 'string' ? parseInt(poll.id) : poll.id,
				title: pollTitle,
				options: options.map((opt: any) => ({
					key: opt.key || opt.optionKey,
					label: opt.label || opt.optionLabel || opt.key,
					color: opt.color,
					votes: opt.votes || opt.voteCount || 0,
					avatarUrl: opt.avatarUrl
				}))
			};
			
					}
	}

</script>

<style global >
  .pwa-banner {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    z-index: 30000;
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    color: #e5e7eb;
    border: 1px solid rgba(255,255,255,0.28);
    background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.75) 100%);
    border-radius: 12px;
    backdrop-filter: blur(8px) saturate(120%);
  }
  .pwa-text { font: 13px/1.3 system-ui, sans-serif; opacity: .95; }
  .pwa-btn {
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.08);
    color: #fff;
    cursor: pointer;
  }
  .pwa-btn:hover { border-color: rgba(255,255,255,0.42); }
  .pwa-dismiss {
    width: 32px; height: 32px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.08);
    color: #fff; cursor: pointer;
  }
</style>

<div class="min-h-screen text-white font-sans">
	<!-- Globo de fondo a pantalla completa -->
	<GlobeGL 
		on:sheetstatechange={handleSheetStateChange} 
		on:altitudechange={handleAltitudeChange}
		on:pollselected={handlePollSelected}
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
			<NavBottom bind:hidden={hideNav} />
		</div>
	</div>


</div>
