<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { navigationState } from '$lib/stores/globalState';
  import '$lib/styles/trending-ranking.css';
  
  const dispatch = createEventDispatcher();
  
  // Props de navegación (desde GlobeGL)
  let { 
    isProfileModalOpen = $bindable(false), 
    selectedProfileUserId = $bindable(null),
    sheetExpanded = false
  } = $props<{
    isProfileModalOpen?: boolean;
    selectedProfileUserId?: number | null;
    sheetExpanded?: boolean;
  }>();
  
  // Estado de navegación desde el store global
  let selectedCountryName = $derived($navigationState.countryName);
  let selectedSubdivisionName = $derived($navigationState.subdivisionName);
  let selectedCityName = $derived($navigationState.cityName);
  // hasSubdivisions: true si estamos en country o subdivision (siempre permitir explorar más)
  let hasSubdivisions = $derived($navigationState.level === 'country' || $navigationState.level === 'subdivision');
  
  // Referencia al contenedor de navegación para auto-scroll
  let navScrollContainer: HTMLElement | null = null;
  
  // Auto-scroll al final cuando cambia el nivel de navegación
  $effect(() => {
    // Detectar cambios en cualquier nivel
    const _country = selectedCountryName;
    const _subdivision = selectedSubdivisionName;
    const _city = selectedCityName;
    
    // Scroll al final después de que se renderice el nuevo botón
    if (navScrollContainer) {
      setTimeout(() => {
        if (navScrollContainer) {
          navScrollContainer.scrollTo({
            left: navScrollContainer.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  });
  
  // Estado local para búsqueda
  let showSearch = $state(false);
  let tagQuery = $state('');
  let searchResults = $state<Array<{
    id: string;
    name: string;
    iso?: string;
    type: 'country' | 'subdivision';
    parentName?: string | null;
  }>>([]);
  let isSearching = $state(false);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let searchInput = $state<HTMLInputElement | null>(null);
  
  // Estado para pantalla completa
  let fullscreenActive = $state(false);
  
  // Detectar cambios en fullscreen
  onMount(() => {
    const handleFullscreenChange = () => {
      fullscreenActive = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  });
  
  
  // Función de búsqueda (igual que BottomSheet)
  async function searchPlaces(query: string) {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    searchDebounceTimer = setTimeout(async () => {
      isSearching = true;
      const results: typeof searchResults = [];
      const lowerQuery = query.toLowerCase().trim();
      
      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&filter=places&limit=20`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          const places = data.data?.places || [];
          
          for (const place of places) {
            const type = place.level === 1 ? 'country' : 'subdivision';
            results.push({
              id: place.subdivisionId,
              name: place.name,
              iso: place.level === 1 ? place.subdivisionId : undefined,
              type: type,
              parentName: place.parentName || null,
            });
          }
        }
        
        // Ordenar por relevancia
        results.sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
          const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.name.localeCompare(b.name);
        });
        
        searchResults = results;
      } catch (error) {
        console.error('[Header Search] Error:', error);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 300);
  }
  
  // Seleccionar resultado de búsqueda (igual que BottomSheet)
  function selectSearchResult(result: typeof searchResults[0]) {
    tagQuery = '';
    searchResults = [];
    showSearch = false;
    
    // Dispatch event to parent to handle navigation
    const option = {
      id: result.id,
      name: result.name,
      iso: result.iso,
      parentName: result.parentName,
      fromDirectSearch: true,
    };
    const event = new CustomEvent('searchSelect', { detail: option });
    window.dispatchEvent(event);
  }
  
  // Toggle búsqueda
  function toggleSearch() {
    showSearch = !showSearch;
    if (showSearch) {
      // Focus en el input después de que aparezca
      setTimeout(() => searchInput?.focus(), 100);
    }
  }
  
  // Efecto para búsqueda reactiva (Svelte 5 runes mode)
  $effect(() => {
    if (tagQuery && tagQuery.length >= 2) {
      searchPlaces(tagQuery);
    } else {
      searchResults = [];
    }
  });
  
  // Funciones que disparan eventos globales para que GlobeGL los escuche
  function handleToggleDropdown() {
    // Disparar evento global que GlobeGL escucha
    window.dispatchEvent(new CustomEvent('headerToggleDropdown'));
  }
  
  function handleNavigateToView(level: string) {
    // Disparar evento global para navegación
    window.dispatchEvent(new CustomEvent('headerNavigateToView', { detail: { level } }));
  }
  
  function handleLocateMe() {
    // Disparar evento global para localización
    window.dispatchEvent(new CustomEvent('headerLocateMe'));
  }


  function openUserProfile(userId: number, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    selectedProfileUserId = userId;
    isProfileModalOpen = true;
  }
  
  function handlePollClickFromProfile(event: CustomEvent) {
    const { pollId } = event.detail;
    // Cerrar modal de perfil y abrir encuesta en el globo
    isProfileModalOpen = false;
    dispatch('openpoll', { pollId });
  }

</script>

<header class="top-0 left-0 right-0 z-50" style="position: fixed; pointer-events: auto;">
	<div class="w-full flex flex-col">
		<!-- Logo y Toggle -->
		<div class="transition-opacity duration-300 ease-in-out px-2 sm:px-4">
			<div class="flex items-center justify-between h-8 sm:h-10 w-full">
				<h1 
					class="logo-text text-xl sm:text-3xl font-extrabold tracking-tight"
					style="color: var(--neo-text, white);"
				>VouTop</h1>
				<div id="theme-toggle-slot"></div>
			</div>
		</div>

		<!-- Navegación (en el mismo contenedor que tenían los avatares) -->
		<div class="avatars-scroll-wrapper" class:sheet-expanded={sheetExpanded}>
			<div class="avatars-scroll-container">
				<div class="header-nav-minimal" bind:this={navScrollContainer}>
        {#if !selectedCountryName}
          <!-- Global es el último nivel activo - mostrar dropdown -->
          <button class="nav-chip active dropdown-trigger" onclick={handleToggleDropdown}>
            Global
            <span style="margin-left: 4px;">▼</span>
          </button>
        {:else}
          <!-- Global no es el último - sin dropdown -->
          <button class="nav-chip" onclick={() => handleNavigateToView('world')}>
            Global
          </button>
        {/if}

        {#if selectedCountryName}
          <div class="nav-divider">/</div>

          {#if !selectedSubdivisionName && hasSubdivisions}
            <button class="nav-chip active dropdown-trigger" onclick={handleToggleDropdown}>
              {selectedCountryName}
              <span style="margin-left: 4px;">▼</span>
            </button>
          {:else if !selectedSubdivisionName && !hasSubdivisions}
            <button class="nav-chip active">
              {selectedCountryName}
            </button>
          {:else}
            <button class="nav-chip" onclick={() => handleNavigateToView('country')}>
              {selectedCountryName}
            </button>
          {/if}
        {/if}

        {#if selectedSubdivisionName}
          <div class="nav-divider">/</div>

          {#if !selectedCityName && hasSubdivisions}
            <button class="nav-chip active dropdown-trigger" onclick={handleToggleDropdown}>
              {selectedSubdivisionName}
              <span style="margin-left: 4px;">▼</span>
            </button>
          {:else if !selectedCityName && !hasSubdivisions}
            <button class="nav-chip active">
              {selectedSubdivisionName}
            </button>
          {:else}
            <button class="nav-chip" onclick={() => handleNavigateToView('subdivision')}>
              {selectedSubdivisionName}
            </button>
          {/if}
        {/if}

        {#if selectedCityName}
          <div class="nav-divider">/</div>
          <button class="nav-chip active">
            {selectedCityName}
          </button>
        {/if}
      </div>

      <!-- Search input overlay (aparece encima de todo cuando showSearch es true) -->
      {#if showSearch}
        <div class="nav-search-overlay">
          <!-- ... -->
					<svg class="nav-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
					<input
						type="search"
						class="nav-search-input-full"
						placeholder={$navigationState.level === 'world' ? 'Buscar país...' : 'Buscar región...'}
						bind:value={tagQuery}
						bind:this={searchInput}
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => {
							if (e.key === 'Enter' && searchResults.length > 0) {
								e.preventDefault();
								selectSearchResult(searchResults[0]);
							}
						}}
						autocomplete="off"
					/>
					{#if tagQuery}
						<button
							class="nav-search-clear-btn"
							onclick={(e) => {
								e.preventDefault();
								tagQuery = '';
								searchInput?.focus();
							}}
							aria-label="Limpiar texto"
						>
							Limpiar
						</button>
					{/if}
					<button class="nav-search-close-btn" onclick={toggleSearch} aria-label="Cerrar búsqueda">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>

				<!-- Search results dropdown -->
				{#if searchResults.length > 0 || isSearching}
					<div class="nav-search-results">
						{#if isSearching}
							<div class="search-loading">Buscando...</div>
						{:else if searchResults.length > 0}
							{#each searchResults as result}
								<button class="search-result-item" onclick={() => selectSearchResult(result)}>
									<span class="result-icon">
										{#if result.type === 'country'}
											🌍
										{:else}
											📍
										{/if}
									</span>
									<span class="result-name">
										{#if result.id && result.id.includes('.')}
											<span class="hierarchy">
												<span class="hierarchy-separator">→</span>
												<span class="hierarchy-subdivision">{result.parentName || 'Subdivisión'}</span>
												<span class="hierarchy-separator">→</span>
												<span class="hierarchy-city">{result.name}</span>
											</span>
										{:else}
											{result.name}
										{/if}
									</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Botones de acción (solo cuando búsqueda está cerrada) -->
			{#if !showSearch}
				<div class="nav-buttons-group">
					<!-- Botón de ubicación -->
					<button
						class="nav-icon-btn"
						onclick={handleLocateMe}
						title="Mi ubicación"
						aria-label="Mi ubicación"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
							<circle cx="12" cy="10" r="3"></circle>
						</svg>
					</button>

					<!-- Botón de pantalla completa -->
					<button
						class="nav-icon-btn"
						onclick={() => {
							if (!document.fullscreenElement) {
								document.documentElement.requestFullscreen();
							} else {
								document.exitFullscreen();
							}
						}}
						title={fullscreenActive ? 'Salir de pantalla completa' : 'Pantalla completa'}
						aria-label={fullscreenActive ? 'Salir de pantalla completa' : 'Pantalla completa'}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							{#if fullscreenActive}
								<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
							{:else}
								<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
							{/if}
						</svg>
					</button>

					<!-- Botón de búsqueda -->
					<button class="nav-icon-btn" onclick={toggleSearch} aria-label="Buscar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="11" cy="11" r="8"></circle>
							<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						</svg>
					</button>
				</div>
			{/if}
			</div> <!-- cierre avatars-scroll-container -->
		</div> <!-- cierre avatars-scroll-wrapper -->
	</div> <!-- cierre w-full flex flex-col -->
</header>



<style>
	/* Contenedor de navegación */
	.avatars-scroll-wrapper {
		width: 100%;
		padding: 4px 0;
		margin-top:15px;
		position: relative;
		display: flex;
		justify-content: center;
		transition: transform 0.3s ease;
	}
	
	.avatars-scroll-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 12px;
	}
	
	/* Solo en móvil ajustar al 100% del ancho */
	@media (max-width: 768px) {
		.avatars-scroll-container {
			padding: 0 8px;
			width: 100%;
			max-width: 100vw;
			box-sizing: border-box;
		}
	}
	
	/* Navegación minimalista */
	.header-nav-minimal {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		-ms-overflow-style: none;
		flex: 1;
		min-width: 0;
		padding: 12px 12px;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
		touch-action: pan-x;
	}
	
	/* Solo en móvil limitar ancho al 100% */
	@media (max-width: 768px) {
		.header-nav-minimal {
			max-width: 100%;
		}
	}
	
	.header-nav-minimal::-webkit-scrollbar {
		display: none;
	}
	
	/* Chips de navegación con estilos neomórficos */
	.nav-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		flex-shrink: 0;
		height: 38px;
		border-radius: 19px;
		
		/* Estilos neomórficos sutiles */
		background: var(--neo-bg);
		color: var(--neo-text);
		border: none;
		box-shadow: 
			3px 3px 8px var(--neo-shadow-dark),
			-3px -3px 8px var(--neo-shadow-light);
		cursor: pointer;
		outline: none;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		user-select: none;
		position: relative;
	}
	
	.nav-chip:hover {
		box-shadow: 
			4px 4px 10px var(--neo-shadow-dark),
			-4px -4px 10px var(--neo-shadow-light);
		transform: translateY(-1px);
	}
	
	.nav-chip:active {
		box-shadow: 
			inset 3px 3px 6px var(--neo-shadow-dark),
			inset -3px -3px 6px var(--neo-shadow-light);
		transform: translateY(0);
	}
	
	.nav-chip.active {
		font-weight: 600;
		box-shadow: 
			inset 2px 2px 5px var(--neo-shadow-dark),
			inset -2px -2px 5px var(--neo-shadow-light),
			1px 1px 3px var(--neo-shadow-dark);
	}
	
	.nav-chip.dropdown-trigger {
		padding-right: 10px;
	}
	
	.nav-chip.dropdown-trigger span {
		font-size: 9px;
		color: var(--neo-text-light);
		opacity: 0.7;
		margin-left: 2px;
	}
	
	.nav-divider {
		color: var(--neo-text-light);
		opacity: 0.4;
		font-size: 12px;
		flex-shrink: 0;
		margin: 0 2px;
	}
	
	/* Grupo de botones de navegación */
	.nav-buttons-group {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	
	/* Ajustes para móvil */
	@media (max-width: 768px) {
		.nav-buttons-group {
			gap: 6px;
			margin-left: 4px;
		}
		
		.header-nav-minimal {
			gap: 6px;
			padding: 12px 8px;
		}
	}
	
	/* Botones de icono con estilos neomórficos */
	.nav-icon-btn {
		width: 38px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		flex-shrink: 0;
		
		/* Estilos neomórficos sutiles */
		background: var(--neo-bg);
		color: var(--neo-text);
		border: none;
		box-shadow: 
			3px 3px 8px var(--neo-shadow-dark),
			-3px -3px 8px var(--neo-shadow-light);
		cursor: pointer;
		outline: none;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		user-select: none;
		position: relative;
	}
	
	.nav-icon-btn:hover {
		box-shadow: 
			4px 4px 10px var(--neo-shadow-dark),
			-4px -4px 10px var(--neo-shadow-light);
		transform: translateY(-1px);
	}
	
	.nav-icon-btn:active {
		box-shadow: 
			inset 3px 3px 6px var(--neo-shadow-dark),
			inset -3px -3px 6px var(--neo-shadow-light);
		transform: translateY(0);
	}
	
	/* Overlay de búsqueda con estilo neomórfico */
	.nav-search-overlay {
		position: absolute;
		left: 16px;
		right: 16px;
		top: 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		max-height:47px;
		padding: 10px 16px;
		background: var(--neo-bg);
		border-radius: 19px;
		border: none;
		z-index: 10;
		animation: searchExpandMobile 0.25s ease-out forwards;
		
		/* Estilos neomórficos sutiles */
		box-shadow: 
			inset 2px 2px 3px var(--neo-shadow-dark),
			inset -2px -2px 3px var(--neo-shadow-light),
			1px 1px 4px var(--neo-shadow-dark);
	}
	
	@keyframes searchExpandMobile {
		from {
			opacity: 0;
			transform: scaleX(0.3);
			transform-origin: right center;
		}
		to {
			opacity: 1;
			transform: scaleX(1);
			transform-origin: right center;
		}
	}
	
	/* Desktop: limitar ancho del buscador y centrar */
	@media (min-width: 768px) {
		.nav-search-overlay {
			left: 50%;
			right: auto;
			transform: translateX(-50%);
			max-width: 400px;
			width: 100%;
			animation: searchExpandDesktop 0.25s ease-out forwards;
		}
		
		@keyframes searchExpandDesktop {
			from {
				opacity: 0;
				max-width: 50px;
			}
			to {
				opacity: 1;
				max-width: 400px;
			}
		}
	}
	
	.nav-search-icon {
		color: var(--neo-text-light);
		flex-shrink: 0;
	}
	
	.nav-search-input-full {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--neo-text);
		font-size: 14px;
		min-width: 0;
		font-weight: 500;
	}
	
	.nav-search-input-full::placeholder {
		color: var(--neo-text-light);
		opacity: 0.7;
	}
	
	.nav-search-clear-btn {
		background: transparent;
		border: none;
		padding: 4px 10px;
		border-radius: 12px;
		color: var(--neo-text-light);
		font-size: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-weight: 500;
	}
	
	.nav-search-clear-btn:hover {
		color: var(--neo-text);
		box-shadow: 
			inset 2px 2px 4px var(--neo-shadow-dark),
			inset -2px -2px 4px var(--neo-shadow-light);
	}
	
	.nav-search-close-btn {
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
		color: var(--neo-text-light);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.nav-search-close-btn:hover {
		color: var(--neo-text);
	}
	
	/* Resultados de búsqueda con estilo neomórfico */
	.nav-search-results {
		position: absolute;
		left: 16px;
		right: 16px;
		top: 60px;
		background: var(--neo-bg);
		border-radius: 16px;
		border: none;
		max-height: 250px;
		overflow-y: auto;
		z-index: 10;
		
		/* Sombras neomórficas sutiles */
		box-shadow: 
			3px 3px 8px var(--neo-shadow-dark),
			-3px -3px 8px var(--neo-shadow-light);
	}
	
	/* Scrollbar del dropdown */
	.nav-search-results::-webkit-scrollbar {
		width: 6px;
	}
	
	.nav-search-results::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.nav-search-results::-webkit-scrollbar-thumb {
		background: var(--neo-shadow-dark);
		border-radius: 3px;
	}
	
	.nav-search-results::-webkit-scrollbar-thumb:hover {
		background: var(--neo-text-light);
	}
	
	/* Desktop: mismo ancho que el input */
	@media (min-width: 768px) {
		.nav-search-results {
			left: 50%;
			right: auto;
			transform: translateX(-50%);
			width: 100%;
			max-width: 400px;
		}
	}
	
	.search-loading {
		padding: 16px;
		text-align: center;
		color: var(--neo-text-light);
		opacity: 0.7;
		font-size: 13px;
	}
	
	.search-result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		background: transparent;
		border: none;
		color: var(--neo-text);
		font-size: 14px;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.search-result-item:hover {
		box-shadow: 
			inset 2px 2px 4px var(--neo-shadow-dark),
			inset -2px -2px 4px var(--neo-shadow-light);
	}
	
	.search-result-item:not(:last-child) {
		border-bottom: 1px solid var(--neo-shadow-dark);
		border-bottom-width: 0.5px;
	}
	
	.result-icon {
		font-size: 16px;
	}
	
	.result-name {
		flex: 1;
	}
	
	.hierarchy {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	
	.hierarchy-separator {
		color: var(--neo-text-light);
		opacity: 0.5;
		font-size: 11px;
	}
	
	.hierarchy-subdivision {
		color: var(--neo-text-light);
		opacity: 0.8;
		font-size: 12px;
	}
	
	.hierarchy-city {
		color: var(--neo-text);
	}
</style>

<!-- Modal de perfil movida a +page.svelte para que esté al nivel superior -->
