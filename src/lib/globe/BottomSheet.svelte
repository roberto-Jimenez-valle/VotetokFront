<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import '$lib/styles/trending-ranking.css';
  import '$lib/styles/bottom-sheet.css'; // ✅ Ya está importado aquí globalmente
  import type { Poll } from './types';
  import { currentUser } from '$lib/stores';
  import { apiGet, apiCall, apiPost, apiDelete } from '$lib/api/client';
  
  // Componentes de sección completos
  import TrendingPollsSection from './cards/sections/TrendingPollsSection.svelte';
  import SinglePollSection from './cards/sections/SinglePollSection.svelte';
  import WhoToFollowSection from './cards/sections/WhoToFollowSection.svelte';
  import AdCard from './cards/sections/AdCard.svelte';
  import PollMaximizedView from '$lib/components/PollMaximizedView.svelte';
  import AuthModal from '$lib/AuthModal.svelte';

  // Helper para reemplazar setTimeout con Promesas
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const nextTick = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
  
  // Avatar por defecto como data URI para evitar 404
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  
  // Estado de acordeón full-width (sin scroll): índice activo por grid
  let activeAccordionMainIndex: number | null = null;
  let activeAccordionByPoll: Record<string, number | null> = {};
  let lastMainOptionsSignature = '';
  const pollOptionSignatures: Record<string, string> = {};
  
  // Estado de votos del usuario: Record<pollId, optionKey>
  let userVotes: Record<string, string> = {};
  
  // Estado para votación múltiple: Record<pollId, optionKey[]>
  let multipleVotes: Record<string, string[]> = {};
  
  // Estado para añadir nueva opción en encuestas colaborativas
  let showAddOptionModal: Record<string, boolean> = {};
  let newOptionLabel: Record<string, string> = {};
  
  // Estado para opciones colaborativas en edición
  let pendingCollaborativeOption: Record<string, string | null> = {}; // pollId -> tempId de la opción en edición
  let editingOptionColors: Record<string, string> = {}; // tempId -> color seleccionado
  
  // Coordenadas del último click para la animación
  let voteClickX = 0;
  let voteClickY = 0;
  let voteIconX = 0;
  let voteIconY = 0;
  let voteIconElement: HTMLElement | null = null;
  
  // Votos visibles en el UI (con retraso para la animación)
  let displayVotes: Record<string, string> = {};
  
  // Estado para efectos de votación
  let voteEffectActive = false;
  let voteEffectPollId: string | null = null;
  let voteEffectColor: string = '#10b981'; // Color de la opción votada para la animación
  
  // Estado de expansión de títulos de encuestas
  const pollTitleExpanded: Record<string, boolean> = {};
  const pollTitleTruncated: Record<string, boolean> = {};
  const pollTitleElements: Record<string, HTMLElement> = {};
  
  // Estado del color picker para opciones colaborativas
  let colorPickerOpenFor: { pollId: string; optionKey: string } | null = null;
  let selectedHue = 0;
  let selectedSaturation = 85;
  let isDraggingColor = false;
  
  // Estado del modal de autenticación
  let showAuthModal = $state(false);
  let pendingVoteData: { optionKey: string; pollId?: string } | null = null;
  
  // Función para verificar si un elemento está truncado
  function checkTruncation(element: HTMLElement | undefined): boolean {
    if (!element) return false;
    return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
  }
  
  // Estado de paginación para encuestas con >4 opciones
  const OPTIONS_PER_PAGE = 4;
  let currentPageMain = 0;
  let currentPageByPoll: Record<string, number> = {};
  
  // Estado de transición para animaciones
  let transitionDirectionMain: 'next' | 'prev' | null = null;
  let transitionDirectionByPoll: Record<string, 'next' | 'prev' | null> = {};

  // Helper para formato de tiempo relativo
  function getRelativeTime(minutesAgo: number): string {
    if (minutesAgo < 60) return `${minutesAgo}min`;
    if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h`;
    if (minutesAgo < 43200) return `${Math.floor(minutesAgo / 1440)}d`;
    return `${Math.floor(minutesAgo / 525600)}a`;
  }

  // Helper para formatear números con k, M
  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  }

  // Helper para calcular tiempo restante de una encuesta
  function getTimeRemaining(closedAt: Date | string | null | undefined): string {
    if (!closedAt) return '';
    
    const now = Date.now();
    const end = new Date(closedAt).getTime();
    const diff = end - now;
    
    if (diff <= 0) return 'Cerrada';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Helper para obtener color del indicador de tiempo
  function getTimeRemainingColor(closedAt: Date | string | null | undefined): 'red' | 'yellow' | 'green' | 'gray' {
    if (!closedAt) return 'gray';
    
    const diff = new Date(closedAt).getTime() - Date.now();
    const hours = diff / (1000 * 60 * 60);
    
    if (hours <= 0) return 'gray'; // Cerrada
    if (hours <= 1) return 'red';
    if (hours <= 6) return 'yellow';
    return 'green';
  }

  // Helper para calcular porcentaje de tiempo transcurrido
  function getTimeProgress(closedAt: Date | string | null | undefined, createdAt?: Date | string | null): number {
    if (!closedAt) return 0;
    
    const now = Date.now();
    const end = new Date(closedAt).getTime();
    const start = createdAt ? new Date(createdAt).getTime() : end - (7 * 24 * 60 * 60 * 1000); // 7 días por defecto
    
    if (now >= end) return 100; // Completado
    if (now <= start) return 0; // No ha empezado
    
    const total = end - start;
    const elapsed = now - start;
    
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  // Helper para verificar si una encuesta está expirada
  function isPollExpired(closedAt: Date | string | null | undefined): boolean {
    if (!closedAt) return false;
    return new Date(closedAt).getTime() <= Date.now();
  }

  // Helper para verificar si una encuesta puede recibir votos
  function canVoteOnPoll(poll: any): boolean {
    if (!poll) return false;
    if (poll.status !== 'active') return false;
    if (isPollExpired(poll.closedAt)) return false;
    return true;
  }

  // Actualizar tiempos cada minuto
  let timeUpdateInterval: number | undefined;
  
  onMount(() => {
    // Actualizar cada 60 segundos
    timeUpdateInterval = setInterval(() => {
      // Forzar re-render para actualizar contadores
      if (trendingPollsData.length > 0) {
        trendingPollsData = [...trendingPollsData];
      }
      if (additionalPolls.length > 0) {
        additionalPolls = [...additionalPolls];
      }
      if (activePoll) {
        activePoll = { ...activePoll };
      }
    }, 60000) as unknown as number;
    
    return () => {
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
    };
  });

  // Helper para cargar datos históricos desde API
  async function loadHistoricalData(pollId: number, days: number) {
    try {
      const { data } = await apiGet('/api/polls/' + pollId + '/history?days=' + days);
      return data.map((item: any) => ({
        x: new Date(item.recordedAt).getTime(),
        y: item.percentage,
        votes: item.voteCount,
      }));
    } catch (error) {
      return [];
    }
  }

  // Generar datos históricos simulados para visualización
  function generateHistoricalData(days: number, currentPct?: number): Array<{x: number, y: number, votes: number}> {
    const dataPoints = Math.min(days, 100); // Máximo 100 puntos
    const now = Date.now();
    const interval = (days * 24 * 60 * 60 * 1000) / dataPoints;
    const basePct = currentPct || 50;
    
    return Array.from({ length: dataPoints }, (_, i) => {
      const variation = (Math.random() - 0.5) * 10; // Variación de ±5%
      const trend = (i / dataPoints) * 5; // Tendencia suave
      return {
        x: now - (dataPoints - i) * interval,
        y: Math.max(0, Math.min(100, basePct + variation + trend)),
        votes: Math.floor(Math.random() * 1000) + 100
      };
    });
  }

  // Cargar sugerencias de usuarios desde la API
  let userSuggestions: Array<{
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string;
    verified: boolean;
  }> = [];

  async function loadUserSuggestions() {
    try {
      const { data } = await apiGet('/api/users/suggestions?limit=8');
      userSuggestions = data;
    } catch (error) {
      console.error('Error loading user suggestions:', error);
      userSuggestions = [];
    }
  }

  // Estado de paginación para scroll infinito
  let currentPollsPage = 1;
  let isLoadingPolls = false;
  let hasMorePolls = true;

  // Guardar referencia a las encuestas trending completas
  let trendingPollsData: any[] = [];

  // Cargar trending polls para mostrar cuando NO hay encuesta activa
  async function loadMainPoll() {
    // Check if we're in the browser (not SSR)
    if (typeof window === 'undefined') {
      return;
    }
    
    // Si hay encuesta activa, no cargar trending (GlobeGL lo maneja)
    if (activePoll && activePoll.id) {
      trendingPollsData = [];
      return;
    }
    
    try {
      const currentRegion = selectedCountryName || selectedSubdivisionName || selectedCityName || 'Global';
      
      // Limitar a 12 encuestas trending (3 páginas de 4)
      const { data } = await apiGet(`/api/polls/trending-by-region?region=${encodeURIComponent(currentRegion)}&limit=12&hours=168`);
      
      if (data && Array.isArray(data) && data.length > 0) {
        // Contar duplicados ANTES de filtrar
        const allIds = data.map((p: any) => p.id);
        const uniqueIdSet = new Set(allIds);
        const duplicatesCount = allIds.length - uniqueIdSet.size;
        
        if (duplicatesCount > 0) {
          // Mostrar cuáles IDs están duplicados
          const duplicatedIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
        }
        
        // Filtrar duplicados por ID y ordenar por trendingScore
        const uniquePolls = data
          .filter((poll: any, index: number, self: any[]) => 
            index === self.findIndex((p: any) => p.id === poll.id)
          )
          .sort((a: any, b: any) => (b.trendingScore || b.totalVotes || 0) - (a.trendingScore || a.totalVotes || 0));
        
        trendingPollsData = uniquePolls;
      } else {
        trendingPollsData = [];
      }
    } catch (error) {
      console.error('[BottomSheet] Error loading trending polls:', error);
      trendingPollsData = [];
    }
  }

  // Cargar polls adicionales desde la API
  async function loadAdditionalPolls(page: number = 1) {
    // Evitar cargas duplicadas
    if (isLoadingPolls || !hasMorePolls) return;
    
    isLoadingPolls = true;
    
    try {
      const { data, pagination } = await apiGet('/api/polls?page=' + page + '&limit=10');
      
      // Verificar si hay más páginas
      hasMorePolls = pagination.page < pagination.totalPages;
      
      // Transformar datos de la API al formato esperado
      const transformedPolls: Poll[] = await Promise.all(data.map(async (poll: any) => {
                
        // Cargar amigos que votaron en esta encuesta (opcional)
        let friendsByOption = {};
        try {
          // Solo intentar cargar si el usuario está autenticado
          if (currentUserId) {
            const friendsData = await apiGet('/api/polls/' + poll.id + '/friends-votes?userId=' + currentUserId);
            friendsByOption = friendsData.data || {};
          }
        } catch (e) {
          // Silenciar error - no es crítico si falla
          console.debug('Friends votes not available for poll', poll.id);
        }

        const transformed = {
          id: poll.id.toString(),
          question: poll.title,
          type: poll.type || 'poll',
          region: selectedCountryName || selectedSubdivisionName || selectedCityName || 'Global',
          options: poll.options.map((opt: any, optIdx: number) => ({
            id: opt.id,
            key: opt.optionKey || opt.id?.toString() || `opt-${poll.id}-${optIdx}`,
            label: opt.optionLabel || opt.label || `Opción ${optIdx + 1}`,
            color: opt.color || ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'][optIdx % 4],
            votes: opt._count?.votes || 0,  // Auto-calculado desde votos
            avatarUrl: opt.createdBy?.avatarUrl || poll.user?.avatarUrl,  // Desde relación User
            imageUrl: opt.imageUrl  // URL de preview (imagen/video/link)
          })),
          totalVotes: poll._count?.votes || 0,  // Auto-calculado desde votos
          totalViews: 0,  // Campo legacy - no se usa
          user: poll.user ? {
            id: poll.user.id,
            displayName: poll.user.displayName,
            username: poll.user.username,
            avatarUrl: poll.user.avatarUrl,
            verified: poll.user.verified
          } : undefined,
          creator: poll.user ? {
            id: poll.user.id.toString(),
            name: poll.user.displayName,
            handle: poll.user.username,
            avatarUrl: poll.user.avatarUrl,
            verified: poll.user.verified
          } : undefined,
          publishedAt: poll.createdAt,
          friendsByOption: friendsByOption
        };
        
                return transformed;
      }));
      
      // Agregar polls FILTRANDO DUPLICADOS para evitar error "each_key_duplicate"
      const allPolls = [...additionalPolls, ...transformedPolls];
      
      // Filtrar duplicados por ID (mantener solo la primera ocurrencia)
      const uniquePolls = allPolls.filter((poll, index, self) => 
        index === self.findIndex((p) => p.id === poll.id)
      );
      
      additionalPolls = uniquePolls;
      currentPollsPage = page;
      
    } catch (error) {
      console.error('Error loading additional polls:', error);
    } finally {
      isLoadingPolls = false;
    }
  }

  // Estado para el rango temporal seleccionado
  let selectedTimeRange = '1m';
  const timeRanges = [
    { id: '1d', label: '1D', days: 1 },
    { id: '5d', label: '5D', days: 5 },
    { id: '1m', label: '1M', days: 30 },
    { id: '6m', label: '6M', days: 180 },
    { id: '1y', label: '1A', days: 365 },
    { id: '5y', label: '5A', days: 1825 }
  ];

  $: historicalData = generateHistoricalData(
    timeRanges.find(r => r.id === selectedTimeRange)?.days || 30
  );

  // Estado para interactividad del gráfico
  let chartHoverData: {x: number, y: number, votes: number, date: Date} | null = null;
  let isHoveringChart = false;
  
  // Estado para selección brush del gráfico
  let chartBrushStart: number | null = null;
  let chartBrushCurrent: number | null = null;
  let isBrushing = false;
  
  // Estado para vista de gráfico por encuesta (como página -1)
  let chartViewByPoll: Record<string, boolean> = {};
  
  // Navegar a vista de gráfico (página -1)
  function goToChartView(pollId: string) {
    transitionDirectionByPoll[pollId] = 'prev';
    currentPageByPoll[pollId] = -1;
    activeAccordionByPoll[pollId] = null;
  }
  
  // Volver desde vista de gráfico
  function exitChartView(pollId: string) {
    transitionDirectionByPoll[pollId] = 'next';
    currentPageByPoll[pollId] = 0;
    activeAccordionByPoll[pollId] = null; // Empezar plegadas
  }

  // Helper para manejar hover en el gráfico
  function handleChartMouseMove(event: MouseEvent, chartElement: SVGElement) {
    const rect = chartElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const relativeX = x / rect.width;
    
    if (relativeX < 0 || relativeX > 1) {
      chartHoverData = null;
      return;
    }
    
    const dataIndex = Math.round(relativeX * (historicalData.length - 1));
    const dataPoint = historicalData[dataIndex];
    
    if (dataPoint) {
      chartHoverData = {
        x: relativeX * 300,
        y: dataPoint.y,
        votes: dataPoint.votes,
        date: new Date(dataPoint.x)
      };
      isHoveringChart = true;
    }
  }

  function handleChartMouseLeave() {
    if (!isBrushing) {
      chartHoverData = null;
      isHoveringChart = false;
    }
  }

  // Helper para manejar inicio de brush (touch/mouse)
  function handleChartBrushStart(event: MouseEvent | TouchEvent, chartElement: SVGElement) {
    event.preventDefault();
    const rect = chartElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = clientX - rect.left;
    const relativeX = x / rect.width;
    
    if (relativeX >= 0 && relativeX <= 1) {
      isBrushing = true;
      chartBrushStart = relativeX * 300;
      chartBrushCurrent = relativeX * 300;
      
      // Actualizar datos del hover
      const dataIndex = Math.round(relativeX * (historicalData.length - 1));
      const dataPoint = historicalData[dataIndex];
      if (dataPoint) {
        chartHoverData = {
          x: relativeX * 300,
          y: dataPoint.y,
          votes: dataPoint.votes,
          date: new Date(dataPoint.x)
        };
      }
    }
  }

  // Helper para manejar movimiento de brush
  function handleChartBrushMove(event: MouseEvent | TouchEvent, chartElement: SVGElement) {
    if (!isBrushing) return;
    
    event.preventDefault();
    const rect = chartElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = clientX - rect.left;
    const relativeX = x / rect.width;
    
    if (relativeX >= 0 && relativeX <= 1) {
      chartBrushCurrent = relativeX * 300;
      
      // Actualizar datos del hover
      const dataIndex = Math.round(relativeX * (historicalData.length - 1));
      const dataPoint = historicalData[dataIndex];
      if (dataPoint) {
        chartHoverData = {
          x: relativeX * 300,
          y: dataPoint.y,
          votes: dataPoint.votes,
          date: new Date(dataPoint.x)
        };
      }
    }
  }

  // Helper para manejar fin de brush
  function handleChartBrushEnd() {
    isBrushing = false;
    chartBrushStart = null;
    chartBrushCurrent = null;
    chartHoverData = null;
  }

  // Helper para formatear fecha según rango
  function formatChartDate(date: Date, rangeId: string): string {
    if (rangeId === '1d') {
      // 1D: mostrar hora
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (rangeId === '5d') {
      // 5D: mostrar día y mes
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } else if (rangeId === '1m') {
      // 1M: mostrar día y mes
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } else if (rangeId === '6m') {
      // 6M: mostrar mes
      return date.toLocaleDateString('es-ES', { month: 'short' });
    } else if (rangeId === '1y') {
      // 1A: mostrar mes y año
      return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    } else {
      // 5A: mostrar año
      return date.toLocaleDateString('es-ES', { year: 'numeric' });
    }
  }

  // Helper para crear path del gráfico SVG
  function createChartPath(data: {x: number, y: number}[], width: number, height: number): string {
    if (data.length === 0) return '';
    
    const minY = Math.min(...data.map(d => d.y));
    const maxY = Math.max(...data.map(d => d.y));
    const rangeY = maxY - minY || 1;
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.y - minY) / rangeY) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }

  async function setActiveMain(i: number) {
    activeAccordionMainIndex = i;
    // Scroll a la card activa en grids con clase dense
    await nextTick();
    if (mainGridRef && mainGridRef.classList.contains('dense')) {
      scrollToActiveCard(mainGridRef, i);
    }
  }
  
  async function nextPageMain() {
    transitionDirectionMain = 'next';
    currentPageMain += 1;
    activeAccordionMainIndex = null;
    await delay(400);
    transitionDirectionMain = null;
  }
  
  async function prevPageMain() {
    if (currentPageMain > 0) {
      transitionDirectionMain = 'prev';
      currentPageMain -= 1;
      // Abrir la última opción de la página anterior
      await delay(50);
      const newPageOptions = getPaginatedOptions(sortedDisplayOptions, currentPageMain);
      activeAccordionMainIndex = newPageOptions.items.length - 1;
      await delay(350);
      transitionDirectionMain = null;
    }
  }
  async function setActiveForPoll(pollId: string, i: number) {
    activeAccordionByPoll[pollId] = i;
    // Scroll a la card activa en grids con clase dense
    await nextTick();
    const gridRef = pollGridRefs[pollId];
    if (gridRef && gridRef.classList.contains('dense')) {
      scrollToActiveCard(gridRef, i);
    }
  }
  
  async function nextPageForPoll(pollId: string) {
    const current = currentPageByPoll[pollId] || 0;
    transitionDirectionByPoll[pollId] = 'next';
    currentPageByPoll = { ...currentPageByPoll, [pollId]: current + 1 };
    activeAccordionByPoll[pollId] = null;
    await delay(400);
    transitionDirectionByPoll[pollId] = null;
  }
  
  async function prevPageForPoll(pollId: string) {
    const current = currentPageByPoll[pollId] || 0;
    if (current > 0) {
      transitionDirectionByPoll[pollId] = 'prev';
      currentPageByPoll = { ...currentPageByPoll, [pollId]: current - 1 };
      // Abrir la última opción de la página anterior
      await delay(50);
      const poll = additionalPolls.find(p => p.id === pollId);
      if (poll) {
        const sortedOptions = getNormalizedOptions(poll).sort((a, b) => b.pct - a.pct);
        const newPageOptions = getPaginatedOptions(sortedOptions, currentPageByPoll[pollId] || 0);
        activeAccordionByPoll[pollId] = newPageOptions.items.length - 1;
      }
      await delay(350);
      transitionDirectionByPoll[pollId] = null;
    }
  }
  
  function getPaginatedOptions<T>(options: T[], page: number, perPage: number = OPTIONS_PER_PAGE): { items: T[], totalPages: number, hasNext: boolean, hasPrev: boolean } {
    // Si hay 4 o menos opciones, mostrar todas en una sola página
    if (options.length <= perPage) {
      return {
        items: options,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      };
    }
    
    const totalPages = Math.ceil(options.length / perPage);
    const start = page * perPage;
    const end = Math.min(start + perPage, options.length);
    
    const items = options.slice(start, end);
    
    
    return {
      items,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0
    };
  }
  
  // FunciÃ³n para hacer scroll a la card activa y centrarla
  function scrollToActiveCard(grid: HTMLElement, cardIndex: number) {
    const cards = grid.querySelectorAll('.vote-card');
    const activeCard = cards[cardIndex] as HTMLElement;
    
    if (!activeCard) return;
    
    // Calcular la posición para centrar la card expandida
    const gridRect = grid.getBoundingClientRect();
    const cardRect = activeCard.getBoundingClientRect();
    
    // Scroll para que la card quede centrada o al inicio si es necesario
    const scrollLeft = activeCard.offsetLeft - (gridRect.width / 2) + (cardRect.width / 2);
    
    grid.scrollTo({
      left: Math.max(0, scrollLeft),
      behavior: 'smooth'
    });
  }
  
  // Referencias a los grids para scroll horizontal
  let mainGridRef: HTMLElement | undefined;
  let trendingGridRef: HTMLElement | undefined;
  const pollGridRefs: Record<string, HTMLElement> = {};
  
  // Variables para detectar gestos de arrastre horizontal
  let touchStartX = 0;
  let touchStartY = 0;
  let isDragging = false;
  let currentDragGrid: HTMLElement | null = null;
  let currentDragPollId: string | null = null;
  
  // Función para manejar inicio de arrastre/touch
  function handleDragStart(e: PointerEvent | TouchEvent, pollId?: string) {
    // Solo permitir arrastre en dispositivos táctiles
    if (e.type === 'pointerdown' && (e as PointerEvent).pointerType === 'mouse') {
      return; // Ignorar eventos de mouse en ordenador
    }
    
    // No permitir arrastre en grids con muchas opciones (dense) - usan scroll nativo
    const grid = e.currentTarget as HTMLElement;
    if (grid && grid.classList.contains('dense')) {
      return; // Ignorar arrastre en grids con scroll horizontal
    }
    
    const touch = 'touches' in e ? e.touches[0] : e;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isDragging = false;
    // Usar el currentTarget del evento
    currentDragGrid = grid;
    currentDragPollId = pollId || null;
    
      }
  
  // Función para manejar movimiento de arrastre/touch
  function handleDragMove(e: PointerEvent | TouchEvent) {
    if (!currentDragGrid) return;
    
    const touch = 'touches' in e ? e.touches[0] : e;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // SI el movimiento es más VERTICAL que horizontal, NO interferir (permitir scroll)
    if (absDeltaY > absDeltaX) {
      return; // Es scroll vertical, no drag horizontal
    }
    
    // Detectar si es un movimiento horizontal (más horizontal que vertical)
    if (absDeltaX > absDeltaY && absDeltaX > 20) {
      isDragging = true;
      
      // NO prevenir default, confiar en touch-action CSS
      
      // Determinar dirección y expandir siguiente/anterior card
      let currentIndex: number | null = null;
      
      if (currentDragPollId) {
        // Para encuestas adicionales, verificar si existe en el objeto
        currentIndex = activeAccordionByPoll[currentDragPollId] ?? null;
      } else {
        // Para la encuesta principal
        currentIndex = activeAccordionMainIndex;
      }
      
      const cards = currentDragGrid.querySelectorAll('.vote-card');
      const totalCards = cards.length;
      
      const dragInfo = { 
        pollId: currentDragPollId, 
        currentIndex, 
        deltaX, 
        totalCards,
        activeAccordionByPoll: currentDragPollId ? activeAccordionByPoll[currentDragPollId] : 'N/A'
      };
      
      // Si no hay ninguna activa (null o undefined), activar la primera o última según dirección
      if ((currentIndex === null || currentIndex === undefined) && totalCards > 0) {
        if (deltaX < 0) {
          // Arrastre hacia la izquierda -> activar la primera
          currentIndex = 0;
        } else {
          // Arrastre hacia la derecha -> activar la última
          currentIndex = totalCards - 1;
        }
        
                
        if (currentDragPollId) {
          setActiveForPoll(currentDragPollId, currentIndex);
        } else {
          setActiveMain(currentIndex);
        }
        touchStartX = touch.clientX; // Reset para siguiente detección
        return;
      }
      
      if (deltaX > 50 && currentIndex !== null) {
        if (currentIndex === 0 || currentIndex === null) {
          // Swipe derecho desde primera card o en vista gráfico
          if (currentDragPollId) {
            const currentPage = currentPageByPoll[currentDragPollId] || 0;
            if (currentPage === -1) {
              // En vista gráfico, requiere swipe más largo para salir (evitar conflicto con brush)
              if (Math.abs(deltaX) > 150) {
                exitChartView(currentDragPollId);
                touchStartX = touch.clientX;
              }
            } else if (currentPage === 0) {
              // Primera página, ir a vista gráfico (requiere swipe largo)
              if (Math.abs(deltaX) > 100) {
                goToChartView(currentDragPollId);
                touchStartX = touch.clientX;
              }
            } else {
              // Otra página, ir a anterior
              prevPageForPoll(currentDragPollId);
              touchStartX = touch.clientX;
            }
          } else {
            if (currentPageMain > 0) {
              prevPageMain();
              touchStartX = touch.clientX;
            }
          }
        } else if (currentIndex > 0) {
          // Arrastre hacia la derecha -> card anterior
          if (currentDragPollId) {
            setActiveForPoll(currentDragPollId, currentIndex - 1);
          } else {
            setActiveMain(currentIndex - 1);
          }
          touchStartX = touch.clientX; // Reset para siguiente detección
        }
      } else if (deltaX < -50 && currentIndex !== null) {
        if (currentIndex < totalCards - 1) {
          // Arrastre hacia la izquierda -> card siguiente
          if (currentDragPollId) {
            setActiveForPoll(currentDragPollId, currentIndex + 1);
          } else {
            setActiveMain(currentIndex + 1);
          }
          touchStartX = touch.clientX; // Reset para siguiente detección
        } else if (currentIndex === totalCards - 1) {
          // Estamos en la última card, intentar ir a página siguiente
          if (currentDragPollId) {
            const currentPage = currentPageByPoll[currentDragPollId] || 0;
            // Necesitamos calcular si hay siguiente página
            const poll = additionalPolls.find(p => p.id === currentDragPollId);
            if (poll) {
              const totalOptions = getNormalizedOptions(poll).length;
              const totalPages = Math.ceil(totalOptions / OPTIONS_PER_PAGE);
              if (currentPage < totalPages - 1) {
                nextPageForPoll(currentDragPollId);
                touchStartX = touch.clientX;
              }
            }
          } else {
            const totalPages = voteOptions.length > 0 
              ? Math.ceil(voteOptions.length / OPTIONS_PER_PAGE)
              : Math.ceil(sortedDisplayOptions.length / OPTIONS_PER_PAGE);
            if (currentPageMain < totalPages - 1) {
              nextPageMain();
              touchStartX = touch.clientX;
            }
          }
        }
      }
    }
  }
  
  // Función para manejar fin de arrastre/touch
  function handleDragEnd() {
    isDragging = false;
    currentDragGrid = null;
    currentDragPollId = null;
  }

  // El colapso se maneja con on:click|self en cada grid (sin listener global)

  // Normaliza opciones de una encuesta adicional a porcentajes 0-100
  function getNormalizedOptions(poll: Poll) {
    const opts = poll.options || [];
    const values = opts.map(o => Number(o.votes) || 0);
    const norm = normalizeTo100(values);
    // Mantener misma forma + pct calculado
    return opts.map((o, i) => ({ ...o, pct: norm[i] }));
  }

  // Tamaño de fuente por tramos de porcentaje (en pasos de 10px)
  // Clamp: mínimo 20px, máximo 70px
  function fontSizeForPct(pct: number): number {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const bucket = Math.max(1, Math.ceil(clamped / 10));
    const size = bucket * 10;
    return Math.max(20, Math.min(70, size));
  }

  // Función para obtener el título de una card (ahora usa datos reales del poll)
  function getCardTitle(index: number, context: 'main' | 'additional', pollType?: string, pollTitle?: string): string {
    // Si hay título del poll, usarlo
    if (pollTitle) return pollTitle;
    
    // Fallback genérico
    if (pollType === 'hashtag') return '#Tendencia';
    return 'Encuesta ' + (index + 1);
  }
  
  export let state: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
  export let y = 0; // translateY px
  export let isTransitioning = false; // Si debe usar transición CSS
  export let isCameraAnimating = false; // Si hay una animación de cámara en curso
  // Props de selección manual (para UI, no para votos - ahora usamos geocoding automático)
  export let selectedCountryName: string | null = null;
  export const selectedCountryIso: string | null = null;
  export let selectedSubdivisionName: string | null = null;
  export const selectedSubdivisionId: string | null = null;
  export let selectedCityName: string | null = null;
  export let hasSubdivisions: boolean = true;
  export let countryChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export const subdivisionChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let worldChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let cityChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let voteOptions: Array<{ key: string; label: string; color: string; votes: number; pollData?: any; isEditing?: boolean }> = [];
  export let legendItems: Array<{ key: string; color: string; count: number }> = [];
  export let activePoll: any = null;
  export let updateTrigger: number = 0; // Trigger para forzar actualización
  // Estadísticas de la encuesta principal
  export let mainPollViews: number = 0;
  export const mainPollSaves: number = 0;
  export const mainPollShares: number = 0;
  export const mainPollReposts: number = 0;
  // ID del usuario actual (para cargar amigos que votaron)
  // Usuario por defecto: María González (id: 4) que sigue a 5 usuarios
  export let currentUserId: number = 4;
  // Amigos que han votado por opción (opcional)
  export const friendsByOption: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>> = {};
  // Visitas por opción (opcional)
  export const visitsByOption: Record<string, number> = {};
  // Creador de la publicación por opción (opcional)
  export const creatorsByOption: Record<string, { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean }> = {};
  // Fecha de publicación por opción (opcional)
  export const publishedAtByOption: Record<string, string | Date> = {};

  // Handlers de acciones (opcionales)
  export const onSaveOption: (optionKey: string) => void = () => {};
  export const onShareOption: (optionKey: string) => void = () => {};
  export const onMoreOption: (optionKey: string) => void = () => {};
  export let onPointerDown: (e: PointerEvent | TouchEvent) => void = () => {};
  export let onScroll: (e: Event) => void = () => {};
  export let navigationManager: any = null; // Used by parent component
  export let onNavigateToView: (level: 'world' | 'country' | 'subdivision' | 'city') => void = () => {};
  // onVote eliminado - BottomSheet maneja votos internamente
  export let currentAltitude: number = 0; // Altitud actual del globo
  export let onLocateMe: () => void = () => {};
  
  // Array de encuestas adicionales para scroll infinito
  export let additionalPolls: Poll[] = [];
  export const onLoadMorePolls: () => void = () => {};
  
  // Dropdown toggle function
  export let onToggleDropdown: () => void = () => {};
  
  // Estado del botón "volver al inicio"
  let showScrollToTop = false;
  
  // Modal de preview fullscreen usando PollMaximizedView
  let showPreviewModal = false;
  let previewModalOption: any = null; // Array de opciones transformadas
  let previewModalPoll: any = null;
  let previewModalOptionIndex: string = ''; // ID de la opción activa
  let previewModalPollIndex: number = 0;
  let previewModalShowAllOptions: boolean = false; // Mostrar todas las opciones en vertical
  
  // Auto-hide navigation bar on scroll
  let showNavBar = true;
  let lastScrollTop = 0;
  let scrollThreshold = 50; // Minimum scroll distance to trigger hide/show
  let scrollContainer: HTMLElement;
  
  // Control de visibilidad del nav según estado y desplegables
  $: {
    if (state === 'expanded') {
      // Cuando está expandido, el nav sigue su lógica normal de scroll
      // No forzar ningún valor aquí
    } else if (showPollOptionsExpanded) {
      // Si el desplegable de poll options está abierto y NO está expandido, ocultar nav
      console.log('[BottomSheet] Ocultando nav - desplegable de poll abierto');
      showNavBar = false;
    } else {
      // Si el desplegable está cerrado y NO está expandido, mostrar nav
      console.log('[BottomSheet] Mostrando nav - desplegable cerrado');
      showNavBar = true;
      lastScrollTop = 0;
    }
  }
  
  // Search props
  export let showSearch: boolean = false;
  export let tagQuery: string = '';
  export let onToggleSearch: () => void = () => {};
  
  // Profile modal props
  export let isProfileModalOpen: boolean = false;
  export let selectedProfileUserId: number | null = null;
  
  // Search results for countries/subdivisions
  let searchResults: Array<{ id: string; name: string; iso?: string; type: 'country' | 'subdivision'; parentName?: string | null; parentNameLocal?: string | null; subdivisionId?: string }> = [];
  let isSearching = false;

  // Texto de ayuda bajo los botones: ciudad > subdivisión > país > Global
  $: hintTarget = selectedCityName || selectedSubdivisionName || selectedCountryName || 'Global';

 
  
  // Referencia al input de búsqueda
  let searchInput: HTMLInputElement;
  let previousShowSearch = false;
  
  // Debounce timer for search
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Scroll al final cuando se cierra la búsqueda
  $: if (previousShowSearch && !showSearch && navContainer) {
    (async () => {
      await nextTick();
      navContainer.scrollLeft = navContainer.scrollWidth;
    })();
    previousShowSearch = showSearch;
  } else if (showSearch !== previousShowSearch) {
    previousShowSearch = showSearch;
  }
  
  // Focus en el input cuando se abre la búsqueda, sin hacer scroll
  $: if (showSearch && searchInput) {
    (async () => {
      await nextTick();
      searchInput?.focus({ preventScroll: true });
    })();
  }
  
  // Search for countries and subdivisions when query changes
  $: if (tagQuery && showSearch) {
    handleSearch(tagQuery);
  } else {
    searchResults = [];
  }
  
  // Function to search countries and subdivisions
  async function handleSearch(query: string) {
    console.log('[BottomSheet Search] handleSearch llamado con query:', query);
    
    if (!query || query.trim().length < 2) {
      console.log('[BottomSheet Search] Query demasiado corta, limpiando resultados');
      searchResults = [];
      return;
    }
    
            
    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    console.log('[BottomSheet Search] Iniciando debounce de 300ms...');
    
    // Debounce search usando Promise
    searchDebounceTimer = setTimeout(async () => {
      console.log('[BottomSheet Search] Debounce completado, ejecutando búsqueda...');
      isSearching = true;
      const results = [] as Array<{ id: string; name: string; iso?: string; type: 'country' | 'subdivision'; parentName?: string | null; parentNameLocal?: string | null; subdivisionId?: string }>;
      const lowerQuery = query.toLowerCase().trim();
      
      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&filter=places&limit=20`;
        console.log('[BottomSheet Search] Llamando API:', url);
        
        // Buscar en TODOS los niveles usando la API
        const response = await fetch(url);
        
        console.log('[BottomSheet Search] Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[BottomSheet Search] Data recibida:', data);
          
          // La API retorna { success, data: { places: [] } }
          const places = data.data?.places || [];
          console.log('[BottomSheet Search] Places encontrados:', places.length);
          
          for (const place of places) {
            // Determinar el tipo basado en el nivel
            const type = place.level === 1 ? 'country' : 'subdivision';
            
            results.push({
              id: place.subdivisionId,
              name: place.name,
              iso: place.level === 1 ? place.subdivisionId : undefined,
              type: type,
              // Agregar parentName y parentNameLocal para nivel 3
              parentName: place.parentName || null,
              parentNameLocal: place.parentNameLocal || null,
              subdivisionId: place.subdivisionId
            });
          }
        }
        
        // Sort by relevance (starts with query first)
        results.sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
          const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.name.localeCompare(b.name);
        });
        
        console.log('[BottomSheet Search] Resultados finales:', results.length);
        searchResults = results;
              } catch (error) {
        console.error('[BottomSheet Search] Error searching:', error);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 300);
  }
  
  // Function to select a search result
  async function selectSearchResult(result: { id: string; name: string; iso?: string; type: 'country' | 'subdivision'; parentName?: string | null; parentNameLocal?: string | null; subdivisionId?: string }) {
        
    // Close search
    tagQuery = '';
    searchResults = [];
    onToggleSearch();
    
    // Dispatch event to parent to handle navigation
    // IMPORTANTE: Agregar flag fromDirectSearch para limpieza completa
    const option = { 
      id: result.id, 
      name: result.name, 
      iso: result.iso,
      parentName: result.parentName,
      fromDirectSearch: true // FLAG para indicar navegación limpia
    };
    const event = new CustomEvent('searchSelect', { detail: option });
    window.dispatchEvent(event);
    
    console.log('[BottomSheet] 🔍 Búsqueda directa seleccionada:', result.name, 'ID:', result.id, 'fromDirectSearch: true');
  }

  const dispatch = createEventDispatcher<{
    openPollInGlobe: { poll: Poll | null; options: Array<{ key: string; label: string; color: string; votes: number }> };
    vote: { option: string; pollId?: string };
    requestExpand: void;
    polldropdownstatechange: { open: boolean };
  }>();
  
  // Función para abrir la encuesta principal en el globo
  function openMainPollInGlobe() {
    dispatch('openPollInGlobe', { 
      poll: null, // null indica encuesta principal
      options: displayOptions.map(opt => ({
        key: opt.key,
        label: opt.label || opt.key,
        color: opt.color,
        votes: Number(opt.pct) || 0 // Usar el porcentaje como votos
      }))
    });
  }
  
  // Función para abrir una encuesta adicional en el globo
  function openAdditionalPollInGlobe(poll: Poll) {
    // Agregar la encuesta al inicio de additionalPolls si no existe ya
    if (!additionalPolls.find(p => p.id === poll.id)) {
      additionalPolls = [poll, ...additionalPolls];
    } else {
      // Si ya existe, moverla al inicio
      additionalPolls = [poll, ...additionalPolls.filter(p => p.id !== poll.id)];
    }
    
    dispatch('openPollInGlobe', { 
      poll: poll,
      options: poll.options
    });
  }
  
  // Estado de pantalla completa
  let fullscreenActive = false;
  
  // Estado del menú de opciones (3 puntos)
  let showOptionsMenu = false;
  
  // Estado de expansión de la barra de opciones
  let showPollOptionsExpanded = false;
  
  // Variables para detectar swipe en opciones expandidas
  let optionsTouchStartY = 0;
  let optionsScrollTop = 0;
  let isScrollingOptions = false;
  let optionsScrollElement: HTMLElement | null = null;
  let optionsTouchMoved = false;
  let optionsSwipeThreshold = 30; // Umbral para considerar un swipe deliberado
  
  // Variables para detectar doble click en opciones del desplegable
  let optionClickCount = 0;
  let optionClickTimer: number | null = null;
  let lastClickedOption: string | null = null;
  const DOUBLE_CLICK_DELAY = 300; // ms
  
  // Debug logs para móvil
 
  
  
  // Modal de opciones de encuesta
  let showPollOptionsModal = false;
  let selectedPollForOptions: any = null;
  let modalTouchStartY = 0;
  let modalCurrentY = 0;
  
  function openPollOptionsModal(pollData: any) {
    selectedPollForOptions = pollData;
    showPollOptionsModal = true;
  }
  
  function closePollOptionsModal() {
    showPollOptionsModal = false;
    selectedPollForOptions = null;
    modalCurrentY = 0;
  }
  
  function handleModalTouchStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }
  
  function handleModalTouchMove(e: TouchEvent) {
    const deltaY = e.touches[0].clientY - modalTouchStartY;
    if (deltaY > 0) {
      modalCurrentY = deltaY;
    }
  }
  
  function handleModalTouchEnd() {
    if (modalCurrentY > 100) {
      closePollOptionsModal();
    }
    modalCurrentY = 0;
  }
  
  // Recargar trending cuando cambie la región O cuando activePoll cambie
  $: if (selectedCountryName !== undefined || selectedSubdivisionName !== undefined || selectedCityName !== undefined || activePoll !== undefined) {
    loadMainPoll();
  }

  onMount(() => {
    // Cargar datos iniciales desde la API
    loadMainPoll(); // Cargar trending topic como encuesta principal
    loadUserSuggestions();
    // Cargar primera página de encuestas adicionales al inicio
    loadAdditionalPolls(1);
    
    // Detectar cambios de pantalla completa
    const handleFullscreenChange = () => {
      fullscreenActive = !!document.fullscreenElement;
    };
    
    // Manejar clicks globales para cerrar acordeones y menú
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedCard = target.closest('.vote-card');
      const clickedButtonsGroup = target.closest('.nav-buttons-group');
      
      // Si el click no es en una vote-card, cerrar acordeones
      if (!clickedCard) {
        activeAccordionMainIndex = null;
        Object.keys(activeAccordionByPoll).forEach(key => {
          activeAccordionByPoll[key] = null;
        });
      }
      
      // Si el click no es en el grupo de botones, cerrar menú
      if (!clickedButtonsGroup) {
        showOptionsMenu = false;
      }
    };
    
    // Manejar tecla Escape para cerrar acordeones y menú
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activeAccordionMainIndex = null;
        Object.keys(activeAccordionByPoll).forEach(key => {
          activeAccordionByPoll[key] = null;
        });
        showOptionsMenu = false;
      }
    };
    
    // Event listeners globales para arrastre
    const handleGlobalMove = (e: PointerEvent | TouchEvent) => {
      handleDragMove(e);
    };
    
    const handleGlobalEnd = () => {
      handleDragEnd();
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('pointermove', handleGlobalMove, { passive: true });
    document.addEventListener('touchmove', handleGlobalMove, { passive: true });
    document.addEventListener('pointerup', handleGlobalEnd);
    document.addEventListener('touchend', handleGlobalEnd);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('pointermove', handleGlobalMove);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('pointerup', handleGlobalEnd);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  });
  
  function onCardKeydown(e: KeyboardEvent, optionKey: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Para teclado, usar posición del elemento
      const target = e.target as HTMLElement;
      const rect = target.getBoundingClientRect();
      voteClickX = rect.left + rect.width / 2;
      voteClickY = rect.top + rect.height / 2;
      handleVote(optionKey);
    }
  }
  
  // Segments activos según el contexto mostrado en el header (ciudad > país > mundo)
  $: activeSegments = (
    (selectedCityName && cityChartSegments?.length ? cityChartSegments : null) ||
    (selectedCountryName && countryChartSegments?.length ? countryChartSegments : null) ||
    (worldChartSegments?.length ? worldChartSegments : [])
  );

  // Helper: normaliza una lista de valores a porcentajes que suman 100 (con corrección de redondeo)
  function normalizeTo100(values: number[]): number[] {
    const total = values.reduce((a, b) => a + (isFinite(b) ? b : 0), 0);
    if (!total || total <= 0) return values.map(() => 0);
    const raw = values.map(v => (v / total) * 100);
    const floors = raw.map(Math.floor);
    let sum = floors.reduce((a, b) => a + b, 0);
    // Distribuir el resto según las fracciones más altas
    const remainders = raw.map((v, i) => ({ i, frac: v - Math.floor(v) }));
    remainders.sort((a, b) => b.frac - a.frac);
    let idx = 0;
    while (sum < 100 && idx < remainders.length) {
      floors[remainders[idx].i] += 1;
      sum += 1;
      idx += 1;
    }
    return floors;
  }

  // Opciones derivadas de los segments (YA normalizadas desde GlobeGL)
  $: displayOptions = (() => {
    const segs = activeSegments || [];
    // NO re-normalizar - los segments ya tienen pct calculado correctamente
    return segs.map((s) => ({
      key: s.key,
      label: s.key,
      color: s.color,
      pct: Number(s.pct) || 0 // Usar directamente el pct que ya viene calculado
    }));
  })();
  
  // Opciones ordenadas y paginadas para la encuesta principal
  // TRENDING: Mostrar máximo 4 encuestas por página
  const TRENDING_PER_PAGE = 4;
  // IMPORTANTE: Usar SOLO trendingPollsData (encuestas reales de BD)
  // NO repetir encuestas - mostrar solo las que hay disponibles
  $: trendingPolls = (() => {
    if (trendingPollsData.length === 0) return [];
    
    // Obtener ubicación actual para filtrar
    const currentLocation = selectedSubdivisionName || selectedCountryName || selectedCityName || null;
    
    const mapped = trendingPollsData.map((poll: any, index: number) => {
      // Encontrar la opción más votada EN LA UBICACIÓN ACTUAL
      let topOptionColor = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5];
      let topOptionLabel = '';
      let topVotes = 0;
      
      if (poll.options && poll.options.length > 0) {
        // Si hay ubicación, filtrar votos por ubicación
        let filteredOptions = poll.options;
        
        if (currentLocation && poll.votesByLocation) {
          // Filtrar opciones por la ubicación actual
          filteredOptions = poll.options.map((opt: any) => {
            const locationVotes = poll.votesByLocation?.[currentLocation]?.[opt.optionLabel || opt.label] || 0;
            return {
              ...opt,
              votesInLocation: locationVotes
            };
          }).filter((opt: any) => opt.votesInLocation > 0);
          
          // Ordenar por votos en la ubicación
          filteredOptions.sort((a: any, b: any) => b.votesInLocation - a.votesInLocation);
        } else {
          // Sin ubicación específica, usar votos totales
          filteredOptions = [...poll.options].sort((a: any, b: any) => 
            (b.votes || b._count?.votes || 0) - (a.votes || a._count?.votes || 0)
          );
        }
        
        if (filteredOptions.length > 0) {
          topOptionColor = filteredOptions[0]?.color || topOptionColor;
          topOptionLabel = filteredOptions[0]?.optionLabel || filteredOptions[0]?.label || '';
          topVotes = filteredOptions[0]?.votesInLocation || filteredOptions[0]?.votes || filteredOptions[0]?._count?.votes || 0;
        }
      }
      
      return {
        key: `poll-${poll.id}`,
        label: poll.title || poll.question || `Encuesta ${poll.id}`,
        color: topOptionColor,
        votes: poll.trendingScore || poll.totalVotes || 0,
        pollData: poll,
      };
    });
    
    // Verificar duplicados en el mapeo
    const keys = mapped.map(m => m.key);
    const uniqueKeys = new Set(keys);
   
    
    return mapped;
  })();
  // Filtrar trending polls para no mostrar encuestas que ya están en additionalPolls o activePoll
  let filteredTrendingPolls: any[] = [];
  $: {
    const additionalPollIds = new Set(additionalPolls.map(p => p.id));
    filteredTrendingPolls = trendingPolls.filter(poll => {
      const pollId = poll.pollData?.id?.toString();
      // Excluir si es la encuesta activa o si ya está en additionalPolls
      if (activePoll?.id && pollId === activePoll.id.toString()) return false;
      if (pollId && additionalPollIds.has(pollId)) return false;
      return true;
    });
  }
  
  // Filtrar additionalPolls para no mostrar la encuesta activa Y eliminar duplicados
  let filteredAdditionalPolls: any[] = [];
  $: {
    const filtered = additionalPolls.filter(poll => {
      // Excluir si es la encuesta activa
      if (activePoll?.id && poll.id === activePoll.id.toString()) return false;
      return true;
    });
    
    // IMPORTANTE: Eliminar duplicados por ID como medida de seguridad extra
    filteredAdditionalPolls = filtered.filter((poll, index, self) => 
      index === self.findIndex((p) => p.id === poll.id)
    );
  }
  
  $: sortedDisplayOptions = filteredTrendingPolls; // Alias para compatibilidad con código existente
  // Solo paginar si hay MÁS de 4 encuestas (no repetir si hay menos)
  $: shouldPaginateMain = filteredTrendingPolls.length > TRENDING_PER_PAGE;
  $: paginatedMainOptions = shouldPaginateMain 
    ? getPaginatedOptions(filteredTrendingPolls, currentPageMain, TRENDING_PER_PAGE)
    : { items: filteredTrendingPolls, totalPages: 1, hasNext: false, hasPrev: false };
  
  // Dirección de transición para trending
  let trendingTransitionDirection: 'next' | 'prev' | null = null;
  

  $: {
    const signature = displayOptions.length > 1 ? displayOptions.map(option => option.key).join('|') : '';
    if (signature) {
      if (signature !== lastMainOptionsSignature) {
        lastMainOptionsSignature = signature;
        activeAccordionMainIndex = null; // Empezar con todas plegadas
        currentPageMain = 0; // Resetear página cuando cambian opciones
      }
    } else if (lastMainOptionsSignature) {
      lastMainOptionsSignature = '';
      activeAccordionMainIndex = null;
      currentPageMain = 0;
    }
  }

  // Comentado: ahora todas las opciones empiezan plegadas/equilibradas
  // $: if (displayOptions.length > 1 && activeAccordionMainIndex == null) {
  //   setActiveMain(0);
  // }

  $: {
    const activePollIds = new Set(additionalPolls.map(poll => poll.id));
    for (const pollId in pollOptionSignatures) {
      if (!activePollIds.has(pollId)) {
        delete pollOptionSignatures[pollId];
        delete activeAccordionByPoll[pollId];
      }
    }

    for (const poll of additionalPolls) {
      const options = getNormalizedOptions(poll);
      const signature = options.length > 1 ? options.map(option => option.key).join('|') : '';

      if (signature) {
        if (pollOptionSignatures[poll.id] !== signature) {
          pollOptionSignatures[poll.id] = signature;
          activeAccordionByPoll[poll.id] = null; // Empezar plegadas
          currentPageByPoll[poll.id] = 0; // Resetear página cuando cambian opciones
        }
      } else if (options.length > 1 && activeAccordionByPoll[poll.id] == null) {
        activeAccordionByPoll[poll.id] = null; // Mantener plegadas
      } else {
        if (pollOptionSignatures[poll.id]) {
          delete pollOptionSignatures[poll.id];
        }
        activeAccordionByPoll[poll.id] = null;
        currentPageByPoll[poll.id] = 0;
      }
    }
  }

  // Comentado: ahora todas las encuestas adicionales empiezan plegadas
  // $: {
  //   for (const poll of additionalPolls) {
  //     const options = getNormalizedOptions(poll);
  //     if (options.length > 1 && activeAccordionByPoll[poll.id] == null) {
  //       setActiveForPoll(poll.id, 0);
  //     }
  //     // Resetear página si no está inicializada
  //     if (currentPageByPoll[poll.id] === undefined) {
  //       currentPageByPoll[poll.id] = 0;
  //     }
  //   }
  // }
  
  // Resetear página si no está inicializada (sin auto-abrir opciones)
  $: {
    for (const poll of additionalPolls) {
      if (currentPageByPoll[poll.id] === undefined) {
        currentPageByPoll[poll.id] = 0;
      }
    }
  }

  // Determina el tamaño visual de cada tarjeta según su porcentaje de votos
  function sizeForOption(option: any, index: number) {
    const percentage = option.pct;
    
    // Treemap proporcional basado en porcentajes
    if (percentage >= 50) return 'large';     // 50%+ = 2x2 (muy grande)
    if (percentage >= 25) return 'medium';    // 25-49% = 2x1 (mediano alto)
    if (percentage >= 15) return 'small-wide'; // 15-24% = 1x2 (pequeño ancho)
    return 'small';                           // <15% = 1x1 (pequeño)
  }
  
  // Función para manejar el voto
  async function handleVote(optionKey: string, pollId?: string) {
    console.log('='.repeat(50));
    console.log('[BottomSheet handleVote] 🗳️ INICIO DE VOTO');
    console.log('[BottomSheet handleVote] optionKey:', optionKey);
    console.log('[BottomSheet handleVote] pollId:', pollId);
    console.log('[BottomSheet handleVote] activePoll:', activePoll ? activePoll.id : 'null');
    console.log('[BottomSheet handleVote] additionalPolls.length:', additionalPolls.length);
    console.log('='.repeat(50));
    
    // Verificar autenticación ANTES de votar
    if (!$currentUser) {
      console.log('[BottomSheet] ⚠️ Usuario no autenticado - mostrando AuthModal');
      pendingVoteData = { optionKey, pollId };
      showAuthModal = true;
      return;
    }
    
    // Si es la encuesta principal (trending), abrir la encuesta específica
    if (!pollId && voteOptions.length > 0) {
      const option = voteOptions.find((o: any) => o.key === optionKey);
      if (option?.pollData) {
        // Abrir la encuesta específica
        openTrendingPoll(option.pollData);
        return;
      }
    }
    
    // Determinar el ID de la encuesta
    const votePollId = pollId || (activePoll?.id ? activePoll.id.toString() : 'main');
    
    // Si ya votó por esta misma opción, desmarcar el voto
    if (userVotes[votePollId] === optionKey) {
      console.log('[BottomSheet handleVote] 🗑️ Desvotando - mismo voto detectado');
      console.log('[BottomSheet handleVote] Llamando a clearUserVote para:', votePollId);
      // Llamar a clearUserVote que elimina del servidor Y del estado
      await clearUserVote(votePollId);
      return;
    }
    
    // Registrar o cambiar el voto del usuario (forzar reactividad)
    userVotes = { ...userVotes, [votePollId]: optionKey };
    
    // Capturar posición del icono de votos
    if (voteIconElement) {
      const rect = voteIconElement.getBoundingClientRect();
      voteIconX = rect.left + rect.width / 2;
      voteIconY = rect.top + rect.height / 2;
    }
    
    // Activar efecto visual de votación
    voteEffectActive = true;
    voteEffectPollId = votePollId;
    
    // Actualizar displayVotes después de la animación
    setTimeout(() => {
      displayVotes = { ...userVotes };
      voteEffectActive = false;
      voteEffectPollId = null;
    }, 1200); // Mismo tiempo que la animación
    
    // Enviar voto al backend DIRECTAMENTE desde aquí
    await sendVoteToBackend(optionKey, pollId);
    
    // Voto completamente manejado por BottomSheet, no notifica al padre
    console.log('[BottomSheet] Voto registrado y enviado:', optionKey, 'en encuesta:', votePollId);
  }
  
  // Nueva función para enviar voto directamente desde BottomSheet
  async function sendVoteToBackend(optionKey: string, pollId?: string) {
    console.log('[BottomSheet sendVote] 🎯 Iniciando envío de voto');
    console.log('[BottomSheet sendVote] optionKey:', optionKey);
    console.log('[BottomSheet sendVote] pollId:', pollId);
    
    // Determinar qué encuesta - buscar por ID (string o number)
    let poll;
    if (pollId) {
      // Buscar en additionalPolls (comparación flexible)
      poll = additionalPolls.find(p => p.id == pollId || p.id === pollId.toString());
      console.log('[BottomSheet sendVote] Buscando en additionalPolls:', poll ? 'Encontrada' : 'No encontrada');
    } else {
      poll = activePoll;
      console.log('[BottomSheet sendVote] Usando activePoll');
    }
    
    if (!poll) {
      console.error('[BottomSheet sendVote] ❌ No se encontró la encuesta');
      console.error('[BottomSheet sendVote] additionalPolls:', additionalPolls);
      return;
    }
    
    console.log('[BottomSheet sendVote] ✅ Encuesta encontrada:', {
      id: poll.id,
      title: poll.question,
      totalOptions: poll.options?.length
    });
    
    // Buscar la opción - puede estar como 'key', 'optionKey', etc.
    const option = poll.options?.find((opt: any) => 
      opt.key === optionKey || 
      opt.optionKey === optionKey ||
      opt.label === optionKey ||
      opt.optionLabel === optionKey
    );
    
    if (!option) {
      console.error('[BottomSheet sendVote] ❌ Opción no encontrada:', optionKey);
      console.error('[BottomSheet sendVote] Opciones disponibles:', poll.options);
      console.error('[BottomSheet sendVote] Primera opción completa:', JSON.stringify(poll.options?.[0], null, 2));
      return;
    }
    
    console.log('[BottomSheet sendVote] ✅ Opción encontrada:', option);
    console.log('[BottomSheet sendVote] Opción completa:', JSON.stringify(option, null, 2));
    
    // Obtener optionId - puede estar en diferentes formatos
    const rawOptionId = option.id || option.optionId;
    if (!rawOptionId && rawOptionId !== 0) {
      console.error('[BottomSheet sendVote] ❌ La opción no tiene ID:', option);
      console.error('[BottomSheet sendVote] Campos disponibles:', Object.keys(option));
      return;
    }
    
    // Convertir a número - CRÍTICO para el backend
    const optionId = typeof rawOptionId === 'string' ? parseInt(rawOptionId) : rawOptionId;
    const numericPollId = typeof poll.id === 'string' ? parseInt(poll.id) : poll.id;
    
    console.log('[BottomSheet sendVote] 🔢 IDs convertidos:', {
      optionId: optionId,
      optionIdType: typeof optionId,
      pollId: numericPollId,
      pollIdType: typeof numericPollId
    });
    
    console.log('[BottomSheet sendVote] 📤 Enviando al servidor:', {
      url: `/api/polls/${numericPollId}/vote`,
      pollId: numericPollId,
      optionId,
      optionKey
    });
    
    try {
      // Obtener ubicación real del usuario (con fallback)
      let latitude = 40.4168;  // Madrid por defecto
      let longitude = -3.7038;
      
      // Sistema híbrido de geolocalización: GPS → IP → Fallback (igual que GlobeGL)
      let locationMethod = 'default';
      let subdivisionId: number | null = null;
      
      // PASO 1: Intentar GPS (más preciso, requiere permiso)
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
          locationMethod = 'gps';
          console.log('[BottomSheet] 📍 GPS obtenido:', { latitude, longitude, accuracy: position.coords.accuracy + 'm' });
        }
      } catch (gpsError) {
        console.warn('[BottomSheet] ⚠️ GPS no disponible:', gpsError);
        console.log('[BottomSheet] 💡 Razón común en móvil: requiere HTTPS, no HTTP');
        
        // PASO 2: Fallback a IP Geolocation (aproximado, sin permiso)
        try {
          console.log('[BottomSheet] 🔄 Intentando geolocalización por IP...');
          const ipResponse = await fetch('https://ipapi.co/json/', { 
            signal: AbortSignal.timeout(5000) 
          });
          
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            if (ipData.latitude && ipData.longitude) {
              latitude = ipData.latitude;
              longitude = ipData.longitude;
              locationMethod = 'ip';
              console.log('[BottomSheet] ✅ IP Geolocation obtenida:', {
                latitude,
                longitude,
                city: ipData.city,
                region: ipData.region,
                country: ipData.country_name,
                ip: ipData.ip
              });
            }
          }
        } catch (ipError) {
          console.error('[BottomSheet] ❌ IP Geolocation falló:', ipError);
          console.log('[BottomSheet] 📍 Usando coordenadas por defecto (Madrid)');
        }
      }
      
      // PASO 3: Geocodificar a subdivisión con point-in-polygon
      try {
        const geocodeResponse = await apiCall(`/api/geocode?lat=${latitude}&lon=${longitude}`);
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.found && geocodeData.subdivisionId) {
            subdivisionId = geocodeData.subdivisionId;
            console.log('[BottomSheet] 🌍 Subdivisión encontrada:', {
              subdivisionId,
              name: geocodeData.subdivisionName,
              level: geocodeData.subdivisionLevel,
              method: geocodeData.method,
              locationSource: locationMethod
            });
          }
        }
      } catch (geocodeError) {
        console.warn('[BottomSheet] ⚠️ Error en geocoding:', geocodeError);
      }
      
      // Validar que tenemos subdivisionId
      if (!subdivisionId) {
        console.error('[BottomSheet] ❌ No se pudo obtener subdivisionId');
        console.error('[BottomSheet] 💡 El voto NO se puede registrar sin ubicación');
        return;
      }
      
      console.log('[BottomSheet] 📤 Enviando al servidor:', {
        optionId,
        latitude,
        longitude,
        subdivisionId
      });
      
      const result = await apiPost(`/api/polls/${numericPollId}/vote`, {
        optionId,
        userId: $currentUser?.id || null,
        latitude,
        longitude,
        subdivisionId
      });
      
      console.log('[BottomSheet sendVote] ✅ Voto guardado exitosamente:', result);
      
      // Solo incrementar contador si es un voto NUEVO, no si es actualización
      if (!result.isUpdate) {
          if (poll.totalVotes !== undefined) {
            poll.totalVotes++;
            console.log('[BottomSheet sendVote] Contador incrementado (voto nuevo):', poll.totalVotes);
          }
          if (option.votes !== undefined) {
            option.votes++;
            console.log('[BottomSheet sendVote] Votos de opción incrementados:', option.votes);
          }
      } else {
        console.log('[BottomSheet sendVote] ℹ️ Actualización de voto - contador no cambia');
      }
      
      // Forzar reactividad para encuesta activa vs. adicionales
      if (poll === activePoll) {
        activePoll = { ...activePoll };
      } else {
        additionalPolls = [...additionalPolls];
      }
    } catch (error) {
      console.error('[BottomSheet sendVote] ❌ Error de red:', error);
    }
  }
  
  // Función para manejar votación múltiple
  async function handleMultipleVote(optionKey: string, pollId: string) {
    const poll = additionalPolls.find(p => p.id.toString() === pollId) || 
                 (activePoll && activePoll.id.toString() === pollId ? activePoll : null);
    
    if (!poll || poll.type !== 'multiple') {
      console.warn('[BottomSheet] No es encuesta múltiple o no encontrada');
      return;
    }
    
    console.log('[BottomSheet] 🗳️ handleMultipleVote:', { pollId, optionKey });
    
    // Verificar si ya se confirmaron votos anteriormente
    const hasConfirmedVotes = userVotes[pollId];
    
    if (hasConfirmedVotes) {
      // Si ya hay votos confirmados, desvotar del servidor
      console.log('[BottomSheet] Ya hay votos confirmados, desvotando del servidor...');
      await clearUserVote(pollId);
      
      // Limpiar también las selecciones pendientes
      multipleVotes = { ...multipleVotes, [pollId]: [] };
      
      // Forzar reactividad
      if (poll === activePoll) {
        activePoll = { ...activePoll };
      } else {
        additionalPolls = [...additionalPolls];
      }
      
      console.log('[BottomSheet] ✅ Votos múltiples eliminados');
      return;
    }
    
    // Si no hay votos confirmados, alternar selección local
    if (!multipleVotes[pollId]) {
      multipleVotes[pollId] = [];
    }
    
    const currentVotes = multipleVotes[pollId];
    const index = currentVotes.indexOf(optionKey);
    
    if (index > -1) {
      // Quitar de selección pendiente
      multipleVotes[pollId] = currentVotes.filter(k => k !== optionKey);
      console.log('[BottomSheet] ➖ Opción removida de selección');
    } else {
      // Añadir a selección pendiente
      multipleVotes[pollId] = [...currentVotes, optionKey];
      console.log('[BottomSheet] ➕ Opción añadida a selección');
    }
    
    // Forzar reactividad
    multipleVotes = { ...multipleVotes };
    
    console.log('[BottomSheet] Selecciones actuales:', multipleVotes[pollId]);
  }
  
  // Función para confirmar votos múltiples
  async function confirmMultipleVotes(pollId: string) {
    const votes = multipleVotes[pollId];
    if (!votes || votes.length === 0) return;
    
    console.log('[BottomSheet] 📊 Confirmando votos múltiples:', votes);
    
    // Enviar cada voto al backend
    for (const optionKey of votes) {
      await sendVoteToBackend(optionKey, pollId);
    }
    
    // Marcar como votado
    userVotes = { ...userVotes, [pollId]: votes.join(',') };
    displayVotes = { ...userVotes };
    
    // Limpiar selecciones múltiples después de confirmar
    multipleVotes = { ...multipleVotes, [pollId]: [] };
    
    // Forzar reactividad de la encuesta para actualizar UI
    const poll = additionalPolls.find(p => p.id.toString() === pollId);
    if (poll) {
      // Encontrada en additionalPolls
      additionalPolls = [...additionalPolls];
      console.log('[BottomSheet] ✅ Encuesta actualizada (additionalPolls)');
    } else if (activePoll && activePoll.id.toString() === pollId) {
      // Es la encuesta activa
      activePoll = { ...activePoll };
      console.log('[BottomSheet] ✅ Encuesta actualizada (activePoll)');
    }
    
    console.log('[BottomSheet] ✅ Votos múltiples confirmados y UI refrescada');
  }
  
  // Función para añadir nueva opción directamente (como CreatePollModal)
  async function addNewCollaborativeOption(pollId: string, previewColor?: string) {
    console.log('[BottomSheet] addNewCollaborativeOption called:', { pollId, previewColor });
    
    // Verificar si ya hay una opción pendiente de confirmar
    if (pendingCollaborativeOption[pollId]) {
      console.log('[BottomSheet] Ya hay una opción pendiente. Confírmala primero.');
      return;
    }
    
    const poll = additionalPolls.find(p => p.id.toString() === pollId) || 
                 (activePoll && activePoll.id.toString() === pollId ? activePoll : null);
    
    if (!poll) {
      console.error('[BottomSheet] Poll not found:', pollId);
      return;
    }
    
    if (poll.type !== 'collaborative') {
      console.error('[BottomSheet] Poll is not collaborative:', poll.type);
      return;
    }
    
    if (poll.options.length >= 10) {
      console.error('[BottomSheet] Poll already has max options:', poll.options.length);
      return;
    }
    
    console.log('[BottomSheet] All checks passed, creating new option...');
    
    // Generar un ID temporal único
    const tempId = `temp-${Date.now()}`;
    
    // Usar el color del preview si se pasa, si no generar uno aleatorio
    let randomColor = previewColor;
    if (!randomColor) {
      const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
        '#dc2626', '#ea580c', '#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0d9488'
      ];
      randomColor = colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Crear la nueva opción vacía CON FLAG DE EDICIÓN
    const newOption = {
      id: tempId,
      key: tempId,
      label: '',
      color: randomColor,
      votes: 0,
      imageUrl: null,
      isEditing: true // ← Flag directo en la opción
    };
    
    // También mantener el registro para compatibilidad
    pendingCollaborativeOption[pollId] = tempId;
    editingOptionColors[tempId] = randomColor;
    
    // Actualizar la encuesta PRIMERO
    if (poll.id === activePoll?.id) {
      // Para activePoll, actualizar directamente con spread completo
      activePoll = { 
        ...activePoll, 
        options: [...activePoll.options, newOption] 
      };
    } else {
      // Para additionalPolls
      poll.options = [...poll.options, newOption];
      additionalPolls = [...additionalPolls];
    }
    
    // Esperar un tick para que Svelte actualice el DOM
    await nextTick();
    
    // Ir a la última página y activar la nueva opción
    const totalOptions = (poll.id === activePoll?.id ? activePoll.options.length : poll.options.length);
    const OPTIONS_PER_PAGE = 4;
    const lastPage = Math.max(0, Math.ceil(totalOptions / OPTIONS_PER_PAGE) - 1);
    const indexInPage = (totalOptions - 1) % OPTIONS_PER_PAGE;
    
    console.log('[BottomSheet] Navegando a nueva opción:', {
      totalOptions,
      lastPage,
      indexInPage,
      pollId,
      isActivePoll: poll.id === activePoll?.id,
      currentOptions: poll.options.map((o: any) => ({ key: o.key, isEditing: o.isEditing }))
    });
    
    if (poll.id === activePoll?.id) {
      // Para encuesta activa
      activeAccordionMainIndex = null;
      transitionDirectionMain = 'next';
      currentPageMain = lastPage;
      
      await delay(100);
      activeAccordionMainIndex = indexInPage;
      
      await delay(400);
      transitionDirectionMain = null;
    } else {
      // Para encuestas adicionales
      activeAccordionByPoll = { ...activeAccordionByPoll, [pollId]: null };
      transitionDirectionByPoll = { ...transitionDirectionByPoll, [pollId]: 'next' };
      currentPageByPoll = { ...currentPageByPoll, [pollId]: lastPage };
      
      await delay(100);
      activeAccordionByPoll = { ...activeAccordionByPoll, [pollId]: indexInPage };
      
      await delay(400);
      transitionDirectionByPoll = { ...transitionDirectionByPoll, [pollId]: null };
    }
    
    console.log('[BottomSheet] Nueva opción colaborativa creada (pendiente):', {
      newOption,
      pollId,
      tempId,
      pendingState: pendingCollaborativeOption
    });
  }
  
  // Función para publicar una nueva opción colaborativa desde SinglePollSection
  async function handlePublishOption(pollId: string, optionKey: string, label: string, color: string) {
    console.log('[BottomSheet] handlePublishOption called:', { pollId, optionKey, label, color });
    
    const poll = additionalPolls.find(p => p.id.toString() === pollId) || 
                 (activePoll && activePoll.id.toString() === pollId ? activePoll : null);
    
    if (!poll) {
      console.error('[BottomSheet] Poll not found:', pollId);
      return;
    }
    
    const option = poll.options.find((o:any) => o.key === optionKey);
    if (!option) {
      console.error('[BottomSheet] Option not found:', optionKey, 'in poll:', pollId);
      return;
    }
    
    console.log('[BottomSheet] Found poll and option, proceeding to save...');
    
    try {
      const numericPollId = typeof poll.id === 'string' ? parseInt(poll.id) : poll.id;
      
      const result = await apiPost(`/api/polls/${numericPollId}/options`, {
        label: label,
        color: color,
        userId: $currentUser?.id || null
      });
        
      // Actualizar la opción temporal con los datos del servidor
      option.id = result.data.id;
      option.key = result.data.optionKey;
      option.label = label;
      option.color = color;
      delete option.isEditing;
      
      // Actualizar la encuesta
      if (poll.id === activePoll?.id) {
        activePoll = { ...activePoll };
      } else {
        additionalPolls = [...additionalPolls];
      }
      
      // Limpiar el estado de edición
      delete pendingCollaborativeOption[pollId];
      delete editingOptionColors[optionKey];
      pendingCollaborativeOption = { ...pendingCollaborativeOption };
      editingOptionColors = { ...editingOptionColors };
      
      console.log('[BottomSheet] Opción publicada exitosamente:', result.data);
    } catch (error) {
      console.error('[BottomSheet] Error de red:', error);
      alert('Error de conexión. Inténtalo de nuevo.');
    }
  }
  
  // Función para confirmar y guardar la nueva opción colaborativa
  async function confirmCollaborativeOption(pollId: string) {
    const tempId = pendingCollaborativeOption[pollId];
    if (!tempId) return;
    
    const poll = additionalPolls.find(p => p.id.toString() === pollId) || 
                 (activePoll && activePoll.id.toString() === pollId ? activePoll : null);
    if (!poll) return;
    
    const option = poll.options.find((o:any) => o.key === tempId);
    if (!option || !option.label.trim()) {
      alert('Debes escribir un nombre para la opción');
      return;
    }
    
    try {
      const numericPollId = typeof poll.id === 'string' ? parseInt(poll.id) : poll.id;
      
      const result = await apiPost(`/api/polls/${numericPollId}/options`, {
        label: option.label.trim(),
        color: option.color,
        userId: $currentUser?.id || null
      });
        
      // Actualizar la opción temporal con los datos del servidor
      option.id = result.data.id;
      option.key = result.data.optionKey;
      delete option.isEditing; // ← Quitar flag de edición
      
      // Actualizar la encuesta
      if (poll.id === activePoll?.id) {
        activePoll = { ...activePoll };
      } else {
        additionalPolls = [...additionalPolls];
      }
      
      // Limpiar el estado de edición
      delete pendingCollaborativeOption[pollId];
      delete editingOptionColors[tempId];
      pendingCollaborativeOption = { ...pendingCollaborativeOption };
      editingOptionColors = { ...editingOptionColors };
      
      console.log('[BottomSheet] Opción colaborativa confirmada:', result.data);
    } catch (error) {
      console.error('[BottomSheet] Error de red:', error);
      alert('Error de conexión. Inténtalo de nuevo.');
    }
  }
  
  // Función para cancelar la creación de una opción colaborativa
  function cancelCollaborativeOption(pollId: string) {
    const tempId = pendingCollaborativeOption[pollId];
    if (!tempId) return;
    
    const poll = additionalPolls.find(p => p.id.toString() === pollId) || 
                 (activePoll && activePoll.id.toString() === pollId ? activePoll : null);
    if (!poll) return;
    
    // Eliminar la opción temporal
    poll.options = poll.options.filter((o : any) => o.key !== tempId);
    
    // Actualizar la encuesta
    if (poll.id === activePoll?.id) {
      activePoll = { ...activePoll };
    } else {
      additionalPolls = [...additionalPolls];
    }
    
    // Limpiar el estado de edición
    delete pendingCollaborativeOption[pollId];
    delete editingOptionColors[tempId];
    pendingCollaborativeOption = { ...pendingCollaborativeOption };
    editingOptionColors = { ...editingOptionColors };
    
    console.log('[BottomSheet] Opción colaborativa cancelada');
  }
  
  // Función para añadir nueva opción (colaborativa)
  async function addNewOption(pollId: string) {
    const label = newOptionLabel[pollId]?.trim();
    if (!label) return;
    
    const poll = additionalPolls.find(p => p.id === pollId) || activePoll;
    if (!poll || poll.type !== 'collaborative') return;
    
    try {
      const numericPollId = typeof poll.id === 'string' ? parseInt(poll.id) : poll.id;
      
      const result = await apiPost(`/api/polls/${numericPollId}/options`, {
        label: newOptionLabel[pollId],
        userId: $currentUser?.id || null
      });
      console.log('[BottomSheet] Nueva opción añadida:', result);
      
      // Actualizar la encuesta localmente
      const newOption = {
        id: result.data.id,
        key: result.data.optionKey,
        label: result.data.optionLabel,
        color: result.data.color,
        votes: 0,
        imageUrl: result.data.imageUrl
      };
      
      poll.options = [...poll.options, newOption];
      
      // Forzar actualización
      additionalPolls = [...additionalPolls];
      if (activePoll?.id === pollId) {
        activePoll = { ...activePoll };
      }
      
      // Limpiar y cerrar modal
      newOptionLabel[pollId] = '';
      showAddOptionModal[pollId] = false;
      showAddOptionModal = { ...showAddOptionModal };
    } catch (error) {
      console.error('[BottomSheet] Error de red:', error);
    }
  }
  
  // Función para abrir una encuesta trending específica
  function openTrendingPoll(pollData: any) {
    if (!pollData) {
      console.error('[openTrendingPoll] pollData is undefined');
      return;
    }
    
    // Generar ID Ãºnico si no existe
    const pollId = pollData.id ? pollData.id.toString() : `temp-${Date.now()}-${Math.random()}`;
    
    // Transformar la encuesta a formato Poll y agregarla al inicio de additionalPolls
    const transformedPoll = {
      id: pollId,
      question: pollData.question || pollData.title || 'Encuesta',
      type: pollData.type || 'poll',
      region: selectedCountryName || selectedSubdivisionName || selectedCityName || 'Global',
      options: (pollData.options || []).map((opt: any, idx: number) => ({
        id: opt.id || `opt-${idx}`,
        key: opt.optionKey || opt.key || `option-${idx}`,
        label: opt.optionLabel || opt.label || `Opción ${idx + 1}`,
        color: opt.color || `hsl(${idx * 60}, 70%, 50%)`,
        votes: opt._count?.votes || opt.votes || 0,  // Auto-calculado
        avatarUrl: opt.createdBy?.avatarUrl || pollData.user?.avatarUrl  // Desde relación User
      })),
      totalVotes: pollData._count?.votes || pollData.totalVotes || 0,  // Auto-calculado
      totalViews: 0,  // Campo legacy - no se usa
      closedAt: pollData.closedAt,
      user: pollData.user ? {
        id: pollData.user.id,
        displayName: pollData.user.displayName || pollData.user.name || 'Usuario',
        username: pollData.user.username || pollData.user.handle || 'user',
        avatarUrl: pollData.user.avatarUrl,
        verified: pollData.user.verified || false
      } : undefined,
      creator: pollData.user ? {
        id: pollData.user.id ? pollData.user.id.toString() : 'unknown',
        name: pollData.user.displayName || pollData.user.name || 'Usuario',
        handle: pollData.user.username || pollData.user.handle || 'user',
        avatarUrl: pollData.user.avatarUrl,
        verified: pollData.user.verified || false
      } : undefined,
      publishedAt: pollData.createdAt || pollData.publishedAt,
      friendsByOption: {}
    };
    
    // Agregar al inicio de additionalPolls si no existe ya
    if (!additionalPolls.find(p => p.id === transformedPoll.id)) {
      additionalPolls = [transformedPoll, ...additionalPolls];
    }
    
    // Abrir la encuesta en el globo
    openAdditionalPollInGlobe(transformedPoll as Poll);
  }
  
  // Función para detectar scroll al final y cargar más encuestas
  function handlePollScroll(e: Event) {
    onScroll(e);
    
    // Si las opciones están expandidas y se hace scroll en el trending, colapsarlas
    if (showPollOptionsExpanded) {
      showPollOptionsExpanded = false;
      // Notificar al padre
      dispatch('polldropdownstatechange', { open: false });
      console.log('[BottomSheet] Poll dropdown cerrado por scroll');
    }
    
    const target = e.target as HTMLElement;
    if (target) {
      const scrollTop = target.scrollTop || 0;
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      
      // Mostrar el botón si ha scrolleado más de 200px
      showScrollToTop = scrollTop > 200;
      
      // Auto-hide navigation bar logic
      // Solo aplicar esta lógica si el desplegable NO está abierto
      if (!showPollOptionsExpanded) {
        // Solo mostrar la barra cuando estés en la parte superior (scrollTop < 50px)
        if (scrollTop < 50) {
          // Estás en la parte superior - mostrar barra
          showNavBar = true;
        } else if (scrollTop > 100) {
          // Has scrolleado hacia abajo - ocultar barra
          showNavBar = false;
        }
      }
      
      lastScrollTop = scrollTop;
      
      // Si estamos a menos de 400px del final y no estamos cargando, cargar más
      // IMPORTANTE: Solo cargar más encuestas si NO hay una encuesta específica abierta (modo trending)
      if (scrollBottom < 400 && !isLoadingPolls && hasMorePolls && !activePoll) {
        console.log('[BottomSheet] 📥 Cargando más encuestas trending...');
        loadAdditionalPolls(currentPollsPage + 1);
      }
    }
  }
  
  // Función para quitar voto (actualiza en BD)
  async function clearUserVote(pollId: string) {
    console.log('[BottomSheet clearUserVote] 🗑️ ELIMINANDO VOTO');
    console.log('[BottomSheet clearUserVote] pollId recibido:', pollId);
    console.log('[BottomSheet clearUserVote] userVotes antes:', { ...userVotes });
    
    try {
      const numericPollId = typeof pollId === 'string' ? parseInt(pollId) : pollId;
      
      // Encontrar la encuesta antes de borrar
      const poll = additionalPolls.find(p => p.id.toString() === pollId) || 
                   (activePoll && activePoll.id.toString() === pollId ? activePoll : null);
      
      // Guardar las opciones votadas antes de borrar (para encuestas múltiples)
      const votedOptions = userVotes[pollId];
      console.log('[BottomSheet clearUserVote] Opciones a desvotar:', votedOptions);
      
      // DELETE no debe enviar body (el servidor usa currentUser del contexto)
      await apiCall(`/api/polls/${numericPollId}/vote`, {
        method: 'DELETE'
      });
      
      // Actualizar estado local - eliminar voto de ambos registros
      const { [pollId]: _, ...restUserVotes } = userVotes;
      const { [pollId]: __, ...restDisplayVotes } = displayVotes;
      userVotes = { ...restUserVotes };
      displayVotes = { ...restDisplayVotes };
      
      console.log('[BottomSheet clearUserVote] ✅ Estados limpiados:');
      console.log('[BottomSheet clearUserVote] userVotes:', { ...userVotes });
      console.log('[BottomSheet clearUserVote] displayVotes:', { ...displayVotes });
      
      // Para encuestas múltiples, decrementar contadores de cada opción votada
      if (poll && poll.type === 'multiple' && votedOptions) {
        const optionKeys = votedOptions.split(',');
        console.log('[BottomSheet clearUserVote] Decrementando contadores de opciones múltiples:', optionKeys);
        
        optionKeys.forEach(optionKey => {
          const option = poll.options?.find((opt: any) => 
            opt.key === optionKey || opt.optionKey === optionKey
          );
          if (option && option.votes !== undefined) {
            option.votes = Math.max(0, option.votes - 1);
            console.log(`[BottomSheet clearUserVote] Opción ${optionKey}: ${option.votes} votos`);
          }
        });
        
        // Decrementar total de votos de la encuesta (por cada opción)
        if (poll.totalVotes !== undefined) {
          poll.totalVotes = Math.max(0, poll.totalVotes - optionKeys.length);
          console.log('[BottomSheet clearUserVote] Total de votos:', poll.totalVotes);
        }
      } else {
        // Para encuestas simples, decrementar solo 1 voto total
        if (poll && poll.totalVotes !== undefined) {
          poll.totalVotes = Math.max(0, poll.totalVotes - 1);
        }
      }
      
      // Forzar reactividad según dónde esté la encuesta
      if (activePoll && activePoll.id.toString() === pollId) {
        activePoll = { ...activePoll };
        console.log('[BottomSheet clearUserVote] ✅ activePoll actualizada');
      }
      
      const pollToUpdate = additionalPolls.find(p => p.id.toString() === pollId);
      if (pollToUpdate) {
        additionalPolls = [...additionalPolls];
        console.log('[BottomSheet clearUserVote] ✅ additionalPolls actualizada');
      }
      
      console.log('[BottomSheet clearUserVote] ✅ Voto eliminado correctamente del servidor');
      console.log('[BottomSheet clearUserVote] Estado final - userVotes:', { ...userVotes });
      console.log('[BottomSheet clearUserVote] Estado final - displayVotes:', { ...displayVotes });
    } catch (error) {
      console.error('[BottomSheet] Error de red al eliminar voto:', error);
    }
  }
  
  // Función para volver al inicio
  function scrollToTop() {
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }
  
  // Handler para cuando el usuario se autentica exitosamente
  function handleAuthComplete() {
    console.log('[BottomSheet] ✅ Usuario autenticado, reintentando voto');
    showAuthModal = false;
    
    // Reintentar el voto pendiente
    if (pendingVoteData) {
      handleVote(pendingVoteData.optionKey, pendingVoteData.pollId);
      pendingVoteData = null;
    }
  }
  
  // Handler para abrir modal de preview fullscreen
  function handleOpenPreviewModal(event: CustomEvent) {
    const { option, pollId } = event.detail;
    console.log('[BottomSheet] 🎬 Abriendo modal preview:', { option, pollId });
    
    // Encontrar la encuesta
    let poll = null;
    
    if (activePoll && activePoll.id.toString() === pollId.toString()) {
      poll = activePoll;
    } else {
      poll = additionalPolls.find(p => p.id.toString() === pollId.toString());
    }
    
    if (!poll) {
      console.error('[BottomSheet] No se encontró la encuesta:', pollId);
      return;
    }
    
    // Transformar opciones al formato que espera PollMaximizedView
    // Calcular total de votos para porcentajes
    const totalVotes = (poll.options || []).reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
    
    // Obtener los votos del usuario para esta encuesta
    const userVoteForPoll = userVotes[poll.id.toString()];
    const isMultiple = poll.multipleChoice;
    
    // Detectar si alguna opción tiene imagen
    const hasAnyImages = (poll.options || []).some((opt: any) => opt.imageUrl);
    
    // Transformar TODAS las opciones (no filtrar por imageUrl)
    const transformedOptions = (poll.options || [])
      .map((opt: any) => {
        const votes = opt.votes || 0;
        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        const optionKey = opt.key || opt.id;
        
        // Determinar si esta opción fue votada
        let hasVoted = false;
        if (isMultiple) {
          // Encuesta múltiple: array de keys
          hasVoted = Array.isArray(userVoteForPoll) && userVoteForPoll.includes(optionKey);
        } else {
          // Encuesta simple: string key
          hasVoted = userVoteForPoll === optionKey;
        }
        
        return {
          id: optionKey,
          label: opt.label || opt.optionLabel || '',
          color: opt.color || '#10b981',
          imageUrl: opt.imageUrl,
          pct: pct,
          votes: votes,
          voted: hasVoted
        };
      });
    
    if (transformedOptions.length === 0) {
      console.error('[BottomSheet] No hay opciones');
      return;
    }
    
    // Si NO hay imágenes, mostrar todas las opciones en vertical
    // Si HAY imágenes, usar el modo de una opción a la vez
    const showAllOptions = !hasAnyImages;
    
    // Encontrar la opción activa (solo relevante para modo single-option)
    const activeId = transformedOptions.find((opt: any) => 
      opt.id === option.key || opt.label === option.label
    )?.id || transformedOptions[0].id;
    
    // Encontrar el índice de esta encuesta en allPolls
    const allPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
    const pollIndex = allPolls.findIndex(p => p.id.toString() === poll.id.toString());
    
    previewModalPoll = poll;
    previewModalOption = transformedOptions;
    previewModalOptionIndex = activeId;
    previewModalPollIndex = pollIndex >= 0 ? pollIndex : 0;
    previewModalShowAllOptions = showAllOptions; // Nuevo estado
    showPreviewModal = true;
    
    console.log('[BottomSheet] 📊 Modal data:', { 
      activeId,
      totalOptions: transformedOptions.length,
      pollTitle: poll.question || poll.title,
      pollIndex: previewModalPollIndex,
      totalPolls: allPolls.length,
      showAllOptions,
      hasAnyImages
    });
  }
  
  // Función para cerrar modal de preview
  function closePreviewModal() {
    console.log('[BottomSheet] ❌ Cerrando modal preview');
    showPreviewModal = false;
    previewModalOption = null;
    previewModalPoll = null;
    previewModalOptionIndex = '';
    previewModalPollIndex = 0;
  }
  
  // Navegar a la siguiente encuesta con opciones de preview
  async function navigateToNextPollWithPreview() {
    const allPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
    const currentIndex = previewModalPollIndex >= 0 ? previewModalPollIndex : 0;
    
    console.log('[BottomSheet] 🔍 Buscando siguiente desde índice:', currentIndex, 'de', allPolls.length);
    
    // Buscar siguiente encuesta (con o sin imágenes)
    for (let i = currentIndex + 1; i < allPolls.length; i++) {
      const poll = allPolls[i];
      if ((poll.options || []).length > 0) {
        // Abrir esta encuesta en el modal (puede tener o no imágenes)
        const firstOption = poll.options[0];
        handleOpenPreviewModal({
          detail: { option: firstOption, pollId: poll.id.toString() }
        } as CustomEvent);
        console.log('[BottomSheet] ⬇️ Siguiente encuesta:', i, '/', allPolls.length);
        return;
      }
    }
    
    // Si llegamos al final y hay más encuestas por cargar, cargarlas
    if (hasMorePolls && !isLoadingPolls && !activePoll) {
      console.log('[BottomSheet] 📥 Cargando más encuestas para navegación...');
      await loadAdditionalPolls(currentPollsPage + 1);
      
      // Intentar de nuevo después de cargar
      const newAllPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
      for (let i = currentIndex + 1; i < newAllPolls.length; i++) {
        const poll = newAllPolls[i];
        if ((poll.options || []).length > 0) {
          const firstOption = poll.options[0];
          handleOpenPreviewModal({
            detail: { option: firstOption, pollId: poll.id.toString() }
          } as CustomEvent);
          console.log('[BottomSheet] ⬇️ Siguiente encuesta (después de cargar):', i, '/', newAllPolls.length);
          return;
        }
      }
    }
    
    console.log('[BottomSheet] No hay más encuestas con preview');
  }
  
  // Navegar a la encuesta anterior con opciones de preview
  function navigateToPreviousPollWithPreview() {
    const allPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
    const currentIndex = previewModalPollIndex >= 0 ? previewModalPollIndex : 0;
    
    console.log('[BottomSheet] 🔍 Buscando anterior desde índice:', currentIndex, 'de', allPolls.length);
    
    // Buscar encuesta anterior (con o sin imágenes)
    for (let i = currentIndex - 1; i >= 0; i--) {
      const poll = allPolls[i];
      if ((poll.options || []).length > 0) {
        // Abrir esta encuesta en el modal
        const firstOption = poll.options[0];
        handleOpenPreviewModal({
          detail: { option: firstOption, pollId: poll.id.toString() }
        } as CustomEvent);
        console.log('[BottomSheet] ⬆️ Encuesta anterior:', i, '/', allPolls.length);
        return;
      }
    }
    console.log('[BottomSheet] No hay encuestas anteriores');
  }
  
  // Debug: log when world chart segments change
  $: if (worldChartSegments) {
      }

  // Auto-scroll to active button when navigation changes
  let navContainer: HTMLElement;
  
  $: if (selectedCountryName || selectedSubdivisionName || selectedCityName) {
    // Wait for DOM update then scroll to active button
    (async () => {
      await nextTick();
      if (navContainer) {
        const activeButton = navContainer.querySelector('.nav-chip.active');
        if (activeButton) {
          activeButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }
      }
    })();
  }
