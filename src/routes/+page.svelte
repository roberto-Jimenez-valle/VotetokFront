<script lang="ts">
	import Header from '$lib/header.svelte';
	// Usamos un componente dedicado GlobeGL basado en Globe.gl
	import GlobeGL from '$lib/GlobeGL.svelte';
	import NavBottom from '$lib/nav-bottom.svelte';
	import type { Poll } from '$lib/types';

	const topUsers = [
		{ name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/10.jpg' },
		{ name: 'Marisol', avatar: 'https://randomuser.me/api/portraits/women/11.jpg' },
		{ name: 'John', avatar: 'https://randomuser.me/api/portraits/men/12.jpg' },
		{ name: 'Megan', avatar: 'https://randomuser.me/api/portraits/women/12.jpg' },
		{ name: 'Adam', avatar: 'https://randomuser.me/api/portraits/men/13.jpg' },
		{ name: 'Lucas', avatar: 'https://randomuser.me/api/portraits/men/14.jpg' },
		{ name: 'Sophia', avatar: 'https://randomuser.me/api/portraits/women/14.jpg' },
		{ name: 'David', avatar: 'https://randomuser.me/api/portraits/men/15.jpg' },
		{ name: 'Chloe', avatar: 'https://randomuser.me/api/portraits/women/15.jpg' },
		{ name: 'Alex', avatar: 'https://randomuser.me/api/portraits/men/16.jpg' }
	];

	let expandedPoll: Poll | null = $state(null);
	let navBottomHeight = $state(0);

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
	<GlobeGL />

	<!-- Contenido por encima del globo -->
	<div class="relative">
		<Header users={topUsers} />
		<div class="w-full flex flex-col">
			
		</div>
		<main
		class="w-full flex flex-col items-center text-center px-2 {expandedPoll ? 'opacity-0 pointer-events-none select-none overflow-x-hidden' : ''}"
		style="padding-bottom: {navBottomHeight}px;"
		>

    </main>

		<!-- Barra inferior sobre el globo -->
		<div class="relative ">
			<NavBottom />
		</div>
	</div>


</div>
