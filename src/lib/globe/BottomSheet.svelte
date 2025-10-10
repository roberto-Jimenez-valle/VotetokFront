<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import '$lib/styles/trending-ranking.css';
  import type { Poll } from './types';

  // Helper para reemplazar setTimeout con Promesas
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const nextTick = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
  
  // Avatar por defecto como data URI para evitar 404
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  
  // Estado de acordeón full-width (sin scroll): índice activo por grid
  let activeAccordionMainIndex: number | null = null;
  const activeAccordionByPoll: Record<string, number | null> = {};
  let lastMainOptionsSignature = '';
  const pollOptionSignatures: Record<string, string> = {};
  
  // Estado de expansión de títulos de encuestas
  const pollTitleExpanded: Record<string, boolean> = {};
  const pollTitleTruncated: Record<string, boolean> = {};
  const pollTitleElements: Record<string, HTMLElement> = {};
  
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
  const transitionDirectionByPoll: Record<string, 'next' | 'prev' | null> = {};

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

  // Helper para cargar datos históricos desde API
  async function loadHistoricalData(pollId: number, days: number) {
    try {
      const response = await fetch('/api/polls/' + pollId + '/history?days=' + days);
      if (!response.ok) throw new Error('Failed to load history');
      const { data } = await response.json();
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
      const response = await fetch('/api/users/suggestions?limit=8');
      if (!response.ok) throw new Error('Failed to load suggestions');
      const { data } = await response.json();
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
    // Si hay encuesta activa, no cargar trending (GlobeGL lo maneja)
    if (activePoll && activePoll.id) {
      trendingPollsData = [];
      return;
    }
    
    try {
      const currentRegion = selectedCountryName || selectedSubdivisionName || selectedCityName || 'Global';
      
      // Limitar a 12 encuestas trending (3 páginas de 4)
      const response = await fetch(`/api/polls/trending-by-region?region=${encodeURIComponent(currentRegion)}&limit=12&hours=168`);
      if (!response.ok) throw new Error('Failed to load trending polls');
      const { data } = await response.json();
      
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
      const response = await fetch('/api/polls?page=' + page + '&limit=10');
      if (!response.ok) throw new Error('Failed to load polls');
      const { data, pagination } = await response.json();
      
      // Verificar si hay más páginas
      hasMorePolls = pagination.page < pagination.totalPages;
      
      // Transformar datos de la API al formato esperado
      const transformedPolls: Poll[] = await Promise.all(data.map(async (poll: any) => {
                
        // Cargar amigos que votaron en esta encuesta
        let friendsByOption = {};
        try {
          const friendsResponse = await fetch('/api/polls/' + poll.id + '/friends-votes?userId=' + currentUserId);
          if (friendsResponse.ok) {
            const friendsData = await friendsResponse.json();
            friendsByOption = friendsData.data || {};
                      }
        } catch (e) {
          console.error('Error loading friends votes:', e);
        }

        const transformed = {
          id: poll.id.toString(),
          question: poll.title,
          type: poll.type || 'poll',
          region: selectedCountryName || selectedSubdivisionName || selectedCityName || 'Global',
          options: poll.options.map((opt: any) => ({
            key: opt.optionKey,
            label: opt.optionLabel,
            color: opt.color,
            votes: opt.voteCount,
            avatarUrl: opt.avatarUrl
          })),
          totalVotes: poll.totalVotes || 0,
          totalViews: poll.totalViews || 0,
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
      
      // Agregar polls sin causar re-renders múltiples
      additionalPolls = [...additionalPolls, ...transformedPolls];
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
    activeAccordionByPoll[pollId] = 0;
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
  
  // Función para hacer scroll a la card activa y centrarla
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
    
    // Detectar si es un movimiento horizontal (más horizontal que vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      isDragging = true;
      
      // No prevenir el scroll en grids con clase 'dense' (muchas opciones)
      if (!currentDragGrid.classList.contains('dense')) {
        e.preventDefault();
      }
      
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
            const totalPages = Math.ceil(sortedDisplayOptions.length / OPTIONS_PER_PAGE);
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
  export let selectedCountryName: string | null = null;
  export let selectedSubdivisionName: string | null = null;
  export let selectedCityName: string | null = null;
  export let countryChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let subdivisionChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let worldChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let cityChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let voteOptions: Array<{ key: string; label: string; color: string; votes: number; pollData?: any }> = [];
  export let legendItems: Array<{ key: string; color: string; count: number }> = [];
  export let activePoll: any = null;
  // Estadísticas de la encuesta principal
  export let mainPollViews: number = 0;
  export let mainPollSaves: number = 0;
  export let mainPollShares: number = 0;
  export let mainPollReposts: number = 0;
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
  export const navigationManager: any = null; // Used by parent component
  export let onNavigateToView: (level: 'world' | 'country' | 'subdivision' | 'city') => void = () => {};
  export let onVote: (optionKey: string) => void = () => {};
  export let currentAltitude: number = 0; // Altitud actual del globo
  export let onLocateMe: () => void = () => {};
  export let onToggleSettings: () => void = () => {};
  
  // Array de encuestas adicionales para scroll infinito
  export let additionalPolls: Poll[] = [];
  export const onLoadMorePolls: () => void = () => {};
  
  // Dropdown toggle function
  export let onToggleDropdown: () => void = () => {};
  
  // Estado del botón "volver al inicio"
  let showScrollToTop = false;
  let scrollContainer: HTMLElement;
  
  // Search props
  export let showSearch: boolean = false;
  export let tagQuery: string = '';
  export let onToggleSearch: () => void = () => {};
  
  // Search results for countries/subdivisions
  let searchResults: Array<{ id: string; name: string; iso?: string; type: 'country' | 'subdivision' }> = [];
  let isSearching = false;

  // Texto de ayuda bajo los botones: ciudad > subdivisión > país > Global
  $: hintTarget = selectedCityName || selectedSubdivisionName || selectedCountryName || 'Global';

  // Aproximación de escala en kilómetros basada en altitud actual del globo
  function getScaleKm(alt: number): number {
    // Mapa heurístico sencillo para una barra de ~60px
    if (alt >= 3.0) return 4000;
    if (alt >= 2.0) return 2000;
    if (alt >= 1.0) return 1000;
    if (alt >= 0.6) return 500;
    if (alt >= 0.3) return 200;
    if (alt >= 0.15) return 100;
    if (alt >= 0.08) return 50;
    return 20;
  }
  $: scaleKm = getScaleKm(currentAltitude ?? 0);
  const numberFmt = new Intl.NumberFormat('es-ES');
  
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
    if (!query || query.trim().length < 2) {
      searchResults = [];
      return;
    }
    
            
    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Debounce search usando Promise
    searchDebounceTimer = setTimeout(async () => {
      isSearching = true;
      const results = [] as Array<{ id: string; name: string; iso?: string; type: 'country' | 'subdivision' }>;
      const lowerQuery = query.toLowerCase().trim();
      
      try {
        // Get available options from navigation manager
        if (navigationManager) {
                    const options = await navigationManager.getAvailableOptions();
                    
          // Filter options based on query
          for (const option of options) {
            if (option.name.toLowerCase().includes(lowerQuery)) {
              const currentLevel = navigationManager.getCurrentLevel();
              results.push({
                id: option.id,
                name: option.name,
                iso: option.iso,
                type: currentLevel === 'world' ? 'country' : 'subdivision'
              });
            }
          }
          
                  } else {
          console.warn('[Search] NavigationManager not available');
        }
        
        // Sort by relevance (starts with query first)
        results.sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
          const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.name.localeCompare(b.name);
        });
        
        searchResults = results.slice(0, 20); // Limit to 20 results
              } catch (error) {
        console.error('[Search] Error searching:', error);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 300);
  }
  
  // Function to select a search result
  async function selectSearchResult(result: { id: string; name: string; iso?: string; type: 'country' | 'subdivision' }) {
        
    // Close search
    tagQuery = '';
    searchResults = [];
    onToggleSearch();
    
    // Dispatch event to parent to handle navigation
    const option = { id: result.id, name: result.name, iso: result.iso };
        const event = new CustomEvent('searchSelect', { detail: option });
    window.dispatchEvent(event);
  }

  const dispatch = createEventDispatcher<{
    openPollInGlobe: { poll: Poll | null; options: Array<{ key: string; label: string; color: string; votes: number }> };
    vote: { option: string; pollId?: string };
    requestExpand: void;
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
  
  // Estado de expansión de la barra de opciones
  let showPollOptionsExpanded = false;
  
  // Variables para detectar swipe en opciones expandidas
  let optionsTouchStartY = 0;
  let optionsScrollTop = 0;
  let isScrollingOptions = false;
  let optionsScrollElement: HTMLElement | null = null;
  let optionsTouchMoved = false;
  let optionsSwipeThreshold = 30; // Umbral para considerar un swipe deliberado
  
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
    // NO cargar additionalPolls al inicio - solo cuando el usuario haga scroll
    // loadAdditionalPolls(1);
    
    // Detectar cambios de pantalla completa
    const handleFullscreenChange = () => {
      fullscreenActive = !!document.fullscreenElement;
    };
    
    // Manejar clicks globales para cerrar acordeones
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedCard = target.closest('.vote-card');
      
      // Si el click no es en una vote-card, cerrar acordeones
      if (!clickedCard) {
        activeAccordionMainIndex = null;
        Object.keys(activeAccordionByPoll).forEach(key => {
          activeAccordionByPoll[key] = null;
        });
      }
      // Si el click es en una vote-card, no hacer nada (dejar que el onclick de la card lo maneje)
    };
    
    // Manejar tecla Escape para cerrar acordeones
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activeAccordionMainIndex = null;
        Object.keys(activeAccordionByPoll).forEach(key => {
          activeAccordionByPoll[key] = null;
        });
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
    document.addEventListener('pointermove', handleGlobalMove);
    document.addEventListener('touchmove', handleGlobalMove);
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

  // Opciones derivadas de los segments (normalizadas a 100%)
  $: displayOptions = (() => {
    const segs = activeSegments || [];
    const values = segs.map(s => Number(s.pct) || 0);
    const norm = normalizeTo100(values);
    return segs.map((s, i) => ({
      key: s.key,
      label: s.key,
      color: s.color,
      pct: norm[i]
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
  $: sortedDisplayOptions = trendingPolls; // Alias para compatibilidad con código existente
  // Solo paginar si hay MÁS de 4 encuestas (no repetir si hay menos)
  $: shouldPaginateMain = trendingPolls.length > TRENDING_PER_PAGE;
  $: paginatedMainOptions = shouldPaginateMain 
    ? getPaginatedOptions(trendingPolls, currentPageMain, TRENDING_PER_PAGE)
    : { items: trendingPolls, totalPages: 1, hasNext: false, hasPrev: false };
  
  // Dirección de transición para trending
  let trendingTransitionDirection: 'next' | 'prev' | null = null;
  

  $: {
    const signature = displayOptions.length > 1 ? displayOptions.map(option => option.key).join('|') : '';
    if (signature) {
      if (signature !== lastMainOptionsSignature) {
        lastMainOptionsSignature = signature;
        activeAccordionMainIndex = 0;
        currentPageMain = 0; // Resetear página cuando cambian opciones
      }
    } else if (lastMainOptionsSignature) {
      lastMainOptionsSignature = '';
      activeAccordionMainIndex = null;
      currentPageMain = 0;
    }
  }

  $: if (displayOptions.length > 1 && activeAccordionMainIndex == null) {
    setActiveMain(0);
  }

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
          activeAccordionByPoll[poll.id] = 0;
          currentPageByPoll[poll.id] = 0; // Resetear página cuando cambian opciones
        }
      } else if (options.length > 1 && activeAccordionByPoll[poll.id] == null) {
        activeAccordionByPoll[poll.id] = 0;
      } else {
        if (pollOptionSignatures[poll.id]) {
          delete pollOptionSignatures[poll.id];
        }
        activeAccordionByPoll[poll.id] = null;
        currentPageByPoll[poll.id] = 0;
      }
    }
  }

  $: {
    for (const poll of additionalPolls) {
      const options = getNormalizedOptions(poll);
      if (options.length > 1 && activeAccordionByPoll[poll.id] == null) {
        setActiveForPoll(poll.id, 0);
      }
      // Resetear página si no está inicializada
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
  function handleVote(optionKey: string, pollId?: string) {
    // Si es la encuesta principal (trending), abrir la encuesta específica
    if (!pollId && voteOptions.length > 0) {
      const option = voteOptions.find((o: any) => o.key === optionKey);
      if (option?.pollData) {
                // Abrir la encuesta específica
        openTrendingPoll(option.pollData);
        return;
      }
    }
    
    if (pollId) {
      dispatch('vote', { option: optionKey, pollId });
    } else {
      onVote(optionKey);
      dispatch('vote', { option: optionKey });
    }
  }
  
  // Función para abrir una encuesta trending específica
  function openTrendingPoll(pollData: any) {
    // Transformar la encuesta a formato Poll y agregarla al inicio de additionalPolls
    const transformedPoll = {
      id: pollData.id.toString(),
      question: pollData.title,
      type: pollData.type || 'poll',
      region: selectedCountryName || selectedSubdivisionName || selectedCityName || 'Global',
      options: pollData.options.map((opt: any) => ({
        key: opt.optionKey,
        label: opt.optionLabel,
        color: opt.color,
        votes: opt.voteCount,
        avatarUrl: opt.avatarUrl
      })),
      totalVotes: pollData.totalVotes || 0,
      totalViews: pollData.totalViews || 0,
      creator: pollData.user ? {
        id: pollData.user.id.toString(),
        name: pollData.user.displayName,
        handle: pollData.user.username,
        avatarUrl: pollData.user.avatarUrl,
        verified: pollData.user.verified
      } : undefined,
      publishedAt: pollData.createdAt,
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
          }
    
    const target = e.target as HTMLElement;
    if (target) {
      const scrollTop = target.scrollTop || 0;
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      
      // Mostrar el botón si ha scrolleado más de 200px
      showScrollToTop = scrollTop > 200;
      
      // Si estamos a menos de 400px del final y no estamos cargando, cargar más
      if (scrollBottom < 400 && !isLoadingPolls && hasMorePolls) {
        loadAdditionalPolls(currentPollsPage + 1);
      }
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
      {@const totalCount = legendItems.reduce((sum, item) => sum + item.count, 0)}
      {@const barSegments = legendItems.map(item => ({
        key: item.key,
        label: item.key,
        color: item.color,
        votes: item.count,
        pct: totalCount > 0 ? (item.count / totalCount) * 100 : 0
      }))}
      
      <!-- Para las OPCIONES EXPANDIDAS: mostrar TODAS las opciones de la encuesta -->
      {@const legendMap = Object.fromEntries(legendItems.map(item => [item.key, item.count]))}
      {@const optionsWithPct = voteOptions.map(opt => {
        const count = legendMap[opt.key] || 0;
        const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
        
       
        
        return {
          key: opt.key,
          label: opt.label || opt.key,
          color: opt.color,
          votes: count,
          pct: pct,
          displayText: count > 0 ? `${count} ${count === 1 ? 'región' : 'regiones'}` : '0 regiones',
          pollData: (opt as any).pollData,
          avatarUrl: (opt as any).avatarUrl
        };
      })}
      {@const pollTitle = activePoll?.question || activePoll?.title || 'Trending de encuestas'}
      
      <div class="poll-options-bar-container">
        <!-- Título de la encuesta o trending -->
        <div class="poll-bar-title">
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
              optionsScrollTop = target.scrollTop;
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
              const isAtTop = target.scrollTop <= 0;
              
              optionsTouchMoved = true;
              
              // Lógica simplificada:
              // 1. Si está en el top y swipe fuerte hacia arriba (>50px) → Colapsar opciones
              // 2. Cualquier otro caso → Scroll interno (SIEMPRE detener propagación)
              
              if (isAtTop && deltaY < -50) {
                // En top, swipe fuerte hacia arriba → Colapsar opciones
                showPollOptionsExpanded = false;
                              }
              
              // SIEMPRE detener propagación completamente - NO permitir arrastrar BottomSheet
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
            onpointerup={(e) => {
              e.stopPropagation();
            }}
            ontouchend={(e) => {
              isScrollingOptions = false;
              optionsTouchMoved = false;
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
          >
            {#each optionsWithPct.sort((a, b) => b.pct - a.pct) as option}
              <button 
                class="poll-bar-option-item" 
                class:is-trending-poll={!activePoll && option.pollData}
                onclick={(e) => {
                  e.stopPropagation();
                  // Si es modo trending y tiene pollData, abrir esa encuesta
                  if (!activePoll && option.pollData) {
                    openTrendingPoll(option.pollData);
                  }
                }}
              >
                <div class="poll-bar-option-info">
                  <!-- Avatar con borde de color que coincide con trending -->
                  {#if !activePoll && option.pollData}
                    <!-- Modo trending: mostrar avatar del creador de la encuesta con el color de la opción más votada -->
                    {#if option.pollData.user?.avatarUrl}
                      <img 
                        src={option.pollData.user.avatarUrl} 
                        alt={option.pollData.user.displayName || option.label} 
                        class="poll-bar-option-avatar" 
                        style="border: 3px solid {option.color};"
                      />
                    {:else if option.pollData.creator?.avatarUrl}
                      <img 
                        src={option.pollData.creator.avatarUrl} 
                        alt={option.pollData.creator.name || option.label} 
                        class="poll-bar-option-avatar" 
                        style="border: 3px solid {option.color};"
                      />
                    {:else}
                      <div class="poll-bar-option-avatar-placeholder" style="background-color: {option.color}; border: 3px solid {option.color};">
                        {option.label.charAt(0)}
                      </div>
                    {/if}
                  {:else}
                    <!-- Modo encuesta específica: mostrar avatar de la opción -->
                    {#if option.avatarUrl}
                      <img 
                        src={option.avatarUrl} 
                        alt={option.label} 
                        class="poll-bar-option-avatar" 
                        style="border: 3px solid {option.color};"
                      />
                    {:else}
                      <div class="poll-bar-option-avatar-placeholder" style="background-color: {option.color}; border: 3px solid {option.color};">
                        {option.label.charAt(0)}
                      </div>
                    {/if}
                  {/if}
                  <span class="poll-bar-option-label">{option.label}</span>
                  {#if !activePoll && option.pollData}
                    <span class="poll-bar-option-hint">👁️ Ver</span>
                  {/if}
                </div>
                <div class="poll-bar-option-stats">
                  <div class="poll-bar-option-progress-bg">
                    <div 
                      class="poll-bar-option-progress-fill" 
                      style="width: {option.pct}%; background-color: {option.color};"
                    ></div>
                  </div>
                  <span class="poll-bar-option-pct">{option.pct.toFixed(1)}%</span>
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
        
        {#if !selectedSubdivisionName}
          <!-- Country is last active - show dropdown -->
          <button
            class="nav-chip active dropdown-trigger"
            onclick={onToggleDropdown}
          >
            {selectedCountryName}
            <span style="margin-left: 4px;">▼</span>
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
        
        {#if !selectedCityName}
          <!-- Subdivision is last active - show dropdown -->
          <button
            class="nav-chip active dropdown-trigger"
            onclick={onToggleDropdown}
          >
            {selectedSubdivisionName}
            <span style="margin-left: 4px;">▼</span>
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
        <!-- City is last active - show dropdown -->
        <button
          class="nav-chip active dropdown-trigger"
          onclick={onToggleDropdown}
        >
          {selectedCityName}
          <span style="margin-left: 4px;">▼</span>
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
                <span class="result-name">{result.name}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
    
    <!-- Search button outside nav-minimal (only when search is closed) -->
    {#if !showSearch}
      <button
        class="nav-search-btn"
        onclick={onToggleSearch}
        aria-label="Buscar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
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
        {@const activeSegments = voteOptions}
        {@const sortedActiveOptions = activeSegments.sort((a, b) => b.votes - a.votes)}
        {@const shouldPaginateActive = sortedActiveOptions.length > OPTIONS_PER_PAGE}
        {@const paginatedActiveOptions = shouldPaginateActive 
          ? getPaginatedOptions(sortedActiveOptions, currentPageMain, OPTIONS_PER_PAGE)
          : { items: sortedActiveOptions, totalPages: 1, hasNext: false, hasPrev: false }}
        
        <div class="vote-cards-section active-poll-section">
          <!-- Título de la encuesta activa -->
          <div class="topic-header">
            <div class="header-with-avatar">
              <div class="header-content">
                <h3>{activePoll.question || activePoll.title || 'Encuesta'}</h3>
                <div class="topic-meta">
                  <span class="topic-type">Encuesta • {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
                  {#if activePoll.createdAt}
                    <span class="topic-time">• {getRelativeTime(Math.floor((Date.now() - new Date(activePoll.createdAt).getTime()) / 60000))}</span>
                  {/if}
                </div>
              </div>
              {#if activePoll.user?.avatarUrl}
                <div class="header-avatar header-avatar-real">
                  <img src={activePoll.user.avatarUrl} alt={activePoll.user.displayName} />
                </div>
              {:else}
                <div class="header-avatar header-avatar-real">
                  <img src={DEFAULT_AVATAR} alt="Avatar" />
                </div>
              {/if}
            </div>
          </div>
          
          <!-- Grid de opciones de la encuesta activa -->
          <div class="vote-cards-grid accordion fullwidth {activeAccordionMainIndex != null ? 'open' : ''}"
               style="--items: {paginatedActiveOptions.items.length}"
               role="group" aria-label="Opciones de encuesta activa"
               bind:this={mainGridRef}
               onpointerdown={(e) => handleDragStart(e)}
               ontouchstart={(e) => handleDragStart(e)}>
            {#each paginatedActiveOptions.items as option, index (option.key)}
              <button 
                class="vote-card {activeAccordionMainIndex === index ? 'is-active' : ''} {(state !== 'expanded' || activeAccordionMainIndex !== index) ? 'collapsed' : ''}" 
                style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, option.votes))}%; --fill-pct-val: {Math.max(0, Math.min(100, option.votes))}; --flex: {Math.max(0.5, option.votes / 10)};" 
                onclick={() => {
                  if (activeAccordionMainIndex !== index) { setActiveMain(index); return; }
                  handleVote(option.key);
                }}
                onfocus={() => setActiveMain(index)}
                onkeydown={(e) => onCardKeydown(e, option.key)}
                type="button"
              >
                <div class="card-header">
                  <h2 class="question-title">{option.label}</h2>
                  <img class="creator-avatar" src={DEFAULT_AVATAR} alt={option.label} loading="lazy" />
                </div>
                <div class="card-content">
                  <div class="percentage-display">
                    <span
                      class="percentage-large"
                      style="font-size: {(activeAccordionMainIndex === index && state === 'expanded'
                        ? fontSizeForPct(option.votes)
                        : Math.min(fontSizeForPct(option.votes), 21))}px"
                    >
                      {Math.round(option.votes)}
                    </span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
          
          {#if shouldPaginateActive}
            <div class="pagination-dots">
              {#each Array(paginatedActiveOptions.totalPages) as _, pageIndex}
                <button 
                  class="pagination-dot {pageIndex === currentPageMain ? 'active' : ''}"
                  onclick={async () => { 
                    transitionDirectionMain = pageIndex < currentPageMain ? 'prev' : 'next';
                    currentPageMain = pageIndex;
                    await delay(50);
                    activeAccordionMainIndex = 0;
                    await delay(350);
                    transitionDirectionMain = null;
                  }}
                  type="button"
                  aria-label="Bloque {pageIndex + 1}"
                ></button>
              {/each}
            </div>
          {/if}
          
          <!-- Información de la encuesta activa -->
          <div class="vote-summary-info">
            <div class="vote-stats">
              <div class="stat-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                </svg>
                <span>{formatNumber(voteOptions.length)}</span>
              </div>
              <div class="stat-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>{formatNumber(activePoll.totalViews || 0)}</span>
              </div>
            </div>
            <div class="vote-actions">
              <button class="action-badge" type="button" title="Guardar">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span>{formatNumber(mainPollSaves)}</span>
              </button>
              <button class="action-badge action-share" type="button" title="Compartir">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                <span>{formatNumber(mainPollShares)}</span>
              </button>
            </div>
          </div>
          
          <!-- Separador después de encuesta activa -->
          <div class="more-polls-divider">
            <div class="divider-line"></div>
            <span class="divider-text">Trending en {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
            <div class="divider-line"></div>
          </div>
        </div>
      {/if}
      
      <!-- PRIORIDAD 2: Mostrar TRENDING (solo si NO hay encuesta activa O después de mostrarla) -->
      {#if trendingPolls.length > 0}
        <div class="vote-cards-section">
          <!-- Título de trending (solo si NO hay encuesta activa) -->
          {#if !activePoll || !activePoll.id}
            <div class="topic-header">
              {#if selectedCountryName && selectedSubdivisionName}
                <div class="header-content">
                  <h3>Trending en {selectedSubdivisionName}</h3>
                  <div class="topic-meta">
                    <span class="topic-type">{trendingPolls.length} {trendingPolls.length === 1 ? 'encuesta' : 'encuestas'} más votadas • {selectedCountryName}</span>
                  </div>
                </div>
              {:else if selectedCountryName}
                <div class="header-content">
                  <h3>Trending en {selectedCountryName}</h3>
                  <div class="topic-meta">
                    <span class="topic-type">{trendingPolls.length} {trendingPolls.length === 1 ? 'encuesta' : 'encuestas'} más votadas • Nacional</span>
                  </div>
                </div>
              {:else}
                <div class="header-content">
                  <h3>Trending Global</h3>
                  <div class="topic-meta">
                    <span class="topic-type">{trendingPolls.length} {trendingPolls.length === 1 ? 'encuesta' : 'encuestas'} más votadas • Mundial</span>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
          
          <!-- TRENDING RANKING: Diseño profesional tipo leaderboard -->
      <div class="trending-ranking-container {trendingTransitionDirection ? 'trending-transition trending-transition-' + trendingTransitionDirection : ''}"
           bind:this={trendingGridRef}
           ontouchstart={(e) => {
             const touch = e.touches[0];
             touchStartX = touch.clientX;
             touchStartY = touch.clientY;
           }}
           ontouchmove={(e) => {
             if (touchStartX === 0) return;
             const touch = e.touches[0];
             const deltaX = touch.clientX - touchStartX;
             const deltaY = touch.clientY - touchStartY;
             
             
             // Solo si el movimiento horizontal es mayor que el vertical
             if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
               e.preventDefault(); // Prevenir scroll
               
               if (deltaX > 0 && currentPageMain > 0) {
                 trendingTransitionDirection = 'prev';
                 (async () => {
                   await delay(10);
                   currentPageMain--;
                   await delay(300);
                   trendingTransitionDirection = null;
                 })();
               } else if (deltaX < 0 && shouldPaginateMain && currentPageMain < paginatedMainOptions.totalPages - 1) {
                 trendingTransitionDirection = 'next';
                 (async () => {
                   await delay(10);
                   currentPageMain++;
                   await delay(300);
                   trendingTransitionDirection = null;
                 })();
               } else {
               }
               touchStartX = 0;
               touchStartY = 0;
             }
           }}
           ontouchend={() => { 
             touchStartX = 0; 
             touchStartY = 0;
           }}
           ontouchcancel={() => { 
             touchStartX = 0; 
             touchStartY = 0;
           }}>
        {#each paginatedMainOptions.items as option, index (option.key)}
          {@const pollData = option.pollData}
          {@const rankNumber = (currentPageMain * TRENDING_PER_PAGE) + index + 1}
          {@const rankChange = index === 0 ? 2 : index === 1 ? -1 : index === 2 ? 0 : 1}
          <div 
            class="trending-rank-item rank-{rankNumber}"
            style="--rank-color: {option.color};"
            onclick={() => {
              if (pollData) {
                openTrendingPoll(pollData);
              }
            }}
            onkeydown={(e) => { 
              if (e.key === 'Enter' || e.key === ' ') { 
                e.preventDefault(); 
                if (pollData) {
                  openTrendingPoll(pollData);
                }
              }
            }}
            role="button"
            tabindex="0"
          >
            <!-- Avatar del creador con borde de color -->
            <div class="rank-avatar" style="--poll-color: {option.color}">
              {#if pollData?.user?.avatarUrl}
                <img src={pollData.user.avatarUrl} alt={pollData.user.displayName} style="border: 3px solid {option.color};" />
              {:else}
                <div class="rank-avatar-placeholder" style="background: {option.color}; border: 3px solid {option.color};">
                  {rankNumber}
                </div>
              {/if}
            </div>
            
            <!-- Posición del ranking con flecha de cambio -->
            <div class="rank-position">
              <span class="rank-number">{rankNumber}</span>
              {#if rankChange > 0}
                <svg class="rank-change rank-up" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14l5-5 5 5z"/>
                </svg>
              {:else if rankChange < 0}
                <svg class="rank-change rank-down" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              {:else}
                <span class="rank-change rank-same">—</span>
              {/if}
            </div>
            
            <!-- Contenido: Título de la encuesta -->
            <div class="rank-content">
              <h3 class="rank-title">{option.label}</h3>
              <div class="rank-meta">
                {#if pollData?.user?.displayName}
                  <span class="rank-author">
                    {pollData.user.displayName}
                    {#if pollData.user.verified}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color: #3b82f6; margin-left: 2px;">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    {/if}
                  </span>
                  <span class="rank-separator">•</span>
                {/if}
                <span class="rank-votes">
                  {formatNumber(option.votes || pollData?.totalVotes || 0)} votos
                </span>
              </div>
            </div>
            
            <!-- Menú de 3 puntos -->
            <button 
              class="rank-menu-btn"
              onclick={(e) => {
                e.stopPropagation();
                openPollOptionsModal(pollData);
              }}
              type="button"
              aria-label="Más opciones"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
          </div>
        {/each}
      </div>
      
      <!-- Indicadores de paginación tipo Instagram para main poll -->
      {#if shouldPaginateMain}
        <div class="pagination-dots {paginatedMainOptions.totalPages > 25 ? 'many-pages' : ''}">
          {#each Array(paginatedMainOptions.totalPages) as _, pageIndex}
            <button 
              class="pagination-dot {pageIndex === currentPageMain ? 'active' : ''}"
              onclick={async () => { 
                const oldPage = currentPageMain;
                transitionDirectionMain = pageIndex < oldPage ? 'prev' : 'next';
                currentPageMain = pageIndex;
                await delay(50);
                const newPageOptions = getPaginatedOptions(sortedDisplayOptions, pageIndex);
                activeAccordionMainIndex = pageIndex < oldPage 
                  ? newPageOptions.items.length - 1 
                  : 0;
                await delay(350);
                transitionDirectionMain = null;
              }}
              type="button"
              aria-label="Bloque {pageIndex + 1}"
            ></button>
          {/each}
        </div>
      {/if}
      
      <!-- Información total debajo de trending -->
      <div 
        class="vote-summary-info"
      >
        <div class="vote-stats">
          <div class="stat-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span>{formatNumber(trendingPolls.length)}</span>
          </div>
          <div class="stat-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>{formatNumber(mainPollViews)}</span>
          </div>
        </div>
      </div>
      
      <!-- Separador después de trending -->
      {#if additionalPolls.length > 0}
        <div 
          class="more-polls-divider"
        >
          <div class="divider-line"></div>
          <span class="divider-text">Ver otras encuestas de {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
          <div class="divider-line"></div>
        </div>
      {/if}
      </div> <!-- Cierre de vote-cards-section trending -->
      {:else if !activePoll || !activePoll.id}
        <!-- Mensaje cuando NO hay trending disponible (solo si no hay encuesta activa) -->
        <div class="vote-cards-section">
          <div class="no-trending-message">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <h3>No hay encuestas trending</h3>
            <p>Aún no hay encuestas populares en {selectedSubdivisionName || selectedCountryName || 'esta región'}</p>
          </div>
        </div>
      {/if} <!-- Cierre de condicional trendingPolls -->
      
      <!-- Encuestas adicionales dentro del mismo contenedor scrolleable -->
      {#each additionalPolls as poll, pollIndex (poll.id)}
        
        <!-- Insertar anuncios cada 3 encuestas -->
        {#if pollIndex === 2}
          <div class="ad-card">
            <span class="ad-label">Patrocinado</span>
            <div class="ad-content">
              <div class="ad-image ad-image-real">
                <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&h=200&fit=crop" alt="Anuncio" />
              </div>
              <div class="ad-text">
                <h4>VoteTok Premium</h4>
                <p>Accede a encuestas exclusivas y análisis detallados</p>
                <button class="ad-cta">Probar gratis</button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Insertar sección "A quien seguir" después de la 5ta encuesta -->
        {#if pollIndex === 5 && pollIndex < additionalPolls.length - 2 && userSuggestions.length > 0}
          <div class="suggestions-card">
            <h4 class="suggestions-title">A quién seguir</h4>
            <div class="suggestions-scroll">
              {#each userSuggestions as user, idx}
                <div class="suggestion-item">
                  {#if user.avatarUrl}
                    <img class="suggestion-avatar" src={user.avatarUrl} alt={user.displayName} />
                  {:else}
                    <div class="suggestion-avatar" style="background: linear-gradient({135 + idx * 30}deg, hsl({idx * 45}, 70%, 60%), hsl({idx * 45 + 40}, 70%, 50%))">
                      {user.displayName.charAt(0)}
                    </div>
                  {/if}
                  <div class="suggestion-info">
                    <span class="suggestion-name">
                      {user.displayName}
                      {#if user.verified}
                        <span class="verified-badge">✓</span>
                      {/if}
                    </span>
                    <span class="suggestion-bio">{user.bio}</span>
                  </div>
                  <button class="suggestion-follow">Seguir</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <div class="poll-item">
          <!-- Header de la encuesta -->
          <div class="poll-header">
            <div class="header-with-avatar">
              <div class="header-content">
                {#if poll.type === 'hashtag'}
                  <div class="poll-question-wrapper">
                    <h3 
                      class="poll-question" 
                      class:expanded={pollTitleExpanded[poll.id]}
                      class:truncated={pollTitleTruncated[poll.id] && !pollTitleExpanded[poll.id]}
                      data-type="hashtag"
                      bind:this={pollTitleElements[poll.id]}
                      onmouseenter={() => {
                        if (!pollTitleExpanded[poll.id] && pollTitleElements[poll.id]) {
                          pollTitleTruncated[poll.id] = checkTruncation(pollTitleElements[poll.id]);
                        }
                      }}
                      onclick={() => {
                        if (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id]) {
                          pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                          if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                        }
                      }}
                      onkeydown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id])) {
                          e.preventDefault();
                          pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                          if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                        }
                      }}
                      role={pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id] ? 'button' : undefined}
                    >
                      #{poll.question}
                      {#if pollTitleExpanded[poll.id]}
                        <span class="collapse-indicator-poll"> [−]</span>
                      {/if}
                    </h3>
                  </div>
                  <div class="poll-meta">
                    <span class="poll-type">Hashtag trending • {poll.region}</span>
                    <span class="poll-time">• {poll.publishedAt ? getRelativeTime(Math.floor((Date.now() - new Date(poll.publishedAt).getTime()) / 60000)) : ''}</span>
                  </div>
                {:else if poll.type === 'trending'}
                  <div class="poll-question-wrapper">
                    <h3 
                      class="poll-question" 
                      class:expanded={pollTitleExpanded[poll.id]}
                      class:truncated={pollTitleTruncated[poll.id] && !pollTitleExpanded[poll.id]}
                      bind:this={pollTitleElements[poll.id]}
                      onmouseenter={() => {
                        if (!pollTitleExpanded[poll.id] && pollTitleElements[poll.id]) {
                          pollTitleTruncated[poll.id] = checkTruncation(pollTitleElements[poll.id]);
                        }
                      }}
                      onclick={() => {
                        if (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id]) {
                          pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                          if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                        }
                      }}
                      onkeydown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id])) {
                          e.preventDefault();
                          pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                          if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                        }
                      }}
                      role={pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id] ? 'button' : undefined}
                    >
                      Trending en {poll.region}
                      {#if pollTitleExpanded[poll.id]}
                        <span class="collapse-indicator-poll"> [−]</span>
                      {/if}
                    </h3>
                  </div>
                  <div class="poll-meta">
                    <span class="poll-type">Encuestas más votadas</span>
                    <span class="poll-time">• {poll.publishedAt ? getRelativeTime(Math.floor((Date.now() - new Date(poll.publishedAt).getTime()) / 60000)) : ''}</span>
                  </div>
                {:else}
                  <div class="poll-question-wrapper">
                    <h3 
                      class="poll-question" 
                      class:expanded={pollTitleExpanded[poll.id]}
                      class:truncated={pollTitleTruncated[poll.id] && !pollTitleExpanded[poll.id]}
                      bind:this={pollTitleElements[poll.id]}
                      onmouseenter={() => {
                        if (!pollTitleExpanded[poll.id] && pollTitleElements[poll.id]) {
                          pollTitleTruncated[poll.id] = checkTruncation(pollTitleElements[poll.id]);
                        }
                      }}
                      onclick={() => {
                        if (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id]) {
                          pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                          if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                        }
                      }}
                      onkeydown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id])) {
                          e.preventDefault();
                          pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                          if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                        }
                      }}
                      role={pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id] ? 'button' : undefined}
                    >
                      {poll.question}
                      {#if pollTitleExpanded[poll.id]}
                        <span class="collapse-indicator-poll"> [−]</span>
                      {/if}
                    </h3>
                  </div>
                  <div class="poll-meta">
                    <span class="poll-type">Encuesta • {poll.region}</span>
                    <span class="poll-time">• {poll.publishedAt ? getRelativeTime(Math.floor((Date.now() - new Date(poll.publishedAt).getTime()) / 60000)) : ''}</span>
                  </div>
                {/if}
              </div>
              <div class="header-avatar header-avatar-real">
                {#if poll.creator?.avatarUrl}
                  <img src={poll.creator.avatarUrl} alt={poll.creator.name} style="border: 3px solid rgba(156, 163, 175, 0.5);" />
                {:else if poll.creator?.name}
                  <div class="avatar-placeholder" style="background: linear-gradient(135deg, hsl({pollIndex * 45}, 70%, 60%), hsl({pollIndex * 45 + 40}, 70%, 50%)); border: 3px solid rgba(156, 163, 175, 0.5);">
                    {poll.creator.name.charAt(0)}
                  </div>
                {:else}
                  <img src={DEFAULT_AVATAR} alt="Avatar" style="border: 3px solid rgba(156, 163, 175, 0.5);" />
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Grid de opciones de votación -->
          {#if poll && poll.options && poll.options.length > 0}
            {@const sortedPollOptions = getNormalizedOptions(poll).sort((a, b) => b.pct - a.pct)}
            {@const shouldPaginatePoll = sortedPollOptions.length > OPTIONS_PER_PAGE}
            {@const currentPage = currentPageByPoll[poll.id] || 0}
            {@const paginatedPoll = shouldPaginatePoll 
              ? getPaginatedOptions(sortedPollOptions, currentPage)
              : { items: sortedPollOptions, totalPages: 1, hasNext: false, hasPrev: false }}
            {@const isChartView = currentPage === -1}
            {@const isSingleOptionPoll = sortedPollOptions.length === 1}
            <div class="vote-cards-grid accordion fullwidth {activeAccordionByPoll[poll.id] != null ? 'open' : ''} {isSingleOptionPoll || isChartView ? 'compact-one' : ''}"
               style="--items: {isChartView ? 1 : paginatedPoll.items.length}"
               role="group" aria-label={'Opciones de ' + poll.region}
               bind:this={pollGridRefs[poll.id]}
               onpointerdown={(e) => handleDragStart(e, poll.id)}
               ontouchstart={(e) => handleDragStart(e, poll.id)}>
              {#if isChartView}
                <!-- Vista de gráfico combinado -->
                <button 
                  class="vote-card" 
                  style="--card-color: {paginatedPoll.items[0]?.color};" 
                  onclick={() => exitChartView(poll.id)}
                  type="button"
                >
                  <!-- Header con avatar y título -->
                  <div class="card-header">
                    <h2 class="question-title">Gráfico Combinado</h2>
                    <img class="creator-avatar" src={DEFAULT_AVATAR} alt="Avatar" loading="lazy" />
                  </div>

                  <!-- Contenido principal: gráfico combinado -->
                  <div class="card-content">
                    <div class="vote-chart-container">
                      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                      <svg 
                        class="vote-chart" 
                        viewBox="0 0 300 150" 
                        preserveAspectRatio="none"
                        role="application"
                        aria-label="Gráfico de tendencia de votos interactivo"
                        tabindex="0"
                        onmousedown={(e) => handleChartBrushStart(e, e.currentTarget)}
                        onmousemove={(e) => isBrushing ? handleChartBrushMove(e, e.currentTarget) : handleChartMouseMove(e, e.currentTarget)}
                        onmouseup={handleChartBrushEnd}
                        onmouseleave={() => { handleChartBrushEnd(); handleChartMouseLeave(); }}
                        ontouchstart={(e) => handleChartBrushStart(e, e.currentTarget)}
                        ontouchmove={(e) => handleChartBrushMove(e, e.currentTarget)}
                        ontouchend={handleChartBrushEnd}
                        ontouchcancel={handleChartBrushEnd}
                      >
                        <!-- Renderizar línea para cada opción -->
                        {#each sortedPollOptions as opt}
                          {@const optData = generateHistoricalData(timeRanges.find(r => r.id === selectedTimeRange)?.days || 30, opt.pct)}
                          <path
                            d="{createChartPath(optData, 300, 150)}"
                            fill="none"
                            stroke="{opt.color}"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            opacity="{isBrushing ? 0.3 : 0.8}"
                          />
                        {/each}
                        
                        <!-- Líneas activas cuando está en brush -->
                        {#if isBrushing && chartBrushCurrent !== null}
                          <defs>
                            <clipPath id="activeClip-combined-{poll.id}">
                              <rect x="0" y="0" width="{chartBrushCurrent}" height="150" />
                            </clipPath>
                          </defs>
                          {#each sortedPollOptions as opt}
                            {@const optData = generateHistoricalData(timeRanges.find(r => r.id === selectedTimeRange)?.days || 30, opt.pct)}
                            <path
                              d="{createChartPath(optData, 300, 150)}"
                              fill="none"
                              stroke="{opt.color}"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              clip-path="url(#activeClip-combined-{poll.id})"
                            />
                          {/each}
                        {/if}
                        
                        <!-- Línea vertical de hover -->
                        {#if chartHoverData}
                          <line
                            x1="{chartHoverData.x}"
                            y1="0"
                            x2="{chartHoverData.x}"
                            y2="150"
                            stroke="white"
                            stroke-width="1"
                            opacity="0.5"
                            stroke-dasharray="4 4"
                          />
                        {/if}
                      </svg>
                      
                      <!-- Tooltip interactivo -->
                      {#if chartHoverData}
                        {@const allVotes = sortedPollOptions.map(opt => {
                          const optData = generateHistoricalData(timeRanges.find(r => r.id === selectedTimeRange)?.days || 30, opt.pct);
                          const dataIndex = Math.round(((chartHoverData?.x ?? 0) / 300) * (optData.length - 1));
                          return optData[dataIndex]?.votes || 0;
                        }).reduce((sum, votes) => sum + votes, 0)}
                        <div class="chart-tooltip">
                          <div class="tooltip-header">
                            <div class="tooltip-date">{formatChartDate(chartHoverData?.date ?? new Date(), selectedTimeRange)}</div>
                            <div class="tooltip-total">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <path d="M9 11l3 3L22 4"></path>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                              </svg>
                              {formatNumber(allVotes)}
                            </div>
                          </div>
                          {#each sortedPollOptions as opt}
                            {@const optData = generateHistoricalData(timeRanges.find(r => r.id === selectedTimeRange)?.days || 30, opt.pct)}
                            {@const dataIndex = Math.round(((chartHoverData?.x ?? 0) / 300) * (optData.length - 1))}
                            {@const dataPoint = optData[dataIndex]}
                            {#if dataPoint}
                              <div class="tooltip-row">
                                <div class="tooltip-option-name" style="color: {opt.color}">{opt.key}</div>
                                <div class="tooltip-value">
                                  {formatNumber(dataPoint.votes)}
                                </div>
                              </div>
                            {/if}
                          {/each}
                        </div>
                      {/if}
                      
                      <!-- Botones de selección de rango temporal abajo -->
                      <div class="time-range-selector time-range-bottom">
                        {#each timeRanges as range}
                          <div
                            class="time-range-btn"
                            class:active={selectedTimeRange === range.id}
                            onclick={(e) => { e.stopPropagation(); selectedTimeRange = range.id; }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); selectedTimeRange = range.id; }}}
                            role="button"
                            tabindex="0"
                          >
                            {range.label}
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                </button>
              {:else}
             
              {#each paginatedPoll.items as option, index (option.key)}
              <button 
                class="vote-card {activeAccordionByPoll[poll.id] === index ? 'is-active' : ''} {(state !== 'expanded' || activeAccordionByPoll[poll.id] !== index) ? 'collapsed' : ''}" 
                style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, option.pct))}%; --fill-pct-val: {Math.max(0, Math.min(100, option.pct))}; --flex: {Math.max(0.5, option.pct / 10)};" 
                onclick={() => {
                  // Si solo hay 1 opción en total, no hacer nada (solo mostrar gráfico)
                  if (isSingleOptionPoll) { return; }
                  // Si hay más de 1 opción, usar lógica de acordeón
                  if (activeAccordionByPoll[poll.id] !== index) { setActiveForPoll(poll.id, index); return; }
                  handleVote(option.key, poll.id);
                }}
                onfocus={() => !isSingleOptionPoll ? setActiveForPoll(poll.id, index) : null}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (activeAccordionByPoll[poll.id] !== index) { setActiveForPoll(poll.id, index); return; }
                    handleVote(option.key, poll.id);
                  }
                }}
                type="button"
              >
                <!-- Header con avatar y título (solo si hay más de 1 opción) -->
                {#if !isSingleOptionPoll}
                <div class="card-header">
                  <h2 class="question-title">{option.label}</h2>
                  <img class="creator-avatar" src={option.avatarUrl || DEFAULT_AVATAR} alt={option.label} loading="lazy" />
                </div>
                {/if}

                <!-- Contenido principal -->
                <div class="card-content" class:card-content-full={isSingleOptionPoll}>
                  {#if isSingleOptionPoll}
                    <!-- Gráfico para encuestas de una sola opción -->
                    <div class="vote-chart-container">
                      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                      <svg 
                        class="vote-chart" 
                        viewBox="0 0 300 150" 
                        preserveAspectRatio="none"
                        role="application"
                        aria-label="Gráfico de tendencia de votos interactivo"
                        tabindex="0"
                        onmousedown={(e) => handleChartBrushStart(e, e.currentTarget)}
                        onmousemove={(e) => isBrushing ? handleChartBrushMove(e, e.currentTarget) : handleChartMouseMove(e, e.currentTarget)}
                        onmouseup={handleChartBrushEnd}
                        onmouseleave={() => { handleChartBrushEnd(); handleChartMouseLeave(); }}
                        ontouchstart={(e) => handleChartBrushStart(e, e.currentTarget)}
                        ontouchmove={(e) => handleChartBrushMove(e, e.currentTarget)}
                        ontouchend={handleChartBrushEnd}
                        ontouchcancel={handleChartBrushEnd}
                      >
                        <defs>
                          <linearGradient id="chartGradient-{poll.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:{option.color};stop-opacity:0.3" />
                            <stop offset="100%" style="stop-color:{option.color};stop-opacity:0" />
                          </linearGradient>
                        </defs>
                        <!-- Área bajo la curva -->
                        <path
                          d="{createChartPath(historicalData, 300, 150)} L 300,150 L 0,150 Z"
                          fill="url(#chartGradient-{poll.id})"
                        />
                        
                        <!-- Línea del gráfico completa -->
                        <path
                          d="{createChartPath(historicalData, 300, 150)}"
                          fill="none"
                          stroke="{option.color}"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          opacity="{isBrushing ? 0.3 : 1}"
                        />
                        
                        <!-- Línea activa (parte izquierda) cuando está en brush -->
                        {#if isBrushing && chartBrushCurrent !== null}
                          <defs>
                            <clipPath id="activeClip-{poll.id}">
                              <rect x="0" y="0" width="{chartBrushCurrent}" height="150" />
                            </clipPath>
                          </defs>
                          <path
                            d="{createChartPath(historicalData, 300, 150)}"
                            fill="none"
                            stroke="{option.color}"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            clip-path="url(#activeClip-{poll.id})"
                          />
                        {/if}
                        
                        <!-- Línea vertical de hover -->
                        {#if chartHoverData}
                          <line
                            x1="{chartHoverData.x}"
                            y1="0"
                            x2="{chartHoverData.x}"
                            y2="150"
                            stroke="white"
                            stroke-width="1"
                            opacity="0.5"
                            stroke-dasharray="4 4"
                          />
                          <!-- Punto en la línea -->
                          <circle
                            cx="{chartHoverData.x}"
                            cy="{150 - ((chartHoverData.y - Math.min(...historicalData.map(d => d.y))) / (Math.max(...historicalData.map(d => d.y)) - Math.min(...historicalData.map(d => d.y)) || 1)) * 150}"
                            r="4"
                            fill="{option.color}"
                            stroke="white"
                            stroke-width="2"
                          />
                        {/if}
                      </svg>
                      
                      <!-- Tooltip interactivo -->
                      {#if chartHoverData}
                        <div class="chart-tooltip">
                          <div class="tooltip-row">
                            <div class="tooltip-date">{formatChartDate(chartHoverData.date, selectedTimeRange)}</div>
                            <div class="tooltip-value">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <path d="M9 11l3 3L22 4"></path>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                              </svg>
                              {formatNumber(chartHoverData.votes)}
                            </div>
                          </div>
                        </div>
                      {/if}
                      
                      <!-- Botones de selección de rango temporal abajo -->
                      <div class="time-range-selector time-range-bottom">
                        {#each timeRanges as range}
                          <div
                            class="time-range-btn"
                            class:active={selectedTimeRange === range.id}
                            onclick={(e) => { e.stopPropagation(); selectedTimeRange = range.id; }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); selectedTimeRange = range.id; }}}
                            role="button"
                            tabindex="0"
                          >
                            {range.label}
                          </div>
                        {/each}
                      </div>
                    </div>
                  {:else}
                    <!-- Porcentaje tradicional para múltiples opciones -->
                    <div class="percentage-display">
                      <span
                        class="percentage-large"
                        style="font-size: {(activeAccordionByPoll[poll.id] === index && state === 'expanded'
                          ? fontSizeForPct(option.pct)
                          : Math.min(fontSizeForPct(option.pct), 21))}px"
                      >
                        {Math.round(option.pct)}
                      </span>
                    </div>
                  {/if}
                  
                  <!-- Avatares de amigos posicionados absolutamente (solo si hay amigos que votaron) -->
                  {#if poll.friendsByOption?.[option.key] && poll.friendsByOption[option.key].length > 0}
                    <div class="friend-avatars-absolute">
                      {#each poll.friendsByOption[option.key].slice(0, 3) as friend, i}
                        <img 
                          class="friend-avatar-floating" 
                          src={friend.avatarUrl || DEFAULT_AVATAR}
                          alt={friend.name}
                          loading="lazy"
                          style="z-index: {10 - i};"
                        />
                      {/each}
                    </div>
                  {/if}
                </div>
              </button>
              {/each}
              {/if}
            </div>
            
            <!-- Indicadores de paginación tipo Instagram para additional poll -->
            {#if shouldPaginatePoll}
              <div class="pagination-dots {paginatedPoll.totalPages > 25 ? 'many-pages' : ''}">
                {#each Array(paginatedPoll.totalPages) as _, pageIndex}
                  <button 
                    class="pagination-dot {pageIndex === (currentPageByPoll[poll.id] || 0) ? 'active' : ''}"
                    onclick={() => { 
                                            const oldPage = currentPageByPoll[poll.id] || 0;
                      
                      if (oldPage === pageIndex) {
                                                return;
                      }
                      
                      // Actualizar página - IMPORTANTE: crear nuevo objeto para reactividad
                      currentPageByPoll = { ...currentPageByPoll, [poll.id]: pageIndex };
                      
                      // Establecer acordeón activo inmediatamente
                      const sortedOptions = getNormalizedOptions(poll).sort((a, b) => b.pct - a.pct);
                      const newPageOptions = getPaginatedOptions(sortedOptions, pageIndex);
                      
                      // IMPORTANTE: Abrir el acordeón de la primera opción
                      if (newPageOptions.items.length > 0) {
                        activeAccordionByPoll[poll.id] = 0;
                      }
                      
                                                                                      }}
                    type="button"
                    aria-label="Bloque {pageIndex + 1}"
                  ></button>
                {/each}
              </div>
            {/if}
            <!-- Información de la encuesta -->
            <div class="vote-summary-info">
              <div class="vote-stats">
                <button 
                  class="stat-badge" 
                  class:active={(currentPageByPoll[poll.id] || 0) === -1}
                  type="button" 
                  title={(currentPageByPoll[poll.id] || 0) === -1 ? 'Vista opciones' : 'Vista gráfico'}
                  onclick={() => { 
                    if ((currentPageByPoll[poll.id] || 0) === -1) {
                      exitChartView(poll.id);
                    } else {
                      goToChartView(poll.id);
                    }
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    {#if (currentPageByPoll[poll.id] || 0) === -1}
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                    {:else}
                      <line x1="12" y1="20" x2="12" y2="10"></line>
                      <line x1="18" y1="20" x2="18" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="16"></line>
                    {/if}
                  </svg>
                  <span>{formatNumber(poll.options.length)}</span>
                </button>
                <div class="stat-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                  <span>{formatNumber(poll.totalVotes)}</span>
                </div>
                <div class="stat-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span>{formatNumber(poll.totalViews)}</span>
                </div>
              </div>
              <div class="vote-actions">
                <button class="action-badge" type="button" title="Guardar">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>{formatNumber(0)}</span>
                </button>
                <button class="action-badge" type="button" title="Republicar">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M17 1l4 4-4 4"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <path d="M7 23l-4-4 4-4"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  <span>{formatNumber(0)}</span>
                </button>
                <button class="action-badge action-share" type="button" title="Compartir">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span>{formatNumber(0)}</span>
                </button>
                <button 
                  class="action-badge action-globe" 
                  type="button" 
                  title="Ver en el globo"
                  aria-label="Ver en el globo"
                  onclick={() => openAdditionalPollInGlobe(poll)}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Indicador de carga solo cuando está cargando -->
      {#if isLoadingPolls}
        <div class="loading-more">
          <div class="loading-spinner"></div>
          <span>Cargando más encuestas...</span>
        </div>
      {/if}
      
      <!-- Mensaje cuando no hay más encuestas -->
      {#if !hasMorePolls && additionalPolls.length > 0}
        <div class="no-more-polls">
          <div class="no-more-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </div>
          <h4>¡Has llegado al final!</h4>
          <p>Ya has visto todas las encuestas disponibles</p>
          <button class="refresh-btn" onclick={() => window.location.reload()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
  
  <!-- Mostrar contenido cuando NO está expandido o no hay voteOptions -->
  {#if state !== 'expanded'}
    <div 
      class="sheet-content" 
      onscroll={onScroll}
      onpointerdown={onPointerDown}
      ontouchstart={onPointerDown}
    >
      <!-- Botones flotantes en el contenido -->
      <div class="floating-indicators-content">
        <!-- Indicador de altitud/distancia (primero a la izquierda) -->
        <div class="altitude-indicator-floating" aria-label="Indicador de distancia aproximada" style="align-self: center; margin-right: auto;">
          <div style="position: relative; display: inline-block;">
            <div class="scale-bar"></div>
            <div class="altitude-value">{numberFmt.format(scaleKm)} km</div>
          </div>
        </div>

        <!-- Botón de ajustes (3 puntos) -->
        <button 
          class="nav-chip settings-btn-floating" 
          onclick={onToggleSettings}
          title="Ajustes de colores y visualización"
          aria-label="Abrir ajustes"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="2"></circle>
            <circle cx="12" cy="12" r="2"></circle>
            <circle cx="12" cy="19" r="2"></circle>
          </svg>
        </button>

        <!-- Botón de localización -->
        <button 
          class="nav-chip locate-btn-floating" 
          onclick={onLocateMe}
          title="Ir a mi ubicación"
          aria-label="Ir a mi ubicación"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </button>

        <!-- Botón de pantalla completa -->
        <button 
          class="nav-chip fullscreen-btn-floating" 
          onclick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }}
          title={fullscreenActive ? "Salir de pantalla completa" : "Pantalla completa"}
          aria-label={fullscreenActive ? "Salir de pantalla completa" : "Activar pantalla completa"}
        >
          {#if fullscreenActive}
            <!-- Icono de minimizar/salir de fullscreen -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          {:else}
            <!-- Icono de expandir a fullscreen -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          {/if}
        </button>
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
  
  <!-- Botón flotante "volver al inicio" -->
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

<style>
  /* Avatares con bordes grises en encuestas adicionales */
  .header-avatar-real img,
  .header-avatar-real .avatar-placeholder {
    box-sizing: border-box;
    border-radius: 50%;
  }
  
  /* Bloquear todas las interacciones durante animaciones de cámara */
  .bottom-sheet.camera-animating {
    pointer-events: none;
    user-select: none;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  
  /* Modal de opciones de encuesta */
  .poll-options-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: flex-end;
    animation: fadeIn 0.2s ease-out;
  }
  
  .poll-options-modal {
    background: #1a1a1a;
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transition: transform 0.1s ease-out;
  }
  
  .modal-drag-handle {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    margin: 12px auto 8px;
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  
  .poll-options-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .poll-options-title h3 {
    margin: 0 0 4px 0;
    color: white;
    font-size: 18px;
    font-weight: 600;
  }
  
  .poll-options-title p {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }
  
  .close-modal-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .poll-options-list {
    padding: 8px 0;
  }
  
  .poll-option-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: transparent;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
  }
  
  .poll-option-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .poll-option-item svg {
    flex-shrink: 0;
  }
  
  .poll-option-danger {
    color: #ef4444;
  }
  
  /* Barra de opciones de encuesta profesional */
  .poll-options-bar-container {
    background: transparent;
    padding: 8px 0;
    width: 100%;
    animation: slideInFromTop 0.3s ease;
    position: relative;
  }
  
  @keyframes slideInFromTop {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .poll-bar-title {
    margin-bottom: 8px;
    padding: 0 12px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
  }
  
  .poll-bar-title h3 {
    font-size: 13px;
    font-weight: 600;
    color: white;
    text-align: center;
    margin: 0;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    flex: 1;
  }
  
  .poll-close-btn {
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    font-size: 14px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .poll-close-btn:hover {
    background: rgba(255,255,255,0.2);
    transform: scale(1.1);
  }
  
  .poll-bar-chart {
    width: 100%;
    background: none;
    border: none;
    padding: 0 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .poll-bar-segments {
    flex: 1;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    background: rgba(255,255,255,0.1);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
  }
  
  .poll-bar-segment {
    height: 100%;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  
  .poll-bar-chart:hover .poll-bar-segment {
    opacity: 0.85;
  }
  
  .poll-bar-icon {
    color: #9ca3af;
    font-size: 14px;
    transition: transform 0.3s ease, color 0.2s ease;
    user-select: none;
  }
  
  .poll-bar-chart:hover .poll-bar-icon {
    color: #ffffff;
  }
  
  .poll-bar-options-expanded {
    margin-top: 12px;
    padding: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: expandDown 0.3s ease;
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    /* CRÍTICO para móvil: permitir scroll vertical */
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  
  @keyframes expandDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 300px;
    }
  }
  
  .poll-bar-option-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.08);
    border-radius: 10px;
    transition: background 0.2s ease, transform 0.2s ease;
    width: 100%;
    border: none;
    text-align: left;
    cursor: default;
  }
  
  .poll-bar-option-item.is-trending-poll {
    cursor: pointer;
  }
  
  .poll-bar-option-item.is-trending-poll:hover {
    background: rgba(255,255,255,0.15);
    transform: translateX(2px);
  }
  
  .poll-bar-option-item:hover {
    background: rgba(255,255,255,0.12);
  }
  
  .poll-bar-option-info {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  
  .poll-bar-option-hint {
    margin-left: auto;
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    font-weight: 500;
  }
  
  .poll-bar-option-avatar,
  .poll-bar-option-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    box-sizing: border-box; /* Para que el borde no agrande el avatar */
  }
  
  .poll-bar-option-avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 16px;
    text-transform: uppercase;
    box-sizing: border-box; /* Para que el borde no agrande el avatar */
  }
  
  .poll-bar-option-label {
    color: white;
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  
  .poll-bar-option-stats {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    width: 100%;
  }
  
  .poll-bar-option-progress-bg {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
  }
  
  .poll-bar-option-progress-fill {
    height: 100%;
    transition: width 0.5s ease;
    border-radius: 4px;
    box-shadow: 0 0 10px rgba(255,255,255,0.3);
  }
  
  .poll-bar-option-pct {
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 700;
    min-width: 50px;
    text-align: right;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }
  
  /* Mensaje cuando no hay trending */
  .no-trending-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: rgba(255,255,255,0.7);
  }
  
  .no-trending-message svg {
    opacity: 0.3;
    margin-bottom: 20px;
  }
  
  .no-trending-message h3 {
    font-size: 20px;
    font-weight: 600;
    color: white;
    margin: 0 0 10px 0;
  }
  
  .no-trending-message p {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    margin: 0;
    max-width: 300px;
  }
</style>
