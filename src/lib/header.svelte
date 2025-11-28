<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import SinglePollSection from './globe/cards/sections/SinglePollSection.svelte';
  import { currentUser } from '$lib/stores';
  import { apiCall, apiPost, apiDelete } from '$lib/api/client';
  import { createEventListenerManager } from '$lib/utils/eventListenerCleanup';
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
    
    console.log('[Header] 🔍 Búsqueda seleccionada:', result.name, 'ID:', result.id);
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
    console.log('[Header] 🎯 Evento headerToggleDropdown disparado');
  }
  
  function handleNavigateToView(level: string) {
    // Disparar evento global para navegación
    window.dispatchEvent(new CustomEvent('headerNavigateToView', { detail: { level } }));
    console.log('[Header] 🧭 Evento headerNavigateToView disparado:', level);
  }
  
  function handleLocateMe() {
    // Disparar evento global para localización
    window.dispatchEvent(new CustomEvent('headerLocateMe'));
    console.log('[Header] 📍 Evento headerLocateMe disparado');
  }

  type TrendingUser = {
    id: number;
    name: string;
    avatar: string;
    username: string;
  };

  let users = $state<TrendingUser[]>([]);
  let selectedUser = $state<TrendingUser | null>(null);
  let userPolls = $state<any[]>([]);
  let isLoadingPolls = $state(false);
  let currentPollIndex = $state(0);
  
  // Estados para swipe/arrastre en navegación
  let swipeStartX = 0;
  let swipeStartY = 0;
  let isSwiping = false;
  
  // Estados para drag en opciones (similar a BottomSheet)
  let touchStartX = 0;
  let touchStartY = 0;
  let isDragging = false;
  let currentDragGrid: HTMLElement | null = null;
  let currentDragPollId: string | null = null;
  
  // Estados para scroll manual de avatares
  let avatarScrollRef: HTMLElement | null = null;
  let isScrollingAvatars = false;
  let scrollStartX = 0;
  let scrollLeft = 0;
  
  // Estados para transición de encuestas
  let transitionDirection = $state<'next' | 'prev' | null>(null);
  
  
  // Estados para SinglePollSection
  let pollStates = $state<Record<string, 'expanded' | 'collapsed'>>({});
  let activeAccordions = $state<Record<string, number | null>>({});
  let currentPages = $state<Record<string, number>>({});
  let userVotes = $state<Record<string, string>>({});
  let multipleVotes = $state<Record<string, string[]>>({});
  let displayVotes = $state<Record<string, string>>({});
  let pollTitleExpanded = $state<Record<string, boolean>>({});
  let pollTitleTruncated = $state<Record<string, boolean>>({});
  let pollTitleElements = $state<Record<string, HTMLElement>>({});
  let voteEffectStates = $state<Record<string, boolean>>({});

  // Event Listener Manager para cleanup automático
  const eventListeners = createEventListenerManager();

  onMount(async () => {
    console.log('[Header] 🚀 Componente montado, cargando usuarios trending...');
    
    // Los listeners se agregarán solo cuando inicie un drag (ver handleCardDragStart)
    
    try {
      // Cargar usuarios que tienen rells o saves activos
      const url = '/api/users/with-activity?limit=8';
      console.log('[Header] Fetching:', url);
      
      const res = await apiCall(url);
      console.log('[Header] Response status:', res.status, res.ok);
      
      if (res.ok) {
        const result = await res.json();
        console.log('[Header] Response data:', result);
        
        if (result.data && result.data.length > 0) {
          users = result.data
            .filter((user: any) => user && user.id) // Filter out invalid entries
            .map((user: any) => ({
              id: user.id,
              name: user.displayName || user.username || 'Usuario',
              avatar: user.avatarUrl || '/default-avatar.png',
              username: user.username || ''
            }));
          console.log('[Header] ✅ Usuarios cargados:', users.length, users);
        } else {
          console.warn('[Header] ⚠️ No hay usuarios con actividad');
          users = [];
        }
      } else {
        const errorText = await res.text();
        console.error('[Header] ❌ Error en respuesta:', res.status, errorText);
        users = [];
      }
    } catch (e) {
      console.error('[Header] ❌ Error cargando usuarios:', e);
      users = [];
    }
    console.log('[Header] 🏁 Carga finalizada. Total usuarios:', users.length);
  });
  
  onDestroy(() => {
    console.log('[Header] 🧹 Limpiando event listeners:', eventListeners.count);
    
    // Cleanup automático de TODOS los listeners registrados
    eventListeners.cleanup();
    
    // Limpiar estado
    currentDragGrid = null;
    isDragging = false;
    currentDragPollId = null;
  });

  async function handleAvatarClick(user: TrendingUser) {
    selectedUser = user;
    userPolls = [];
    currentPollIndex = 0; // Reiniciar al primer índice
    isLoadingPolls = true;
    
    console.log('[Header] Loading polls for user:', user.id, user.name);
    
    try {
      // Cargar encuestas con interacciones del usuario (guardadas o reposteadas)
      const response = await apiCall(`/api/polls/user-interactions?userId=${user.id}&types=save,repost&limit=20`);
      console.log('[Header] Response status:', response.status, response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Header] Polls loaded:', result.data?.length || 0, 'polls');
        
        // Transformar datos para compatibilidad con SinglePollSection
        const transformedPolls = (result.data || []).map((poll: any) => ({
          ...poll,
          // Asegurar que tiene las propiedades necesarias
          id: poll.id?.toString() || poll.id,
          question: poll.title || poll.question,
          region: 'Global',
          type: poll.type || 'single', // Preservar tipo de encuesta
          options: (poll.options || []).map((opt: any) => ({
            ...opt,
            key: opt.optionKey || opt.key,
            label: opt.optionLabel || opt.label,
            votes: opt._count?.votes || opt.voteCount || opt.votes || 0,
            color: opt.color || '#10b981'
          })),
          totalVotes: poll._count?.votes || poll.totalVotes || 0,
          totalViews: poll._count?.interactions || poll.totalViews || 0
        }));
        
        console.log('[Header] Transformed polls:', transformedPolls);
        console.log('[Header] Poll types:', transformedPolls.map((p: any) => ({ id: p.id, type: p.type, question: p.question })));
        userPolls = transformedPolls;
        
        // Inicializar todos los polls como expandidos para permitir votación directa
        transformedPolls.forEach((poll: any) => {
          pollStates[poll.id] = 'expanded';
          activeAccordions[poll.id] = 0; // Primera opción activa
          currentPages[poll.id] = 0;
        });
      } else {
        console.warn('[Header] Failed to load polls, status:', response.status);
        const errorData = await response.text();
        console.warn('[Header] Error response:', errorData);
        userPolls = [];
      }
    } catch (error) {
      console.error('[Header] Error loading user polls:', error);
      userPolls = [];
    } finally {
      isLoadingPolls = false;
      console.log('[Header] Loading complete. Polls count:', userPolls.length);
    }
  }

  function closeModal() {
    // Limpiar event listeners cuando se cierra el modal
    document.removeEventListener('pointermove', handleCardDragMove as EventListener);
    document.removeEventListener('pointerup', handleCardDragEnd);
    document.removeEventListener('touchmove', handleCardDragMove as EventListener);
    document.removeEventListener('touchend', handleCardDragEnd);
    
    // Limpiar estado de drag
    currentDragGrid = null;
    isDragging = false;
    currentDragPollId = null;
    
    // Limpiar datos del modal
    selectedUser = null;
    userPolls = [];
    currentPollIndex = 0;
  }
  
  function nextPoll() {
    transitionDirection = 'next';
    setTimeout(() => transitionDirection = null, 300);
    
    if (currentPollIndex < userPolls.length - 1) {
      currentPollIndex++;
    } else {
      nextUser();
    }
  }
  
  function prevPoll() {
    transitionDirection = 'prev';
    setTimeout(() => transitionDirection = null, 300);
    
    if (currentPollIndex > 0) {
      currentPollIndex--;
    } else {
      prevUser();
    }
  }
  
  function nextUser() {
    transitionDirection = 'next';
    setTimeout(() => transitionDirection = null, 300);
    
    const currentIndex = users.findIndex(u => u.id === selectedUser?.id);
    if (currentIndex !== -1 && currentIndex < users.length - 1) {
      handleAvatarClick(users[currentIndex + 1]);
    }
  }
  
  function prevUser() {
    transitionDirection = 'prev';
    setTimeout(() => transitionDirection = null, 300);
    
    const currentIndex = users.findIndex(u => u.id === selectedUser?.id);
    if (currentIndex !== -1 && currentIndex > 0) {
      handleAvatarClick(users[currentIndex - 1]);
    }
  }
  
  function goToPoll(index: number) {
    // Determinar dirección basada en si vas adelante o atrás
    transitionDirection = index > currentPollIndex ? 'next' : 'prev';
    setTimeout(() => transitionDirection = null, 300);
    
    currentPollIndex = index;
  }
  
  // Handlers para drag en opciones (desde SinglePollSection)
  function handleCardDragStart(e: CustomEvent) {
    const event = e.detail.event as PointerEvent | TouchEvent;
    const pollId = e.detail.pollId;
    
    // No capturar eventos en barra de avatares
    const target = event.target as HTMLElement;
    if (target.closest('.modal-avatars-scroll, .avatar-small-btn')) {
      return;
    }
    
    // Solo permitir arrastre en dispositivos táctiles
    if (event.type === 'pointerdown' && (event as PointerEvent).pointerType === 'mouse') {
      return;
    }
    
    const grid = event.currentTarget as HTMLElement;
    if (grid && grid.classList.contains('dense')) {
      return;
    }
    
    const touch = 'touches' in event ? event.touches[0] : event;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isDragging = false;
    currentDragGrid = grid;
    currentDragPollId = pollId || null;
    
    // Solo agregar listeners si el drag inició en una vote-card
    const startTarget = event.target as HTMLElement;
    if (!startTarget.closest('.vote-card')) {
      return; // No capturar eventos si no es en una tarjeta
    }
    
    // Agregar listeners globales con manager (cleanup automático)
    // El manager previene duplicados automáticamente
    eventListeners.add(document, 'pointermove', handleCardDragMove as EventListener, { passive: true });
    eventListeners.add(document, 'pointerup', handleCardDragEnd);
    eventListeners.add(document, 'touchmove', handleCardDragMove as EventListener, { passive: true });
    eventListeners.add(document, 'touchend', handleCardDragEnd);
    
    console.log('[Header] 📌 Event listeners activos:', eventListeners.count);
  }
  
  function handleCardDragMove(e: PointerEvent | TouchEvent) {
    if (!currentDragGrid) return;
    
    // No interferir con scroll de avatares
    const target = e.target as HTMLElement;
    if (target.closest('.modal-avatars-scroll, .avatar-small-btn')) {
      return;
    }
    
    try {
      const touch = 'touches' in e ? e.touches[0] : e;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      
      // Detectar movimiento horizontal
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
        isDragging = true;
        
        // NO usar preventDefault, confiar en touch-action CSS
        
        let currentIndex = activeAccordions[currentDragPollId || ''] ?? null;
        const cards = currentDragGrid.querySelectorAll('.vote-card');
        const totalCards = cards.length;
        
        // Si no hay ninguna activa, activar la primera o última según dirección
        if ((currentIndex === null || currentIndex === undefined) && totalCards > 0) {
          currentIndex = deltaX < 0 ? 0 : totalCards - 1;
          if (currentDragPollId) {
            activeAccordions[currentDragPollId] = currentIndex;
          }
          touchStartX = touch.clientX;
          return;
        }
        
        // Cambiar a siguiente/anterior opción
        if (currentIndex !== null && currentIndex !== undefined) {
          if (deltaX < -50) {
            if (currentIndex < totalCards - 1) {
              // Hay más opciones en esta página
              activeAccordions[currentDragPollId || ''] = currentIndex + 1;
              touchStartX = touch.clientX;
            } else if (currentDragPollId) {
              // Es la última opción, cambiar de página
              const currentPoll = userPolls.find(p => p.id.toString() === currentDragPollId);
              if (currentPoll && currentPoll.options) {
                const currentPage = currentPages[currentDragPollId] || 0;
                const totalPages = Math.ceil(currentPoll.options.length / 4);
                
                if (currentPage < totalPages - 1) {
                  // Hay más páginas, cambiar a la siguiente
                  currentPages[currentDragPollId] = currentPage + 1;
                  activeAccordions[currentDragPollId] = 0;
                  touchStartX = touch.clientX;
                }
              }
            }
          } else if (deltaX > 50) {
            if (currentIndex > 0) {
              // Hay opciones anteriores en esta página
              activeAccordions[currentDragPollId || ''] = currentIndex - 1;
              touchStartX = touch.clientX;
            } else if (currentDragPollId) {
              // Es la primera opción, cambiar a página anterior
              const currentPage = currentPages[currentDragPollId] || 0;
              
              if (currentPage > 0) {
                // Hay página anterior
                currentPages[currentDragPollId] = currentPage - 1;
                activeAccordions[currentDragPollId] = 3;
                touchStartX = touch.clientX;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[Header] Error en drag:', error);
      isDragging = false;
      currentDragGrid = null;
    }
  }
  
  function handleCardDragEnd() {
    isDragging = false;
    currentDragGrid = null;
    currentDragPollId = null;
    
    // Remover listeners globales cuando termina el drag
    document.removeEventListener('pointermove', handleCardDragMove as EventListener);
    document.removeEventListener('pointerup', handleCardDragEnd);
    document.removeEventListener('touchmove', handleCardDragMove as EventListener);
    document.removeEventListener('touchend', handleCardDragEnd);
  }
  
  // Handlers para scroll manual de avatares
  function handleAvatarScrollStart(e: MouseEvent | TouchEvent) {
    const target = e.currentTarget as HTMLElement;
    avatarScrollRef = target;
    isScrollingAvatars = true;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    scrollStartX = clientX;
    scrollLeft = target.scrollLeft;
  }
  
  function handleAvatarScrollMove(e: MouseEvent | TouchEvent) {
    if (!isScrollingAvatars || !avatarScrollRef) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = scrollStartX - clientX;
    avatarScrollRef.scrollLeft = scrollLeft + deltaX;
  }
  
  function handleAvatarScrollEnd() {
    isScrollingAvatars = false;
    avatarScrollRef = null;
  }
  
  // Handlers para swipe en barra de navegación
  function handleSwipeStart(e: MouseEvent | TouchEvent) {
    const target = e.target as HTMLElement;
    
    // No capturar swipe en barra de avatares
    if (target.closest('.modal-avatars-scroll, .top-avatars-bar, .avatar-small-btn')) {
      isSwiping = false;
      return;
    }
    
    // Si es un botón u otro control, no iniciar swipe
    if (target.closest('button:not(.progress-bar), input, textarea, select, a')) {
      isSwiping = false;
      return;
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeStartX = clientX;
    swipeStartY = clientY;
    isSwiping = true;
  }
  
  function handleSwipeMove(e: MouseEvent | TouchEvent) {
    if (!isSwiping) return;
    
    // No interferir con scroll de avatares
    const target = e.target as HTMLElement;
    if (target.closest('.modal-avatars-scroll, .top-avatars-bar, .avatar-small-btn')) {
      isSwiping = false;
      return;
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - swipeStartX;
    const deltaY = clientY - swipeStartY;
    
    // Si el movimiento todavía es muy pequeño, no cancelar aún
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      return;
    }
    
    // Solo swipe horizontal, no vertical
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      console.log('[Header] ❌ Swipe cancelado: movimiento vertical');
      isSwiping = false;
      return;
    }
  }
  
  function handleSwipeEnd(e: MouseEvent | TouchEvent) {
    if (!isSwiping) {
      return;
    }
    
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
    const deltaX = clientX - swipeStartX;
    const threshold = 50; // mínimo 50px para contar como swipe
    
    console.log('[Header] Swipe end:', { deltaX, threshold });
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) {
        // Swipe izquierda -> siguiente
        console.log('[Header] 👉 Swipe izquierda detectado');
        if (currentPollIndex < userPolls.length - 1) {
          console.log('[Header] Siguiente encuesta');
          nextPoll();
        } else {
          console.log('[Header] Siguiente usuario');
          nextUser();
        }
      } else {
        // Swipe derecha -> anterior
        console.log('[Header] 👈 Swipe derecha detectado');
        if (currentPollIndex > 0) {
          console.log('[Header] Encuesta anterior');
          prevPoll();
        } else {
          console.log('[Header] Usuario anterior');
          prevUser();
        }
      }
    } else {
      console.log('[Header] Swipe muy corto, ignorado');
    }
    
    isSwiping = false;
  }
  
  // Handlers para eventos de SinglePollSection
  function handleSetActive(event: CustomEvent) {
    const { pollId, index } = event.detail;
    console.log('[Header] 🔓 Activando opción:', { pollId, index });
    pollStates[pollId] = 'expanded';
    activeAccordions[pollId] = index;
  }
  
  async function sendVoteToServer(pollId: string, optionKey: string) {
    console.log('[Header sendVote] 🎯 Enviando voto:', { pollId, optionKey });
    
    // Buscar la encuesta
    const poll = userPolls.find(p => p.id == pollId);
    if (!poll) {
      console.error('[Header sendVote] ❌ Encuesta no encontrada');
      return;
    }
    
    // Buscar la opción
    const option = poll.options?.find((o: any) => o.key === optionKey);
    if (!option) {
      console.error('[Header sendVote] ❌ Opción no encontrada');
      return;
    }
    
    // Obtener IDs numéricos
    console.log('[Header sendVote] 🔍 Opción completa:', option);
    console.log('[Header sendVote] 🔍 Campos disponibles:', Object.keys(option));
    
    const rawOptionId = option.id || option.optionId;
    if (!rawOptionId && rawOptionId !== 0) {
      console.error('[Header sendVote] ❌ Opción sin ID');
      console.error('[Header sendVote] option.id:', option.id);
      console.error('[Header sendVote] option.optionId:', option.optionId);
      console.error('[Header sendVote] option completa:', JSON.stringify(option, null, 2));
      return;
    }
    
    const optionId = typeof rawOptionId === 'string' ? parseInt(rawOptionId) : rawOptionId;
    const numericPollId = typeof poll.id === 'string' ? parseInt(poll.id) : poll.id;
    
    console.log('[Header sendVote] 📤 IDs a enviar:', {
      optionId,
      optionIdType: typeof optionId,
      pollId: numericPollId,
      pollIdType: typeof numericPollId
    });
    
    console.log('[Header sendVote] 🔍 DEBUG - Poll completo:', JSON.stringify(poll, null, 2));
    console.log('[Header sendVote] 🔍 DEBUG - Opción completa:', JSON.stringify(option, null, 2));
    console.log('[Header sendVote] 🔍 DEBUG - Todas las opciones del poll:', JSON.stringify(poll.options, null, 2));
    
    try {
      // Sistema híbrido de geolocalización
      let latitude = 40.4168;  // Madrid por defecto
      let longitude = -3.7038;
      let subdivisionId: number | null = null;
      
      // PASO 1: Intentar GPS
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 300000,
              enableHighAccuracy: true
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          console.log('[Header sendVote] 📍 GPS obtenido:', { latitude, longitude });
        }
      } catch (gpsError) {
        console.warn('[Header sendVote] ⚠️ GPS no disponible');
        
        // PASO 2: Fallback a IP Geolocation
        try {
          const ipResponse = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            if (ipData.latitude && ipData.longitude) {
              latitude = ipData.latitude;
              longitude = ipData.longitude;
              console.log('[Header sendVote] ✅ IP Geolocation:', { latitude, longitude });
            }
          }
        } catch (ipError) {
          console.log('[Header sendVote] 📍 Usando Madrid por defecto');
        }
      }
      
      // PASO 3: Geocodificar a subdivisión
      try {
        const geocodeResponse = await apiCall(`/api/geocode?lat=${latitude}&lon=${longitude}`);
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.found && geocodeData.subdivisionId) {
            subdivisionId = geocodeData.subdivisionId;
            console.log('[Header sendVote] 🌍 Subdivisión:', geocodeData.name);
          }
        }
      } catch (geocodeError) {
        console.warn('[Header sendVote] ⚠️ Geocoding falló');
      }
      
      // Si no hay subdivisionId, se enviará como null (ubicación sin identificar)
      if (!subdivisionId) {
        console.warn('[Header sendVote] ⚠️ subdivisionId es null - voto sin ubicación identificada');
      }
      
      const votePayload = {
        optionId,
        userId: $currentUser?.id || null,
        latitude,
        longitude,
        subdivisionId
      };
      
      console.log('[Header sendVote] 📤 Payload completo a enviar:', JSON.stringify(votePayload, null, 2));
      console.log('[Header sendVote] 📤 URL:', `/api/polls/${numericPollId}/vote`);
      
      const result = await apiPost(`/api/polls/${numericPollId}/vote`, votePayload);
      console.log('[Header sendVote] ✅ Voto guardado:', result);
      
      // Actualizar contadores si es voto nuevo
      if (!result.isUpdate) {
        if (poll.totalVotes !== undefined) poll.totalVotes++;
        if (option.votes !== undefined) option.votes++;
      }
      
      return true;
    } catch (error) {
      console.error('[Header sendVote] ❌ Error al enviar voto:', error);
      // El cliente API ya maneja los errores y lanza excepciones
      return false;
    } 
  }
  
  // Función para manejar votación múltiple
  function handleMultipleVote(optionKey: string, pollId: string) {
    const poll = userPolls.find(p => p.id == pollId);
    if (!poll || poll.type !== 'multiple') return;
    
    // Inicializar array si no existe
    if (!multipleVotes[pollId]) {
      multipleVotes[pollId] = [];
    }
    
    // Alternar selección
    const currentVotes = multipleVotes[pollId];
    const index = currentVotes.indexOf(optionKey);
    
    if (index > -1) {
      // Quitar voto
      multipleVotes[pollId] = currentVotes.filter(k => k !== optionKey);
    } else {
      // Añadir voto
      multipleVotes[pollId] = [...currentVotes, optionKey];
    }
    
    // Forzar reactividad
    multipleVotes = { ...multipleVotes };
    console.log('[Header] 🗳️ Voto múltiple actualizado:', { pollId, optionKey, selected: multipleVotes[pollId] });
  }
  
  function handleOptionClick(event: CustomEvent) {
    const { pollId, optionKey, optionColor } = event.detail;
    console.log('[Header] 🗳️ Click en opción:', { pollId, optionKey, optionColor });
    
    // Buscar el poll para verificar su tipo
    const poll = userPolls.find(p => p.id == pollId);
    console.log('[Header] 🔍 Poll encontrado:', { pollId, type: poll?.type, poll });
    
    // Si es encuesta múltiple, usar lógica de selección múltiple
    if (poll?.type === 'multiple') {
      console.log('[Header] 📊 Encuesta MÚLTIPLE detectada, usando handleMultipleVote');
      handleMultipleVote(optionKey, pollId);
      return;
    }
    
    console.log('[Header] 📊 Encuesta ÚNICA detectada, votando directamente');
    
    // Votación única
    // Actualizar voto local mutando directamente
    userVotes[pollId] = optionKey;
    displayVotes[pollId] = optionKey;
    
    // Mostrar efecto visual
    voteEffectStates[pollId] = true;
    setTimeout(() => {
      voteEffectStates[pollId] = false;
    }, 1000);
    
    console.log('[Header] ✅ Voto registrado:', { pollId, optionKey, userVotes: {...userVotes} });
    
    // Enviar voto al servidor
    sendVoteToServer(pollId, optionKey);
  }
  
  function handleOpenInGlobe(event: CustomEvent) {
    const { poll } = event.detail;
    console.log('[Header] 🌍 Abrir en globo:', poll);
    
    // Disparar evento al componente padre para que lo propague a GlobeGL
    dispatch('openPollInGlobe', { poll });
    
    // Cerrar la modal
    closeModal();
  }
  
  function handlePageChange(event: CustomEvent) {
    const { pollId, page } = event.detail;
    console.log('[Header] 📄 Cambio de página:', { pollId, page });
    currentPages[pollId] = page;
  }
  
  function handleAddOption(event: CustomEvent) {
    const { pollId, previewColor } = event.detail;
    console.log('[Header] ➕ Agregar opción:', { pollId, previewColor });
    
    // Encontrar el poll y agregar una nueva opción en edición
    const pollIndex = userPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
      const newOptionKey = `temp_${Date.now()}`;
      userPolls[pollIndex].options = [
        ...userPolls[pollIndex].options,
        {
          key: newOptionKey,
          label: '',
          votes: 0,
          color: previewColor,
          isEditing: true
        }
      ];
      console.log('[Header] ✅ Nueva opción agregada temporalmente');
    }
  }
  
  async function handleConfirmMultiple(event: CustomEvent) {
    const { pollId } = event.detail;
    console.log('[Header] ✓ Confirmar múltiple:', { pollId, selected: multipleVotes[pollId] });
    
    // Marcar como votado
    if (multipleVotes[pollId] && multipleVotes[pollId].length > 0) {
      const votes = multipleVotes[pollId];
      
      // Guardar el primer voto seleccionado como voto principal
      userVotes[pollId] = votes[0];
      displayVotes[pollId] = votes[0];
      
      // Mostrar efecto visual
      voteEffectStates[pollId] = true;
      setTimeout(() => {
        voteEffectStates[pollId] = false;
      }, 1000);
      
      console.log('[Header] ✅ Votos múltiples confirmados:', votes);
      
      // Enviar cada voto al servidor
      for (const optionKey of votes) {
        await sendVoteToServer(pollId, optionKey);
      }
    }
  }
  
  async function handleClearVote(event: CustomEvent) {
    const { pollId } = event.detail;
    console.log('[Header] 🗑️ Limpiar voto:', { pollId });
    
    try {
      const numericPollId = typeof pollId === 'string' ? parseInt(pollId) : pollId;
      
      // Llamar a la API para eliminar el voto (con autenticación)
      await apiDelete(`/api/polls/${numericPollId}/vote`);
      
      // Actualizar estado local
      delete userVotes[pollId];
      delete displayVotes[pollId];
      delete multipleVotes[pollId];
      
      console.log('[Header] ✅ Voto eliminado correctamente');
    } catch (error) {
      console.error('[Header] Error al eliminar voto:', error);
    }
  }
  
  function handlePublishOption(event: CustomEvent) {
    const { pollId, optionKey, label, color } = event.detail;
    console.log('[Header] 📤 Publicar opción:', { pollId, optionKey, label, color });
    
    // TODO: Enviar nueva opción al servidor
    // Por ahora, solo actualizar localmente
    const pollIndex = userPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
      const optionIndex = userPolls[pollIndex].options.findIndex((o: any) => o.key === optionKey);
      if (optionIndex !== -1) {
        userPolls[pollIndex].options[optionIndex] = {
          ...userPolls[pollIndex].options[optionIndex],
          label,
          color,
          isEditing: false
        };
        console.log('[Header] ✅ Opción publicada localmente');
      }
    }
  }
  
  function handleCancelEditing(event: CustomEvent) {
    const { pollId, optionKey } = event.detail;
    console.log('[Header] ❌ Cancelar edición:', { pollId, optionKey });
    
    // Eliminar opción temporal
    const pollIndex = userPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
      userPolls[pollIndex].options = userPolls[pollIndex].options.filter((o: any) => o.key !== optionKey);
      console.log('[Header] ✅ Opción temporal eliminada');
    }
  }
  
  function handleOpenColorPicker(event: CustomEvent) {
    console.log('[Header] 🎨 Abrir selector de color:', event.detail);
    // TODO: Implementar selector de color
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

<!-- Contenedor de encuestas sin modal -->
{#if selectedUser}
	<div class="polls-fullscreen-container">
		<!-- Barra de avatares superior con scroll horizontal -->
		<div class="top-avatars-bar">
			<div 
				class="modal-avatars-scroll"
				role="region"
				aria-label="Usuarios con actividad"
				onpointerdown={handleAvatarScrollStart}
				onpointermove={handleAvatarScrollMove}
				onpointerup={handleAvatarScrollEnd}
				onpointerleave={handleAvatarScrollEnd}
				ontouchstart={handleAvatarScrollStart}
				ontouchmove={handleAvatarScrollMove}
				ontouchend={handleAvatarScrollEnd}
			>
				<div class="modal-avatars-inner">
					{#each users.filter(u => u?.id) as user (user.id)}
						<button
							class="avatar-small-btn {selectedUser?.id === user.id ? 'active' : ''}"
							onclick={() => handleAvatarClick(user)}
							aria-label={user.name || 'Usuario'}
						>
							<img 
								src={user.avatar || '/default-avatar.png'} 
								alt={user.name || 'Usuario'}
								style="width: 100%; height: 100%; object-fit: cover; border-radius: 999px;"
							/>
						</button>
					{/each}
				</div>
			</div>
		</div>
		
		<button class="close-polls-btn" onclick={closeModal} aria-label="Cerrar encuestas">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
		
		{#if isLoadingPolls}
			<div class="loading-spinner">
				<div class="spinner-circle"></div>
			</div>
		{:else if userPolls.length > 0}
			<!-- Indicadores de progreso tipo Instagram -->
			<div class="progress-indicators">
				{#each userPolls as poll, index (poll.id)}
					<button 
						class="progress-bar {index === currentPollIndex ? 'active' : ''}"
						onclick={() => goToPoll(index)}
						aria-label="Ir a encuesta {index + 1}"
					></button>
				{/each}
			</div>
			
			<!-- Contenedor con la encuesta actual -->
			<div class="polls-carousel">
				{#if userPolls[currentPollIndex]}
					{@const currentPoll = userPolls[currentPollIndex]}
					<div class="poll-card-wrapper active {transitionDirection === 'next' ? 'slide-next' : transitionDirection === 'prev' ? 'slide-prev' : ''}">
						<!-- Indicador de usuario (rell o publicación normal) -->
						{#if currentPoll.isRell && currentPoll.originalPoll}
							<!-- Rell: mostrar "X republicó de Y" -->
							<div class="post-indicator-instagram">
								<div class="post-avatar-container">
									<img 
										class="post-small-avatar" 
										src={currentPoll.user?.avatarUrl || '/default-avatar.png'} 
										alt={currentPoll.user?.displayName || 'Usuario'}
									/>
									<div class="rell-icon-badge">
										<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
											<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
										</svg>
									</div>
								</div>
								<div class="post-text">
									<span class="post-user-name">{currentPoll.user?.displayName || currentPoll.user?.username || 'Usuario'}</span>
									<span class="post-label">republicó de</span>
									<span class="post-original-user">{currentPoll.originalPoll.user?.displayName || 'Usuario'}</span>
								</div>
							</div>
						{:else}
							<!-- Publicación normal: mostrar "X publicó" -->
							<div class="post-indicator-instagram">
								<div class="post-avatar-container">
									<img 
										class="post-small-avatar" 
										src={currentPoll.user?.avatarUrl || '/default-avatar.png'} 
										alt={currentPoll.user?.displayName || 'Usuario'}
									/>
								</div>
								<div class="post-text">
									<span class="post-user-name">{currentPoll.user?.displayName || currentPoll.user?.username || 'Usuario'}</span>
									<span class="post-label">publicó</span>
								</div>
							</div>
						{/if}
						
						<SinglePollSection
							poll={currentPoll}
							pollIndex={currentPollIndex}
							state={pollStates[currentPoll.id] || 'expanded'}
							activeAccordionIndex={activeAccordions[currentPoll.id] ?? 0}
							currentPage={currentPages[currentPoll.id] || 0}
							{userVotes}
							{multipleVotes}
							{displayVotes}
							{pollTitleExpanded}
							{pollTitleTruncated}
							{pollTitleElements}
							voteEffectActive={voteEffectStates[currentPoll.id] || false}
							voteEffectPollId={null}
							voteClickX={0}
							voteClickY={0}
							voteIconX={0}
							voteIconY={0}
							voteEffectColor="#10b981"
							bind:isProfileModalOpen={isProfileModalOpen}
							bind:selectedProfileUserId={selectedProfileUserId}
							on:setActive={handleSetActive}
							on:optionClick={handleOptionClick}
							on:openInGlobe={handleOpenInGlobe}
							on:pageChange={handlePageChange}
							on:addOption={handleAddOption}
							on:confirmMultiple={handleConfirmMultiple}
							on:clearVote={handleClearVote}
							on:publishOption={handlePublishOption}
							on:cancelEditing={handleCancelEditing}
							on:openColorPicker={handleOpenColorPicker}
							on:dragStart={handleCardDragStart}
						/>
					</div>
				{/if}
			</div>
			
			<!-- Área de navegación inferior -->
			<div 
				class="nav-area-bottom"
				role="navigation"
				aria-label="Controles de navegación"
				onpointerdown={handleSwipeStart}
				onpointermove={handleSwipeMove}
				onpointerup={handleSwipeEnd}
				onpointerleave={handleSwipeEnd}
				ontouchstart={handleSwipeStart}
				ontouchmove={handleSwipeMove}
				ontouchend={handleSwipeEnd}
			>
				<button 
					class="nav-btn-bottom nav-prev" 
					onclick={() => {
						if (currentPollIndex > 0) prevPoll();
						else prevUser();
					}}
					disabled={users.findIndex(u => u.id === selectedUser?.id) === 0 && currentPollIndex === 0}
					aria-label="Anterior"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M15 18l-6-6 6-6"/>
					</svg>
				</button>
				
				<div class="swipe-hint">
					← Desliza para navegar →
				</div>
				
				<button 
					class="nav-btn-bottom nav-next" 
					onclick={() => {
						if (currentPollIndex < userPolls.length - 1) nextPoll();
						else nextUser();
					}}
					disabled={users.findIndex(u => u.id === selectedUser?.id) === users.length - 1 && currentPollIndex === userPolls.length - 1}
					aria-label="Siguiente"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 18l6-6-6-6"/>
					</svg>
				</button>
			</div>
		{:else}
			<div class="no-polls-message">
				Este usuario aún no ha publicado encuestas
			</div>
		{/if}
	</div>
{/if}


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
	
	/* Contenedor fullscreen para encuestas */
	.polls-fullscreen-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
		z-index: 999999;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 80px 0 120px;
		animation: fadeIn 0.2s ease;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		pointer-events: auto;
	}
	
	/* Barra de avatares superior */
	.top-avatars-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 53px;
		height: 70px;
		background: linear-gradient(280deg, rgba(10, 10, 15, 0.98) 0%, rgba(10, 10, 15, 0) 100%);
		backdrop-filter: blur(10px);
		z-index: 1000002;
		display: flex
	;
		align-items: center;
		justify-content: flex-end;
		padding: 0px 6px 1px 4px;
		pointer-events: auto;
		padding-right: 11px;
		touch-action: pan-x pan-y;
	}
	
	/* Gradiente de difuminado izquierdo */
	.top-avatars-bar::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 30px;
		height: 100%;
		background: linear-gradient(90deg, rgba(10, 10, 15, 0.98) 0%, transparent 100%);
		pointer-events: none;
		z-index: 1;
	}
	
	/* Gradiente de difuminado derecho (entre avatares y X) */
	.top-avatars-bar::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 40px;
		height: 100%;
		background: linear-gradient(90deg, transparent 0%, rgba(10, 10, 15, 0.98) 100%);
		pointer-events: none;
		z-index: 1;
	}

	.close-polls-btn {
		position: fixed;
		top: 18px;
		right: 16px;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 1000003;
	}

	.close-polls-btn:hover {
		background: rgba(0, 0, 0, 0.6);
		transform: scale(1.05);
	}

	.close-polls-btn:active {
		transform: scale(0.95);
	}

	/* Indicadores de progreso tipo Instagram */
	.progress-indicators {
		position: fixed;
		top: 70px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 4px;
		z-index: 999999;
		max-width: 700px;
		width: calc(100% - 40px);
		padding: 0 20px;
	}
	
	.progress-bar {
		flex: 1;
		height: 3px;
		background: rgba(255, 255, 255, 0.3);
		border: none;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.3s ease;
		padding: 0;
	}
	
	.progress-bar.active {
		background: white;
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
	}
	
	.progress-bar:hover:not(.active) {
		background: rgba(255, 255, 255, 0.5);
	}
	
	/* Carrusel */
	.polls-carousel {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 700px;
		width: 100%;
		position: relative;
		pointer-events: auto;
		touch-action: auto;
	}
	
	/* Área de navegación inferior con swipe */
	.nav-area-bottom {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		max-width: 700px;
		width: calc(100% - 40px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 16px 24px;
		background: rgba(20, 20, 30, 0.95);
		backdrop-filter: blur(20px);
		border-radius: 50px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		z-index: 1000001;
		cursor: grab;
		user-select: none;
		touch-action: pan-x;
		pointer-events: auto;
	}
	
	.nav-area-bottom:active {
		cursor: grabbing;
	}
	
	.swipe-hint {
		flex: 1;
		text-align: center;
		color: rgba(255, 255, 255, 0.5);
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.5px;
		pointer-events: none;
	}
	
	/* Botones de navegación inferior */
	.nav-btn-bottom {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
		flex-shrink: 0;
	}
	
	.nav-btn-bottom:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.1);
	}
	
	.nav-btn-bottom:active:not(:disabled) {
		transform: scale(0.95);
	}
	
	.nav-btn-bottom:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	
	/* Responsive para móviles */
	@media (max-width: 768px) {
		.nav-area-bottom {
			bottom: 10px;
			width: calc(100% - 24px);
			padding: 12px 16px;
		}
		
		.nav-btn-bottom {
			width: 40px;
			height: 40px;
		}
		
		.swipe-hint {
			font-size: 11px;
		}
	}
	
	/* Wrapper para cada poll - sin bordes, máximo espacio */
	.poll-card-wrapper {
		background: transparent;
		border: none;
		overflow: visible;
		transition: none;
		pointer-events: auto;
		touch-action: auto;
	}
	
	/* Indicador de publicación estilo Instagram */
	.post-indicator-instagram {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		background: transparent;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	
	.post-avatar-container {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}
	
	.post-small-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid rgba(255, 255, 255, 0.2);
	}
	
	.rell-icon-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		background: #0095f6;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid rgba(30, 30, 40, 0.95);
	}
	
	.rell-icon-badge svg {
		width: 8px;
		height: 8px;
		color: white;
	}
	
	.post-text {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		font-size: 15px;
		line-height: 1.3;
		overflow: hidden;
	}
	
	.post-user-name {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
		flex-shrink: 0;
	}
	
	.post-label {
		color: rgba(255, 255, 255, 0.5);
		font-weight: 400;
		flex-shrink: 0;
	}
	
	.post-original-user {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.loading-spinner {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 60px 20px;
		max-width: 700px;
		width: 100%;
	}
	
	.spinner-circle {
		width: 48px;
		height: 48px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: rgba(255, 255, 255, 0.8);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	
	.no-polls-message {
		text-align: center;
		color: rgba(255, 255, 255, 0.5);
		padding: 40px 20px;
		font-size: 14px;
		font-style: italic;
		max-width: 700px;
		width: 100%;
	}
	
	/* Ajustes para polls - permitir funcionamiento normal */
	.poll-card-wrapper :global(.poll-item) {
		background: transparent !important;
		border: none !important;
		padding: 8px !important;
		margin: 0 !important;
		pointer-events: auto !important;
		touch-action: auto !important;
	}
	
	.poll-card-wrapper :global(.poll-header) {
		margin-bottom: 8px;
	}
	
	.poll-card-wrapper :global(.vote-cards-grid) {
		gap: 8px;
		margin-top: 8px;
		/* NO forzar padding que pueda interferir con el drag */
	}
	
	.poll-card-wrapper :global(.vote-card) {
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		cursor: grab;
		touch-action: pan-x pan-y !important;
		user-select: none;
		-webkit-user-drag: none;
	}
	
	.poll-card-wrapper :global(.vote-card:active) {
		cursor: grabbing;
	}
	
	.poll-card-wrapper :global(.vote-cards-grid) {
		touch-action: pan-x pan-y !important;
		user-select: none;
	}
	
	.poll-card-wrapper :global(.bottom-controls-container),
	.poll-card-wrapper :global(.vote-summary-info) {
		margin-top: 8px;
		padding: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	
	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	
	@keyframes slideInNext {
		from {
			opacity: 0;
			transform: translateX(100px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	
	@keyframes slideInPrev {
		from {
			opacity: 0;
			transform: translateX(-100px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	
	.poll-card-wrapper.slide-next {
		animation: slideInNext 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	.poll-card-wrapper.slide-prev {
		animation: slideInPrev 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	.poll-card-wrapper.active {
		opacity: 1;
		transform: scale(1);
	}
</style>

<!-- Modal de perfil movida a +page.svelte para que esté al nivel superior -->
