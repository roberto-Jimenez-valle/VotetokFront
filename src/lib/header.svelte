<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { navigationState, regionsWithData } from '$lib/stores/globalState';
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
    hasData?: boolean;
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
          const dataKeys = $regionsWithData;
          
          for (const place of places) {
            const type = place.level === 1 ? 'country' : 'subdivision';
            const id = place.subdivisionId;
            // Usar hasData de la API (verificado contra BD)
            results.push({
              id,
              name: place.name,
              iso: place.level === 1 ? id : undefined,
              type: type,
              parentName: place.parentName || null,
              hasData: place.hasData ?? false,
            });
          }
        }
        
        // Ordenar: primero con datos, luego por relevancia
        results.sort((a, b) => {
          // Primero ordenar por hasData (true primero)
          if (a.hasData !== b.hasData) {
            return a.hasData ? -1 : 1;
          }
          // Luego por relevancia (empieza con query)
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
    // No navegar si no tiene datos
    if (result.hasData === false) {
      return;
    }
    
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
			<div class="flex items-center justify-between h-14 sm:h-14 md:h-16 w-full">
				<img 
					src="/logo.png" 
					alt="VouTop" 
					class="h-12 sm:h-16 md:h-18 w-auto"
				/>
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
								<button 
									class="search-result-item {result.hasData === false ? 'no-data' : ''}" 
									onclick={() => selectSearchResult(result)}
									disabled={result.hasData === false}
								>
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
									{#if result.hasData === false}
										<span class="no-data-badge">Sin datos</span>
									{/if}
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
	
	/* Chips de navegación con neumorfismo suave */
	.nav-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 20px;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.2px;
		white-space: nowrap;
		flex-shrink: 0;
		height: 40px;
		border-radius: 12px;
		
		/* Neumorfismo suave integrado con fondo */
		background: var(--neo-bg, #e0e5ec);
		color: var(--neo-text, #6b7280);
		border: none;
		box-shadow: 
			5px 5px 10px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			-5px -5px 10px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		outline: none;
		transition: all 0.15s ease-out;
		user-select: none;
		position: relative;
	}
	
	.nav-chip:hover {
		box-shadow: 
			6px 6px 12px var(--neo-shadow-dark, rgba(163, 177, 198, 0.6)),
			-6px -6px 12px var(--neo-shadow-light, rgba(255, 255, 255, 0.7));
	}
	
	.nav-chip:active {
		box-shadow: 
			inset 3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			inset -3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
	}
	
	.nav-chip.active {
		font-weight: 600;
		color: var(--neo-text, #6b7280);
		box-shadow: 
			inset 2px 2px 5px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			inset -2px -2px 5px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
	}
	
	.nav-chip.dropdown-trigger {
		padding-right: 14px;
	}
	
	.nav-chip.dropdown-trigger span {
		font-size: 9px;
		color: var(--neo-text-light, #9ca3af);
		opacity: 0.8;
		margin-left: 4px;
		transition: transform 0.15s ease;
	}
	
	.nav-chip.dropdown-trigger:hover span {
		transform: translateY(1px);
	}
	
	.nav-divider {
		color: var(--neo-text-light, #9ca3af);
		opacity: 0.5;
		font-size: 12px;
		font-weight: 400;
		flex-shrink: 0;
		margin: 0 2px;
		transition: opacity 0.15s ease;
	}
	
	.header-nav-minimal:hover .nav-divider {
		opacity: 0.7;
	}
	
	/* Grupo de botones de navegación */
	.nav-buttons-group {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
		margin-left: 8px;
	}
	
	/* Ajustes para móvil */
	@media (max-width: 768px) {
		.nav-buttons-group {
			gap: 10px;
			margin-left: 6px;
		}
		
		.header-nav-minimal {
			gap: 6px;
			padding: 12px 8px;
		}
	}
	
	/* Botones de icono con neumorfismo suave */
	.nav-icon-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		flex-shrink: 0;
		
		/* Neumorfismo suave integrado con fondo */
		background: var(--neo-bg, #e0e5ec);
		color: var(--neo-text, #6b7280);
		border: none;
		box-shadow: 
			5px 5px 10px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			-5px -5px 10px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		outline: none;
		transition: all 0.15s ease-out;
		user-select: none;
		position: relative;
	}
	
	.nav-icon-btn:hover {
		color: var(--neo-text, #6b7280);
		box-shadow: 
			6px 6px 12px var(--neo-shadow-dark, rgba(163, 177, 198, 0.6)),
			-6px -6px 12px var(--neo-shadow-light, rgba(255, 255, 255, 0.7));
	}
	
	.nav-icon-btn:active {
		box-shadow: 
			inset 3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			inset -3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
	}
	
	.nav-icon-btn svg {
		transition: all 0.15s ease;
	}
	
	.nav-icon-btn:hover svg {
		transform: scale(1.05);
	}
	
	/* Overlay de búsqueda con neumorfismo suave */
	.nav-search-overlay {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		z-index: 20;
		animation: searchFadeIn 0.15s ease-out forwards;
		border-radius: 16px;
		
		/* Fondo sólido para cubrir los botones */
		background: var(--neo-bg, #e0e5ec);
		border: none;
	}
	
	/* Input contenedor con neumorfismo inset */
	.nav-search-overlay::before {
		content: '';
		position: absolute;
		left: 12px;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		height: 42px;
		border-radius: 21px;
		background: var(--neo-bg, #e0e5ec);
		box-shadow: 
			inset 3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			inset -3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
		z-index: -1;
	}
	
	@keyframes searchFadeIn {
		from {
			opacity: 0;
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
		color: var(--neo-text-light, #9ca3af);
		flex-shrink: 0;
		z-index: 1;
	}
	
	.nav-search-input-full {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--neo-text, #6b7280);
		font-size: 14px;
		min-width: 0;
		font-weight: 500;
		z-index: 1;
	}
	
	.nav-search-input-full::placeholder {
		color: var(--neo-text-light, #9ca3af);
		opacity: 0.8;
	}
	
	.nav-search-clear-btn {
		background: var(--neo-bg, #e0e5ec);
		border: none;
		padding: 6px 14px;
		border-radius: 10px;
		color: var(--neo-text-light, #9ca3af);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		z-index: 1;
		margin-right: 10px;
		box-shadow: 
			3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
			-3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
	}
	
	.nav-search-clear-btn:hover {
		color: var(--neo-text, #6b7280);
	}
	
	.nav-search-clear-btn:active {
		box-shadow: 
			inset 2px 2px 4px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
			inset -2px -2px 4px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
	}
	
	.nav-search-close-btn {
		background: var(--neo-bg, #e0e5ec);
		border: none;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		cursor: pointer;
		color: var(--neo-text-light, #9ca3af);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		z-index: 1;
		flex-shrink: 0;
		box-shadow: 
			3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
			-3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
	}
	
	.nav-search-close-btn:hover {
		color: var(--neo-text, #6b7280);
	}
	
	.nav-search-close-btn:active {
		box-shadow: 
			inset 2px 2px 4px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
			inset -2px -2px 4px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
	}
	
	/* Resultados de búsqueda con neumorfismo suave */
	.nav-search-results {
		position: absolute;
		left: 0px;
		right: 0px;
		top: 60px;
		border-radius: 16px;
		max-height: 300px;
		overflow-y: auto;
		z-index: 30;
		padding: 2px;
		
		/* Neumorfismo suave elevado */
		background: var(--neo-bg, #e0e5ec);
		border: none;
		box-shadow: 
			6px 6px 18px var(--neo-shadow-dark, rgba(163, 177, 198, 0.6)),
			-6px -6px 18px var(--neo-shadow-light, rgba(255, 255, 255, 0.7));
	}
	
	/* Scrollbar del dropdown */
	.nav-search-results::-webkit-scrollbar {
		width: 4px;
	}
	
	.nav-search-results::-webkit-scrollbar-track {
		background: transparent;
		margin: 8px;
	}
	
	.nav-search-results::-webkit-scrollbar-thumb {
		background: var(--neo-shadow-dark, rgba(163, 177, 198, 0.5));
		border-radius: 4px;
	}
	
	.nav-search-results::-webkit-scrollbar-thumb:hover {
		background: var(--neo-text-light, #9ca3af);
	}
	
	/* Desktop: mismo ancho que el input */
	@media (min-width: 768px) {
		.nav-search-results {
			left: 50%;
			right: auto;
			transform: translateX(-50%);
			width: calc(100% - 120px);
			max-width: 400px;
		}
	}
	
	.search-loading {
		padding: 20px 16px;
		text-align: center;
		color: var(--neo-text-light, #9ca3af);
		font-size: 13px;
		font-weight: 500;
	}
	
	.search-result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 14px;
		background: transparent;
		border: none;
		color: var(--neo-text, #6b7280);
		font-size: 14px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
		position: relative;
		border-radius: 10px;
		margin-bottom: 4px;
	}
	
	.search-result-item:last-child {
		margin-bottom: 0;
	}
	
	.search-result-item:hover {
		background: var(--neo-bg, #e0e5ec);
		box-shadow: 
			inset 3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
			inset -3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
	}
	
	.search-result-item:active {
		box-shadow: 
			inset 4px 4px 8px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
			inset -4px -4px 8px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
	}
	
	.result-icon {
		font-size: 18px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--neo-bg, #e0e5ec);
		border-radius: 8px;
		box-shadow: 
			2px 2px 4px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
			-2px -2px 4px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
	}
	
	.result-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	
	/* Estilos para opciones sin datos */
	.search-result-item.no-data {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.search-result-item.no-data:hover {
		background: transparent;
		box-shadow: none;
	}
	
	.search-result-item.no-data .result-name {
		color: var(--neo-text-light, #9ca3af);
	}
	
	.no-data-badge {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		background: rgba(156, 163, 175, 0.2);
		color: var(--neo-text-light, #9ca3af);
		padding: 3px 6px;
		border-radius: 4px;
		letter-spacing: 0.3px;
		border: 1px solid rgba(156, 163, 175, 0.3);
		white-space: nowrap;
	}
</style>

<!-- Modal de perfil movida a +page.svelte para que esté al nivel superior -->
