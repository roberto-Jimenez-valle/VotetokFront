<script lang="ts">
	import { Home, Search, Bell, CirclePlus } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let hidden = $state(false);
	let activeItem = $state('home');

	function irANuevaEncuesta() {
		goto('/poll/new');
	} 
</script>

<nav
	class="fixed bottom-0 left-0 right-0 transition-transform duration-300 ease-in-out"
	style="z-index:30050"  
	class:translate-y-full={hidden}
>
	<div
		class="fixed bottom-0 left-0 w-full bg-[#181A20] flex justify-between items-center px-1 sm:px-4 py-1 sm:py-2 rounded-t-2xl"
		style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom)); z-index:30060"
	>
		<div class="flex items-center justify-between h-10 sm:h-12 w-full">
			<button
				onclick={() => (activeItem = 'home')}
				class="p-2 rounded-full transition-colors"
				class:text-white={activeItem === 'home'}
				class:text-gray-400={activeItem !== 'home'}
				aria-label="Inicio"
			>
				<Home class="w-6 h-6 sm:w-7 sm:h-7" />
			</button>
			<button
				onclick={() => (activeItem = 'search')}
				class="p-2 rounded-full transition-colors"
				class:text-white={activeItem === 'search'}
				class:text-gray-400={activeItem !== 'search'}
				aria-label="Buscar"
			>
				<Search class="w-6 h-6 sm:w-7 sm:h-7" />
			</button>
			<!-- Botón Añadir Publicación -->
			<button
				onclick={irANuevaEncuesta}
				class="p-2 rounded-full transition-colors mx-2"
				class:text-white={activeItem === 'add'}
				class:text-gray-400={activeItem !== 'add'}
				aria-label="Añadir publicación"
			>
				<CirclePlus class="w-6 h-6 sm:w-7 sm:h-7" />
			</button>
			<button
				onclick={() => (activeItem = 'notifications')}
				class="p-2 rounded-full transition-colors"
				class:text-white={activeItem === 'notifications'}
				class:text-gray-400={activeItem !== 'notifications'}
				aria-label="Notificaciones"
			>
				<Bell class="w-6 h-6 sm:w-7 sm:h-7" />
			</button>
			<button
				onclick={() => (activeItem = 'profile')}
				class="p-1 rounded-full"
				aria-label="Perfil"
			>
				<img src="https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&h=150&fit=crop&crop=face?width=40&height=40" alt="Perfil" class="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover" />
			</button>
			
			
		</div>
	</div>
</nav>