</script>

<div
  class="bottom-sheet {state === 'expanded' ? 'solid' : 'glass'} {state === 'peek' ? 'peek-state' : ''} {isTransitioning ? 'transitioning' : ''} {isCameraAnimating ? 'camera-animating' : ''}"
  role="dialog"
  aria-modal="true"
  aria-hidden={state === 'hidden'}
  style={'transform: translateY(' + y + 'px);'}
>

  <!-- Header simplificado con indicador visual de arrastre -->
  <div 
    class="sheet-drag-area"
    onpointerdown={onPointerDown}
    ontouchstart={onPointerDown}
  >
    <!-- Barra de opciones de encuesta (cuando hay una activa) -->
    {#if voteOptions.length > 0}
      <!-- Para la BARRA: usar legendItems (solo opciones con votos en el nivel actual) -->
      {@const _trigger = updateTrigger} <!-- Forzar dependencia del trigger -->
      {@const totalCount = legendItems.reduce((sum, item) => sum + item.count, 0)}
      {@const barSegments = (() => {
        const segments = legendItems.map(item => ({
          key: item.key,
          label: item.key,
          color: item.color,
          votes: item.count,
          pct: totalCount > 0 ? (item.count / totalCount) * 100 : 0
        }));
        console.log('[BottomSheet] 📊 barSegments recalculado - trigger:', _trigger, 'total:', totalCount, 'segmentos:', segments.length);
        return segments;
      })()}
      
      <!-- Para las OPCIONES EXPANDIDAS: mostrar TODAS las opciones de la encuesta -->
      {@const legendMap = Object.fromEntries(legendItems.map(item => [item.key, item.count]))}
      {@const optionsWithPct = voteOptions.map(opt => {
        // ⚡ FIX: Usar opt.votes directamente en lugar de legendMap para nivel 4
        // opt.votes tiene el valor correcto actualizado desde GlobeGL
        const count = opt.votes !== undefined ? opt.votes : (legendMap[opt.key] || 0);
        const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
        
       
        
        return {
          key: opt.key,
          label: opt.label || opt.key,
          color: opt.color,
          votes: count,
          pct: pct,
          displayText: count > 0 ? `${formatNumber(count)} ${count === 1 ? 'voto' : 'votos'}` : '0 votos',
          pollData: (opt as any).pollData,
          avatarUrl: (opt as any).avatarUrl
        };
      })}
      {@const pollTitle = activePoll?.question || activePoll?.title || 'Trending de encuestas'}
      
      <div class="poll-options-bar-container">
        <!-- Título de la encuesta o trending -->
        <div class="poll-bar-title">
          <!-- Avatar del creador (si existe) -->
          {#if activePoll && (activePoll.user?.avatarUrl || activePoll.creator?.avatarUrl)}
            <div class="poll-creator-avatar">
              <img 
                src={activePoll.user?.avatarUrl || activePoll.creator?.avatarUrl || DEFAULT_AVATAR} 
                alt={activePoll.user?.displayName || activePoll.creator?.name || 'Creator'} 
                onerror={(e) => ((e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR)}
              />
              {#if activePoll.user?.verified || activePoll.creator?.verified}
                <span class="verified-badge" title="Verificado">✓</span>
              {/if}
            </div>
          {/if}
          
          <h3>{pollTitle}</h3>
          
          {#if activePoll}
            <button 
              class="poll-close-btn" 
              onclick={(e) => {
                e.stopPropagation();
                dispatch('openPollInGlobe', { poll: null, options: [] });
              }}
              aria-label="Cerrar encuesta y volver a trending"
              title="Cerrar encuesta"
            >
              ✕
            </button>
          {/if}
        </div>
        
        <!-- Barra horizontal de colores (clickeable para expandir) -->
        <button 
          class="poll-bar-chart" 
          onclick={(e) => {
            e.stopPropagation();
            showPollOptionsExpanded = !showPollOptionsExpanded;
            // Notificar al padre para ocultar/mostrar el nav
            dispatch('polldropdownstatechange', { open: showPollOptionsExpanded });
            console.log(`[BottomSheet] Poll dropdown ${showPollOptionsExpanded ? 'abierto' : 'cerrado'}`);
          }}
          aria-expanded={showPollOptionsExpanded}
          aria-label="Ver opciones de la encuesta"
        >
          <div class="poll-bar-segments">
            {#each barSegments as segment}
              <div 
                class="poll-bar-segment" 
                style="width: {segment.pct}%; background-color: {segment.color};"
                title="{segment.label}: {segment.pct.toFixed(1)}%"
              ></div>
            {/each}
          </div>
          <div class="poll-bar-icon">
            {showPollOptionsExpanded ? '▲' : '▼'}
          </div>
        </button>
        
        <!-- Opciones expandidas -->
        {#if showPollOptionsExpanded}
          <div 
            class="poll-bar-options-expanded"
            bind:this={optionsScrollElement}
            onpointerdown={(e) => {
              e.stopPropagation();
            }}
            ontouchstart={(e) => {
              const target = e.currentTarget as HTMLElement;
              optionsTouchStartY = e.touches[0].clientY;
              optionsScrollTop = target.scrollLeft; // Cambio: scrollLeft en lugar de scrollTop
              isScrollingOptions = false;
              optionsTouchMoved = false;
              
              // Detener propagación completamente
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
            onpointermove={(e) => {
              e.stopPropagation();
            }}
            ontouchmove={(e) => {
              const target = e.currentTarget as HTMLElement;
              const currentY = e.touches[0].clientY;
              const deltaY = currentY - optionsTouchStartY;
              
              optionsTouchMoved = true;
              
              // Lógica simplificada para scroll horizontal:
              // Swipe vertical hacia arriba (>50px) → Colapsar opciones
              // El scroll horizontal se maneja automáticamente por el navegador
              
              if (deltaY < -50) {
                // Swipe fuerte hacia arriba → Colapsar opciones
                showPollOptionsExpanded = false;
                // Notificar al padre
                dispatch('polldropdownstatechange', { open: false });
                console.log('[BottomSheet] Poll dropdown cerrado con swipe');
              }
              
              // SIEMPRE detener propagación completamente - NO permitir arrastrar BottomSheet
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
            onpointerup={(e) => {
              isScrollingOptions = false;
              optionsTouchMoved = false;
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
            ontouchend={(e) => {
              isScrollingOptions = false;
              optionsTouchMoved = false;
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
          >
            {#each optionsWithPct.sort((a, b) => b.pct - a.pct) as option, index}
              <button 
                class="poll-bar-option-item" 
                class:is-trending-poll={!activePoll && option.pollData}
                onclick={(e) => {
                  e.stopPropagation();
                  
                  // Detectar doble click
                  const optionKey = option.key;
                  
                  if (lastClickedOption === optionKey) {
                    optionClickCount++;
                  } else {
                    optionClickCount = 1;
                    lastClickedOption = optionKey;
                  }
                  
                  if (optionClickTimer) {
                    clearTimeout(optionClickTimer);
                    optionClickTimer = null;
                  }
                  
                  if (optionClickCount === 2) {
                    // Doble click detectado - expandir BottomSheet
                    console.log('[BottomSheet] Doble click en opción del desplegable - expandiendo BottomSheet');
                    dispatch('requestExpand');
                    optionClickCount = 0;
                    lastClickedOption = null;
                  } else {
                    // Primer click - esperar por segundo click
                    optionClickTimer = window.setTimeout(() => {
                      // Click simple - abrir trending poll si aplica
                      if (!activePoll && option.pollData) {
                        openTrendingPoll(option.pollData);
                      }
                      optionClickCount = 0;
                      lastClickedOption = null;
                    }, DOUBLE_CLICK_DELAY);
                  }
                }}
                style="border: 2px solid {option.color};"
              >
                <!-- Avatar en esquina superior derecha como badge -->
                <div class="poll-bar-option-avatar-badge">
                  {#if !activePoll && option.pollData}
                    <!-- Modo trending: avatar del creador -->
                    {#if option.pollData.user?.avatarUrl}
                      <img 
                        src={option.pollData.user.avatarUrl} 
                        alt={option.pollData.user.displayName || option.label} 
                        class="poll-bar-option-avatar-small"
                      />
                    {:else if option.pollData.creator?.avatarUrl}
                      <img 
                        src={option.pollData.creator.avatarUrl} 
                        alt={option.pollData.creator.name || option.label} 
                        class="poll-bar-option-avatar-small"
                      />
                    {:else}
                      <div class="poll-bar-option-avatar-placeholder-small" style="background-color: {option.color};">
                        {option.label.charAt(0)}
                      </div>
                    {/if}
                  {:else}
                    <!-- Modo encuesta: avatar de la opción -->
                    {#if option.avatarUrl}
                      <img 
                        src={option.avatarUrl} 
                        alt={option.label} 
                        class="poll-bar-option-avatar-small"
                      />
                    {:else}
                      <div class="poll-bar-option-avatar-placeholder-small" style="background-color: {option.color};">
                        {option.label.charAt(0)}
                      </div>
                    {/if}
                  {/if}
                </div>
                
                <div class="poll-bar-option-info">
                  <span class="poll-bar-option-label">{option.label}</span>
                </div>
                
                <!-- Barra de progreso abajo con votos al lado -->
                <div class="poll-bar-option-progress-container">
                  <div class="poll-bar-option-progress-bar">
                    <div class="poll-bar-option-progress-fill" style="width: {option.pct}%; background-color: {option.color};"></div>
                  </div>
                  <span class="poll-bar-option-votes-count">{option.displayText || '0'}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if selectedCityName && cityChartSegments.length}
      <!-- Barra de ciudad (cuando NO hay encuesta seleccionada) -->
      <div class="drag-chart" role="img" aria-label={'Distribución en ' + selectedCityName}>
        {#each cityChartSegments as seg}
          <div
            class="drag-seg"
            style={'width:' + seg.pct + '%; background:' + seg.color}
            title={seg.key + ': ' + seg.pct.toFixed(1) + '%'}
          ></div>
        {/each}
      </div>
    {:else if selectedCountryName && countryChartSegments.length}
      <!-- Barra de país (cuando NO hay encuesta seleccionada) -->
      <div class="drag-chart" role="img" aria-label={'Distribución en ' + selectedCountryName}>
        {#each countryChartSegments as seg}
          <div
            class="drag-seg"
            style={'width:' + seg.pct + '%; background:' + seg.color}
            title={seg.key + ': ' + seg.pct.toFixed(1) + '%'}
          ></div>
        {/each}
      </div>
    {:else if worldChartSegments.length}
      <!-- Barra global (cuando NO hay encuesta seleccionada) -->
      <div class="drag-chart" role="img" aria-label="Distribución global">
        {#each worldChartSegments as seg}
          <div
            class="drag-seg"
            style={'width:' + seg.pct + '%; background:' + seg.color}
            title={seg.key + ': ' + seg.pct.toFixed(1) + '%'}
          ></div>
        {/each}
      </div>
    {:else}
      <!-- Fallback: grabber tradicional si no hay datos -->
      <div class="sheet-grabber"></div>
    {/if}
  </div>
  
  <!-- Navegación minimalista con wrapper -->
  <div 
    class="nav-wrapper"
    class:nav-hidden={!showNavBar}
    onpointerdown={onPointerDown}
    ontouchstart={onPointerDown}
  >
    <div class="nav-minimal" bind:this={navContainer}>
      {#if !selectedCountryName}
        <!-- Global is last active - show dropdown -->
        <button
          class="nav-chip active dropdown-trigger"
          onclick={onToggleDropdown}
        >
          Global
          <span style="margin-left: 4px;">▼</span>
        </button>
      {:else}
        <!-- Global is not last - no dropdown -->
        <button
          class="nav-chip"
          onclick={() => onNavigateToView('world')}
        >
          Global
        </button>
      {/if}
      
      {#if selectedCountryName}
        <div class="nav-divider">/</div>
        
        {#if !selectedSubdivisionName && hasSubdivisions}
          <!-- Country is last active and has subdivisions - show dropdown -->
          <button
            class="nav-chip active dropdown-trigger"
            onclick={onToggleDropdown}
          >
            {selectedCountryName}
            <span style="margin-left: 4px;">▼</span>
          </button>
        {:else if !selectedSubdivisionName && !hasSubdivisions}
          <!-- Country is last active but has NO subdivisions - no dropdown, just active chip -->
          <button
            class="nav-chip active"
            onclick={() => {}}
          >
            {selectedCountryName}
          </button>
        {:else}
          <!-- Country is not last - no dropdown -->
          <button
            class="nav-chip"
            onclick={() => onNavigateToView('country')}
          >
            {selectedCountryName}
          </button>
        {/if}
      {/if}
      
      {#if selectedSubdivisionName}
        <div class="nav-divider">/</div>
        
        {#if !selectedCityName && hasSubdivisions}
          <!-- Subdivision is last active and has sub-subdivisions - show dropdown -->
          <button
            class="nav-chip active dropdown-trigger"
            onclick={onToggleDropdown}
          >
            {selectedSubdivisionName}
            <span style="margin-left: 4px;">▼</span>
          </button>
        {:else if !selectedCityName && !hasSubdivisions}
          <!-- Subdivision is last active but has NO sub-subdivisions - no dropdown, just active chip -->
          <button
            class="nav-chip active"
            onclick={() => {}}
          >
            {selectedSubdivisionName}
          </button>
        {:else}
          <!-- Subdivision is not last - no dropdown -->
          <button
            class="nav-chip"
            onclick={() => onNavigateToView('subdivision')}
          >
            {selectedSubdivisionName}
          </button>
        {/if}
      {/if}
      
      {#if selectedCityName}
        <div class="nav-divider">/</div>
        <!-- City is last active - NO dropdown (cities never have subdivisions) -->
        <button
          class="nav-chip active"
          onclick={() => {}}
        >
          {selectedCityName}
        </button>
      {/if}
    </div>
    
    <!-- Search input overlay outside nav-minimal (appears above everything) -->
    {#if showSearch}
      <div class="nav-search-overlay">
        <svg class="nav-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="search"
          class="nav-search-input-full"
          placeholder={navigationManager?.getCurrentLevel() === 'world' ? 'Buscar país...' : 'Buscar región...'}
          bind:value={tagQuery}
          bind:this={searchInput}
          onclick={(e) => e.stopPropagation()}
          onpointerdown={(e) => e.stopPropagation()}
          ontouchstart={(e) => e.stopPropagation()}
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
              searchInput?.focus({ preventScroll: true });
            }}
            aria-label="Limpiar texto"
          >
            Limpiar
          </button>
        {/if}
        <button
          class="nav-search-close-btn"
          onclick={onToggleSearch}
          aria-label="Cerrar búsqueda"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                class="search-result-item"
                onclick={() => selectSearchResult(result)}
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
                    {@const parts = result.id.split('.')}
                    {@const hasLevel3 = parts.length === 3}
                    {#if hasLevel3}
                      <!-- Nivel 3: Mostrar jerarquía completa -->
                      <span class="hierarchy">
                        <span class="hierarchy-separator">→</span>
                        <span class="hierarchy-subdivision">{result.parentName || 'Subdivisión'}</span>
                        <span class="hierarchy-separator">→</span>
                        <span class="hierarchy-city">{result.name}</span>
                      </span>
                    {:else}
                      <!-- Nivel 2: Mostrar país y subdivisión -->
                      <span class="hierarchy">
                        <span class="hierarchy-separator">→</span>
                        <span class="hierarchy-subdivision">{result.name}</span>
                      </span>
                    {/if}
                  {:else}
                    <!-- País: Solo nombre -->
                    {result.name}
                  {/if}
                </span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
    
    <!-- Search button and options menu grouped (only when search is closed) -->
    {#if !showSearch}
      <div class="nav-buttons-group">
        <!-- Expandable icon buttons (appear to the left) -->
        {#if showOptionsMenu}
          <button
            class="nav-icon-btn icon-expand"
            onclick={() => { onLocateMe(); showOptionsMenu = false; }}
            title="Mi ubicación"
            aria-label="Mi ubicación"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </button>
          <button
            class="nav-icon-btn icon-expand"
            onclick={() => { 
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
              showOptionsMenu = false;
            }}
            title={fullscreenActive ? "Salir de pantalla completa" : "Pantalla completa"}
            aria-label={fullscreenActive ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              {#if fullscreenActive}
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              {:else}
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              {/if}
            </svg>
          </button>
        {/if}
        
        <!-- Menu button (3 dots) - only show when menu is closed -->
        {#if !showOptionsMenu}
          <button
            class="nav-icon-btn"
            onclick={(e) => {
              e.stopPropagation();
              showOptionsMenu = !showOptionsMenu;
            }}
            aria-label="Menú de opciones"
            aria-expanded={showOptionsMenu}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="19" r="2"></circle>
            </svg>
          </button>
        {/if}
        
        <button
          class="nav-icon-btn"
          onclick={onToggleSearch}
          aria-label="Buscar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Opciones de votación como mosaico horizontal estilo Google Maps -->
  {#if state === 'expanded'}
    <!-- Contenedor scrolleable que incluye TODO cuando está expandido -->
    <div 
      class="main-scroll-container vote-cards-grid" 
      onscroll={handlePollScroll}
      onpointerdown={onPointerDown}
      ontouchstart={onPointerDown}
      bind:this={scrollContainer}
    >
      
      <!-- PRIORIDAD 1: Si hay encuesta activa (activePoll), mostrarla PRIMERO -->
      {#if activePoll && activePoll.id && voteOptions.length > 0}
        {@const mainPollId = activePoll.id.toString()}
        <SinglePollSection
          poll={activePoll}
          pollIndex={-1}
          {state}
          activeAccordionIndex={activeAccordionMainIndex}
          currentPage={currentPageMain}
          {userVotes}
          {multipleVotes}
          {voteEffectActive}
          {voteEffectPollId}
          {displayVotes}
          {voteClickX}
          {voteClickY}
          {voteIconX}
          {voteIconY}
          {voteEffectColor}
          pollTitleExpanded={{}}
          pollTitleTruncated={{}}
          pollTitleElements={{}}
          on:optionClick={(e: any) => {
            const { event, optionKey, pollId, optionColor } = e.detail;
            voteClickX = event.clientX;
            voteClickY = event.clientY;
            voteEffectColor = optionColor || '#10b981';
            if (activePoll.type === 'multiple') {
              handleMultipleVote(optionKey, pollId);
            } else {
              handleVote(optionKey);
            }
          }}
          on:setActive={(e: any) => activeAccordionMainIndex = e.detail.index}
          on:pageChange={(e: any) => {
            transitionDirectionMain = e.detail.page < currentPageMain ? 'prev' : 'next';
            currentPageMain = e.detail.page;
            (async () => {
              await delay(50);
              activeAccordionMainIndex = null; // Mantener opciones plegadas al cambiar página
              await delay(350);
              transitionDirectionMain = null;
            })();
          }}
          on:confirmMultiple={(e: any) => confirmMultipleVotes(e.detail.pollId)}
          on:addOption={(e: any) => addNewCollaborativeOption(e.detail.pollId, e.detail.previewColor)}
          on:openColorPicker={(e: any) => {
            colorPickerOpenFor = { pollId: e.detail.pollId, optionKey: e.detail.optionKey };
          }}
          on:cancelEditing={(e: any) => {
            const { pollId, optionKey } = e.detail;
            const poll = pollId === activePoll?.id.toString() ? activePoll : additionalPolls.find(p => p.id.toString() === pollId);
            if (poll) {
              poll.options = poll.options.filter((opt: any) => opt.key !== optionKey);
              delete pendingCollaborativeOption[pollId];
              delete editingOptionColors[optionKey];
              if (pollId === activePoll?.id.toString()) {
                activePoll = { ...activePoll };
              } else {
                additionalPolls = [...additionalPolls];
              }
            }
          }}
          on:clearVote={(e: any) => {
            clearUserVote(e.detail.pollId);
          }}
          on:dragStart={(e: any) => handleDragStart(e.detail.event)}
          on:publishOption={(e: any) => handlePublishOption(e.detail.pollId, e.detail.optionKey, e.detail.label, e.detail.color)}
          on:goToChart={(e) => {
            const pollId = e.detail.pollId;
            goToChartView(pollId);
          }}
          on:openPreviewModal={handleOpenPreviewModal}
        />
        
        <!-- Separador después de encuesta activa -->
        <div class="more-polls-divider">
          <div class="divider-line"></div>
          <span class="divider-text">Trending en {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
          <div class="divider-line"></div>
        </div>
      {/if}
      
      <!-- PRIORIDAD 2: Mostrar TRENDING (solo si NO hay encuesta activa O después de mostrarla) -->
      {#if filteredTrendingPolls.length > 0}
        <TrendingPollsSection
          trendingPolls={filteredTrendingPolls}
          {selectedCountryName}
          {selectedSubdivisionName}
          {currentPageMain}
          trendingTransitionDirection={trendingTransitionDirection}
          {mainPollViews}
          showActivePoll={!!(activePoll && activePoll.id)}
          TRENDING_PER_PAGE={TRENDING_PER_PAGE}
          hasMorePolls={additionalPolls.length > 0}
          on:openPoll={(e) => openTrendingPoll(e.detail.poll)}
          on:pollOptions={(e) => openPollOptionsModal(e.detail.poll)}
          on:pageChange={(e) => {
            currentPageMain = e.detail.page;
            trendingTransitionDirection = e.detail.direction;
            (async () => {
              await delay(300);
              trendingTransitionDirection = null;
            })();
          }}
        />
      {/if}
      
      <!-- Encuestas adicionales usando componentes modularizados -->
      {#each filteredAdditionalPolls as poll, pollIndex (poll.id ?? `poll-${pollIndex}`)}
        
        <!-- Insertar anuncios cada 3 encuestas -->
        {#if pollIndex === 2}
          <AdCard 
            title="VoteTok Premium"
            description="Accede a encuestas exclusivas y anÃ¡lisis detallados"
            ctaText="Probar gratis"
            imageUrl="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&h=200&fit=crop"
            isSponsored={true}
          />
        {/if}

        <!-- Insertar sección "A quien seguir" después de la 5ta encuesta -->
        {#if pollIndex === 5 && pollIndex < additionalPolls.length - 2 && userSuggestions.length > 0}
          <WhoToFollowSection {userSuggestions} />
        {/if}
        
        <!-- Renderizar encuesta con componente -->
        <SinglePollSection
          {poll}
          {pollIndex}
          {state}
          activeAccordionIndex={activeAccordionByPoll[poll.id] ?? null}
          currentPage={currentPageByPoll[poll.id] ?? 0}
          {userVotes}
          {multipleVotes}
          {pollTitleExpanded}
          {pollTitleTruncated}
          {pollTitleElements}
          {voteEffectActive}
          {voteEffectPollId}
          {displayVotes}
          {voteClickX}
          {voteClickY}
          {voteIconX}
          {voteIconY}
          {voteEffectColor}
          on:optionClick={(e) => {
            const { event, optionKey, pollId, optionColor } = e.detail;
            voteClickX = event.clientX;
            voteClickY = event.clientY;
            voteEffectColor = optionColor || '#10b981';
            if (poll.type === 'multiple') {
              handleMultipleVote(optionKey, pollId);
            } else {
              handleVote(optionKey, pollId);
            }
          }}
          on:setActive={(e) => setActiveForPoll(e.detail.pollId, e.detail.index)}
          on:confirmMultiple={(e) => confirmMultipleVotes(e.detail.pollId)}
          on:addOption={(e) => addNewCollaborativeOption(e.detail.pollId, e.detail.previewColor)}
          on:openColorPicker={(e) => {
            colorPickerOpenFor = { pollId: e.detail.pollId, optionKey: e.detail.optionKey };
          }}
          on:cancelEditing={(e) => {
            const { pollId, optionKey } = e.detail;
            const poll = pollId === activePoll?.id.toString() ? activePoll : additionalPolls.find(p => p.id.toString() === pollId);
            if (poll) {
              poll.options = poll.options.filter((opt: any) => opt.key !== optionKey);
              delete pendingCollaborativeOption[pollId];
              delete editingOptionColors[optionKey];
              if (pollId === activePoll?.id.toString()) {
                activePoll = { ...activePoll };
              } else {
                additionalPolls = [...additionalPolls];
              }
            }
          }}
          on:openInGlobe={(e) => openAdditionalPollInGlobe(e.detail.poll)}
          on:dragStart={(e) => handleDragStart(e.detail.event, e.detail.pollId)}
          on:clearVote={(e) => {
            clearUserVote(e.detail.pollId);
          }}
          on:pageChange={(e) => {
            const pollId = e.detail.pollId;
            const newPage = e.detail.page;
            currentPageByPoll = { ...currentPageByPoll, [pollId]: newPage };
            
            const sortedOptions = getNormalizedOptions(poll).sort((a, b) => b.pct - a.pct);
            const newPageOptions = getPaginatedOptions(sortedOptions, newPage);
            
            if (newPageOptions.items.length > 0) {
              activeAccordionByPoll[pollId] = null; // Mantener plegadas al cambiar página
            }
          }}
          on:publishOption={(e: any) => handlePublishOption(e.detail.pollId, e.detail.optionKey, e.detail.label, e.detail.color)}
          on:goToChart={(e) => goToChartView(e.detail.pollId)}
          on:openPreviewModal={handleOpenPreviewModal}
        />
      {/each} 

      <!-- Indicador de carga solo cuando estÃ¡ cargando -->
      {#if isLoadingPolls}
        <div class="loading-more">
          <div class="loading-spinner"></div>
          <span>Cargando más encuestas...</span>
        </div>
      {/if}
      
      <!-- Mensaje cuando no hay más encuestas -->
      {#if !hasMorePolls && additionalPolls.length > 0}
        <div class="no-more-polls">
          <h4>¡Has llegado al final!</h4>
          <p>Ya has visto todas las encuestas disponibles</p>
          <button class="refresh-btn" onclick={() => window.location.reload()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Actualizar
          </button>
        </div>
      {/if}
      
    </div> <!-- Cierre de main-scroll-container -->
  {/if}
  
  <!-- Mostrar contenido cuando NO estÃ¡ expandido o no hay voteOptions -->
  {#if state !== 'expanded'}
    <div 
      class="sheet-content" 
      onscroll={onScroll}
      onpointerdown={onPointerDown}
      ontouchstart={onPointerDown}
    >
      <!-- Pista de arrastre simplificada -->
      <div class="floating-indicators-content">
      </div>

      <!-- Pista debajo: flecha hacia arriba + texto contextual -->
      <div 
        class="floating-hint-row" 
        role="button" 
        tabindex="0"
        onclick={() => dispatch('requestExpand')}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch('requestExpand'); } }}
        aria-label={'Ver más de ' + hintTarget}
      >
        <span class="floating-hint-arrow">▲</span>
        <span class="floating-hint-text">Ver más de {hintTarget}</span>
      </div>
    </div>
  {/if}
  
  <!-- BotÃ³n flotante "volver al inicio" -->
  {#if showScrollToTop && state === 'expanded'}
    <button
      class="scroll-to-top-btn"
      onclick={scrollToTop}
      aria-label="Volver al inicio"
      title="Volver al inicio"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
    </button>
  {/if}

  <!-- Modal de opciones de encuesta -->
  {#if showPollOptionsModal && selectedPollForOptions}
    <div class="poll-options-overlay" 
         onclick={closePollOptionsModal}
         onkeydown={(e) => { if (e.key === 'Escape') closePollOptionsModal(); }}
         role="button"
         tabindex="0"
         aria-label="Close modal">
      <div class="poll-options-modal" 
           style="transform: translateY({modalCurrentY}px)"
           onclick={(e) => e.stopPropagation()}
           onkeydown={(e) => e.stopPropagation()}
           role="dialog"
           tabindex="-1"
           ontouchstart={handleModalTouchStart}
           ontouchmove={handleModalTouchMove}
           ontouchend={handleModalTouchEnd}>
        <!-- Barra de arrastre -->
        <div class="modal-drag-handle"></div>
        
        <div class="poll-options-header">
          <div class="poll-options-title">
            <h3>{selectedPollForOptions.title}</h3>
            <p>Por {selectedPollForOptions.user?.displayName || 'Anónimo'}</p>
          </div>
        </div>
        <div class="poll-options-list">
          <button class="poll-option-item" onclick={() => { openTrendingPoll(selectedPollForOptions); closePollOptionsModal(); }} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            Ver encuesta completa
          </button>
          <button class="poll-option-item" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            Guardar para después
          </button>
          <button class="poll-option-item" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Compartir encuesta
          </button>
          <button class="poll-option-item" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Copiar enlace
          </button>
          <button class="poll-option-item" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            Seguir a {selectedPollForOptions.user?.displayName || 'usuario'}
          </button>
          <button class="poll-option-item" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Activar notificaciones
          </button>
          <button class="poll-option-item" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
            No me interesa
          </button>
          <button class="poll-option-item poll-option-danger" onclick={closePollOptionsModal} type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Reportar encuesta
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modal fullscreen de preview FUERA del BottomSheet -->
{#if showPreviewModal && previewModalOption && previewModalPoll}
  <PollMaximizedView
    options={previewModalOption}
    bind:activeOptionId={previewModalOptionIndex}
    pollTitle={previewModalPoll.question || previewModalPoll.title || 'Encuesta'}
    creator={{
      username: previewModalPoll.creator?.username || previewModalPoll.user?.username || 'Usuario',
      avatar: previewModalPoll.creator?.avatar || previewModalPoll.user?.avatar
    }}
    stats={{
      totalVotes: previewModalPoll.stats?.totalVotes || previewModalPoll.totalVotes || 0,
      totalViews: previewModalPoll.stats?.totalViews || previewModalPoll.totalViews || 0
    }}
    readOnly={true}
    showAllOptions={previewModalShowAllOptions}
    onClose={closePreviewModal}
    onOptionChange={(optionId) => {
      previewModalOptionIndex = optionId;
      console.log('[BottomSheet] Opción cambiada a:', optionId);
    }}
    onSwipeVertical={(direction) => {
      console.log('[BottomSheet] Swipe vertical:', direction);
      if (direction === 'down') {
        // Siguiente encuesta
        navigateToNextPollWithPreview();
      } else {
        // Encuesta anterior
        navigateToPreviousPollWithPreview();
      }
    }}
    onVote={async (optionId) => {
      console.log('[BottomSheet] 🗳️ Votando desde modal preview:', optionId);
      if (!previewModalPoll) return;
      
      // Usar el handler de voto existente
      const option = previewModalOption.find((opt: any) => opt.id === optionId);
      if (option) {
        await handleVote(option.id, previewModalPoll.id.toString());
        
        // Esperar a que se actualice el estado y recargar modal
        setTimeout(async () => {
          // Recargar la encuesta desde el servidor para obtener datos actualizados
          try {
            const response = await apiCall(`/api/polls/${previewModalPoll.id}`);
            if (response.ok) {
              const updatedPollData = await response.json();
              const updatedPoll = updatedPollData.data || updatedPollData;
              
              // Actualizar la encuesta en el estado
              if (activePoll && activePoll.id === updatedPoll.id) {
                activePoll = updatedPoll;
              } else {
                const index = additionalPolls.findIndex(p => p.id === updatedPoll.id);
                if (index !== -1) {
                  additionalPolls[index] = updatedPoll;
                }
              }
              
              // Reabrir el modal con datos actualizados
              handleOpenPreviewModal({
                detail: { option, pollId: previewModalPoll.id.toString() }
              } as CustomEvent);
            }
          } catch (error) {
            console.error('[BottomSheet] Error recargando encuesta:', error);
          }
        }, 300);
      }
    }}
    onOpenInGlobe={() => {
      console.log('[BottomSheet] 🌍 Abrir en mapa desde modal');
      if (previewModalPoll) {
        openAdditionalPollInGlobe(previewModalPoll);
        closePreviewModal();
      }
    }}
    onShare={() => {
      console.log('[BottomSheet] 📤 Compartir desde modal');
      // TODO: Implementar compartir
      if (navigator.share && previewModalPoll) {
        navigator.share({
          title: previewModalPoll.question || previewModalPoll.title,
          text: 'Mira esta encuesta en VoteTok',
          url: window.location.origin + '/?poll=' + previewModalPoll.id
        }).catch(err => console.log('Error sharing:', err));
      }
    }}
    onBookmark={() => {
      console.log('[BottomSheet] 🔖 Guardar desde modal');
      // TODO: Implementar guardar
    }}
    onRepost={() => {
      console.log('[BottomSheet] 🔄 Republicar desde modal');
      // TODO: Implementar republicar
    }}
  />
{/if}

<!-- Modal del selector de color para opciones colaborativas -->
{#if colorPickerOpenFor}
    {@const selectedColor = `hsl(${selectedHue}, ${selectedSaturation}%, 55%)`}
    <div 
      class="color-picker-overlay" 
      onclick={() => colorPickerOpenFor = null}
      onkeydown={(e) => { if (e.key === 'Escape') colorPickerOpenFor = null; }}
      role="button"
      tabindex="0"
      aria-label="Cerrar selector de color"
      style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 100000; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px);"
    >
      <div 
        class="color-picker-modal" 
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => { if (e.key === 'Escape') colorPickerOpenFor = null; }}
        role="dialog"
        aria-labelledby="color-picker-title"
        tabindex="-1"
        style="background: rgba(30, 30, 30, 0.98); padding: 32px; border-radius: 20px; max-width: 400px; width: 90%;"
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
          <h3 id="color-picker-title" style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Selecciona un color</h3>
          <button onclick={() => colorPickerOpenFor = null} type="button" aria-label="Cerrar" style="background: rgba(255,255,255,0.1); border: none; border-radius: 8px; padding: 8px; color: white; cursor: pointer;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <!-- Círculo de colores -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 24px;">
          <div 
            role="slider"
            aria-label="Selector de color"
            aria-valuenow={selectedHue}
            aria-valuemin="0"
            aria-valuemax="360"
            tabindex="0"
            style="width: 300px; height: 300px; border-radius: 50%; position: relative; cursor: pointer; box-shadow: 0 8px 32px rgba(0,0,0,0.4); background: conic-gradient(from 0deg, hsl(0, 100%, 50%), hsl(30, 100%, 50%), hsl(60, 100%, 50%), hsl(90, 100%, 50%), hsl(120, 100%, 50%), hsl(150, 100%, 50%), hsl(180, 100%, 50%), hsl(210, 100%, 50%), hsl(240, 100%, 50%), hsl(270, 100%, 50%), hsl(300, 100%, 50%), hsl(330, 100%, 50%), hsl(360, 100%, 50%));"
            onmousedown={(e) => {
              isDraggingColor = true;
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const deltaX = e.clientX - centerX;
              const deltaY = e.clientY - centerY;
              const angle = Math.atan2(deltaY, deltaX);
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              const maxDistance = rect.width / 2;
              selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
              selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
            }}
            onmousemove={(e) => {
              if (isDraggingColor) {
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const deltaX = e.clientX - centerX;
                const deltaY = e.clientY - centerY;
                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const maxDistance = rect.width / 2;
                selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
                selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
              }
            }}
            onmouseup={() => isDraggingColor = false}
            onmouseleave={() => isDraggingColor = false}
            ontouchstart={(e) => {
              isDraggingColor = true;
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const deltaX = touch.clientX - centerX;
              const deltaY = touch.clientY - centerY;
              const angle = Math.atan2(deltaY, deltaX);
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              const maxDistance = rect.width / 2;
              selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
              selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
            }}
            ontouchmove={(e) => {
              if (isDraggingColor) {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const deltaX = touch.clientX - centerX;
                const deltaY = touch.clientY - centerY;
                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const maxDistance = rect.width / 2;
                selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
                selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
              }
            }}
            ontouchend={() => isDraggingColor = false}
          >
            <!-- Gradiente radial para saturación -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, white 0%, transparent 100%); pointer-events: none;"></div>
            
            <!-- Indicador de color seleccionado -->
            <div 
              style="position: absolute; top: 50%; left: 50%; width: 40px; height: 40px; border-radius: 50%; background: {selectedColor}; border: 4px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.5); transform: translate(-50%, -50%) rotate({selectedHue}deg) translateY({-selectedSaturation * 1.4}px); pointer-events: none;"
            ></div>
          </div>
          
          <!-- Botón confirmar -->
          <button
            onclick={() => {
              if (!colorPickerOpenFor) return;
              const { pollId, optionKey } = colorPickerOpenFor;
              const poll = pollId === activePoll?.id.toString() ? activePoll : additionalPolls.find(p => p.id.toString() === pollId);
              if (poll) {
                const option = poll.options.find((opt: any) => opt.key === optionKey);
                if (option) {
                  // Convertir HSL a hex
                  const h = selectedHue;
                  const s = selectedSaturation / 100;
                  const l = 0.55;
                  const c = (1 - Math.abs(2 * l - 1)) * s;
                  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
                  const m = l - c/2;
                  let r = 0, g = 0, b = 0;
                  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
                  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
                  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
                  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
                  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
                  else { r = c; g = 0; b = x; }
                  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
                  const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                  
                  option.color = hexColor;
                  editingOptionColors[optionKey] = hexColor;
                  
                  if (pollId === activePoll?.id.toString()) {
                    activePoll = { ...activePoll };
                  } else {
                    additionalPolls = [...additionalPolls];
                  }
                }
              }
              colorPickerOpenFor = null;
            }}
            type="button"
            style="width: 100%; padding: 16px; background: {selectedColor}; color: white; border: none; border-radius: 16px; font-weight: 600; font-size: 16px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s;"
            onmouseenter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onmouseleave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Seleccionar Color
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal de Autenticación -->
  <AuthModal bind:isOpen={showAuthModal} on:login={handleAuthComplete} />

  <style>
    /* Los estilos ya están importados globalmente en el <script> */
    
    /* Estilos para el badge del país en resultados de búsqueda */
    :global(.search-result-item) {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
    }
    
    :global(.result-name) {
      flex: 1;
    }
    
    :global(.hierarchy) {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    
    :global(.hierarchy-country) {
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
      font-weight: 500;
    }
    
    :global(.hierarchy-separator) {
      color: rgba(255, 255, 255, 0.3);
      font-size: 11px;
    }
    
    :global(.hierarchy-subdivision) {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 500;
    }
    
    :global(.hierarchy-city) {
      color: rgba(255, 255, 255, 0.95);
      font-size: 13px;
      font-weight: 600;
    }
    
    :global(.result-country) {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.3px;
      border: 1px solid rgba(59, 130, 246, 0.3);
      white-space: nowrap;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
