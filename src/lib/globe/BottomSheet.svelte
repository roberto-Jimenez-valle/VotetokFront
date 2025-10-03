<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  // Interfaz para encuestas adicionales
  interface Poll {
    id: string;
    question: string;
    type: 'poll' | 'hashtag' | 'trending';
    region: string;
    options: Array<{ key: string; label: string; color: string; votes: number }>;
    totalVotes: number;
    totalViews: number;
    creator?: { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean };
    publishedAt?: string | Date;
    friendsByOption?: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>>;
  }
  
  // Estado de acordeón full-width (sin scroll): índice activo por grid
  let activeAccordionMainIndex: number | null = null;
  const activeAccordionByPoll: Record<string, number | null> = {};
  let lastMainOptionsSignature = '';
  const pollOptionSignatures: Record<string, string> = {};
  
  // Estado de paginación para encuestas con >4 opciones
  const OPTIONS_PER_PAGE = 4;
  let currentPageMain = 0;
  const currentPageByPoll: Record<string, number> = {};
  
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

  // Helper para generar datos históricos mock con granularidad apropiada
  function generateHistoricalData(days: number, targetPct?: number): {x: number, y: number, votes: number}[] {
    const data = [];
    const now = Date.now();
    const baseValue = targetPct !== undefined ? targetPct : (30 + Math.random() * 40);
    const baseVotes = 5000 + Math.random() * 10000;
    
    // Determinar granularidad según días
    let numPoints: number;
    let intervalMs: number;
    
    if (days === 1) {
      // 1D: punto por hora (24 puntos)
      numPoints = 24;
      intervalMs = 60 * 60 * 1000;
    } else if (days <= 5) {
      // 5D: punto por día (5 puntos)
      numPoints = days;
      intervalMs = 24 * 60 * 60 * 1000;
    } else if (days <= 30) {
      // 1M: punto por día (30 puntos)
      numPoints = days;
      intervalMs = 24 * 60 * 60 * 1000;
    } else if (days <= 180) {
      // 6M: punto por semana (26 puntos)
      numPoints = Math.ceil(days / 7);
      intervalMs = 7 * 24 * 60 * 60 * 1000;
    } else if (days <= 365) {
      // 1A: punto por mes (12 puntos)
      numPoints = 12;
      intervalMs = 30 * 24 * 60 * 60 * 1000;
    } else {
      // 5A: punto por año (5 puntos)
      numPoints = Math.ceil(days / 365);
      intervalMs = 365 * 24 * 60 * 60 * 1000;
    }
    
    for (let i = 0; i < numPoints; i++) {
      const volatility = 0.1 + Math.random() * 0.05;
      const trend = i / numPoints * 20; // Tendencia ascendente
      const value = baseValue + trend + (Math.random() - 0.5) * volatility * 100;
      const votes = Math.floor(baseVotes * (1 + (i / numPoints) * 0.5 + (Math.random() - 0.5) * 0.2));
      data.push({
        x: now - (numPoints - i - 1) * intervalMs,
        y: Math.max(0, Math.min(100, value)),
        votes: Math.max(0, votes)
      });
    }
    return data;
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
    // Resetear estado de brush al entrar
    isBrushing = false;
    chartBrushStart = null;
    chartBrushCurrent = null;
    chartHoverData = null;
    
    transitionDirectionByPoll[pollId] = 'prev';
    currentPageByPoll[pollId] = -1;
    activeAccordionByPoll[pollId] = null;
  }
  
  // Volver desde vista de gráfico
  function exitChartView(pollId: string) {
    // Resetear estado de brush al salir
    isBrushing = false;
    chartBrushStart = null;
    chartBrushCurrent = null;
    chartHoverData = null;
    
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
    // Detener propagación para evitar que active el drag del grid
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
    const rect = chartElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = clientX - rect.left;
    const relativeX = x / rect.width;
    
    if (relativeX >= 0 && relativeX <= 1) {
      isBrushing = true;
      chartBrushStart = relativeX * 300;
      chartBrushCurrent = relativeX * 300;
      
      // Agregar listeners globales para capturar touchend fuera del SVG
      if ('touches' in event) {
        document.addEventListener('touchend', handleChartBrushEnd, { once: true });
        document.addEventListener('touchcancel', handleChartBrushEnd, { once: true });
      }
      
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
    
    // No intentar preventDefault en eventos táctiles (son pasivos por defecto)
    // El brush funciona correctamente sin prevenir el scroll
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
    
    // Remover listeners globales si existen
    document.removeEventListener('touchend', handleChartBrushEnd);
    document.removeEventListener('touchcancel', handleChartBrushEnd);
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

  function setActiveMain(i: number) {
    activeAccordionMainIndex = i;
    // Scroll a la card activa en grids con clase dense
    setTimeout(() => {
      if (mainGridRef && mainGridRef.classList.contains('dense')) {
        scrollToActiveCard(mainGridRef, i);
      }
    }, 50);
  }
  
  function nextPageMain() {
    transitionDirectionMain = 'next';
    currentPageMain += 1;
    activeAccordionMainIndex = null;
    setTimeout(() => { transitionDirectionMain = null; }, 400);
  }
  
  function prevPageMain() {
    if (currentPageMain > 0) {
      transitionDirectionMain = 'prev';
      currentPageMain -= 1;
      // Abrir la última opción de la página anterior
      setTimeout(() => {
        const newPageOptions = getPaginatedOptions(sortedDisplayOptions, currentPageMain);
        activeAccordionMainIndex = newPageOptions.items.length - 1;
      }, 50);
      setTimeout(() => { transitionDirectionMain = null; }, 400);
    }
  }
  function setActiveForPoll(pollId: string, i: number) {
    activeAccordionByPoll[pollId] = i;
    // Scroll a la card activa en grids con clase dense
    setTimeout(() => {
      const gridRef = pollGridRefs[pollId];
      if (gridRef && gridRef.classList.contains('dense')) {
        scrollToActiveCard(gridRef, i);
      }
    }, 50);
  }
  
  function nextPageForPoll(pollId: string) {
    // Resetear brush al cambiar de página
    isBrushing = false;
    chartBrushStart = null;
    chartBrushCurrent = null;
    chartHoverData = null;
    
    transitionDirectionByPoll[pollId] = 'next';
    currentPageByPoll[pollId] = (currentPageByPoll[pollId] || 0) + 1;
    activeAccordionByPoll[pollId] = null;
    setTimeout(() => { transitionDirectionByPoll[pollId] = null; }, 400);
  }
  
  function prevPageForPoll(pollId: string) {
    const current = currentPageByPoll[pollId] || 0;
    if (current > 0) {
      // Resetear brush al cambiar de página
      isBrushing = false;
      chartBrushStart = null;
      chartBrushCurrent = null;
      chartHoverData = null;
      
      transitionDirectionByPoll[pollId] = 'prev';
      currentPageByPoll[pollId] = current - 1;
      // Abrir la última opción de la página anterior
      setTimeout(() => {
        const poll = additionalPolls.find(p => p.id === pollId);
        if (poll) {
          const sortedOptions = getNormalizedOptions(poll).sort((a, b) => b.pct - a.pct);
          const newPageOptions = getPaginatedOptions(sortedOptions, currentPageByPoll[pollId] || 0);
          activeAccordionByPoll[pollId] = newPageOptions.items.length - 1;
        }
      }, 50);
      setTimeout(() => { transitionDirectionByPoll[pollId] = null; }, 400);
    }
  }
  
  function getPaginatedOptions<T>(options: T[], page: number): { items: T[], totalPages: number, hasNext: boolean, hasPrev: boolean } {
    const totalPages = Math.ceil(options.length / OPTIONS_PER_PAGE);
    const start = page * OPTIONS_PER_PAGE;
    const end = start + OPTIONS_PER_PAGE;
    return {
      items: options.slice(start, end),
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
  let mainGridRef: HTMLElement;
  const pollGridRefs: Record<string, HTMLElement> = {};
  
  // Variables para detectar gestos de arrastre horizontal
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isDragging = false;
  let currentDragGrid: HTMLElement | null = null;
  let currentDragPollId: string | null = null;
  
  // Función para manejar inicio de arrastre/touch
  function handleDragStart(e: PointerEvent | TouchEvent, pollId?: string) {
    // Solo permitir arrastre en dispositivos táctiles
    if (e.type === 'pointerdown' && (e as PointerEvent).pointerType === 'mouse') {
      return; // Ignorar eventos de mouse en ordenador
    }
    
    // Verificar si el touch empezó en un elemento del gráfico (SVG)
    const target = e.target as HTMLElement;
    if (target.closest('.vote-chart-container') || target.closest('svg.vote-chart')) {
      return; // Si tocaste el gráfico, NO permitir drag - solo brush
    }
    
    // Si estamos en vista de gráfico (página -1), NO permitir drag del grid
    if (pollId) {
      const currentPage = currentPageByPoll[pollId] || 0;
      if (currentPage === -1) {
        return; // En gráfico, solo brush - NO drag de navegación
      }
    }
    
    // No permitir arrastre en grids con muchas opciones (dense) - usan scroll nativo
    const grid = e.currentTarget as HTMLElement;
    if (grid && grid.classList.contains('dense')) {
      return; // Ignorar arrastre en grids con scroll horizontal
    }
    
    const touch = 'touches' in e ? e.touches[0] : e;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isDragging = false;
    // Usar el currentTarget del evento
    currentDragGrid = grid;
    currentDragPollId = pollId || null;
    
    console.log('[Drag] Start:', { pollId, hasGrid: !!currentDragGrid, type: e.type });
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
      if (!currentDragGrid.classList.contains('dense') && e.cancelable) {
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
      
      console.log('[Drag] Move:', { 
        pollId: currentDragPollId, 
        currentIndex, 
        deltaX, 
        totalCards,
        activeAccordionByPoll: currentDragPollId ? activeAccordionByPoll[currentDragPollId] : 'N/A'
      });
      
      // Si no hay ninguna activa (null o undefined), activar la primera o última según dirección
      if ((currentIndex === null || currentIndex === undefined) && totalCards > 0) {
        if (deltaX < 0) {
          // Arrastre hacia la izquierda -> activar la primera
          currentIndex = 0;
        } else {
          // Arrastre hacia la derecha -> activar la última
          currentIndex = totalCards - 1;
        }
        
        console.log('[Drag] Activating initial card:', { pollId: currentDragPollId, index: currentIndex, deltaX });
        
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
              // En vista gráfico, NO permitir cambio si está haciendo brush
              if (isBrushing) {
                return; // Ignorar cambio de página durante brush
              }
              // Requiere swipe largo Y rápido para salir
              const swipeDuration = Date.now() - touchStartTime;
              const swipeVelocity = Math.abs(deltaX) / swipeDuration; // px/ms
              if (Math.abs(deltaX) > 120 && swipeVelocity > 1.0) {
                exitChartView(currentDragPollId);
                touchStartX = touch.clientX;
              }
            } else if (currentPage === 0) {
              // Primera página, ir a vista gráfico (swipe largo y rápido)
              const swipeDuration = Date.now() - touchStartTime;
              const swipeVelocity = Math.abs(deltaX) / swipeDuration; // px/ms
              if (Math.abs(deltaX) > 100 && swipeVelocity > 1.0) {
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

  // Títulos sintéticos para variar el contenido visual de las cards
  const LONG_QUESTIONS = [
    '¿Debería el gobierno priorizar la educación pública y la sanidad por encima de la reducción fiscal en los próximos dos años?',
    '¿Qué plan de transición energética te parece más realista para 2030 considerando empleo, coste y sostenibilidad?',
    '¿Te parece adecuada la limitación de alquiler turístico en el centro de tu ciudad para recuperar la vivienda habitual?'
  ];
  const SHORT_QUESTIONS = [
    '¿Subir salario mínimo ya?',
    'Teletrabajo 3 días/semana',
    'Más zonas verdes',
    'Transporte gratis domingos',
  ];
  const HASHTAGS = [
    '#CambioClimático',
    '#Elecciones2025',
    '#ViviendaYa',
    '#IAenEducación',
  ];

  function getCardTitle(index: number, context: 'main' | 'additional', pollType?: string): string {
    // Para polls tipo hashtag, priorizamos hashtags
    if (pollType === 'hashtag') {
      return HASHTAGS[index % HASHTAGS.length];
    }
    // Alterna long/short/hashtag de forma cíclica
    const pick = index % 3;
    if (pick === 0) return LONG_QUESTIONS[index % LONG_QUESTIONS.length];
    if (pick === 1) return SHORT_QUESTIONS[index % SHORT_QUESTIONS.length];
    return HASHTAGS[index % HASHTAGS.length];
  }
  
  export let state: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
  export let y = 0; // translateY px
  export let isTransitioning = false; // Si debe usar transición CSS
  export let selectedCountryName: string | null = null;
  export let selectedSubdivisionName: string | null = null;
  export let selectedCityName: string | null = null;
  export let countryChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let worldChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let cityChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let voteOptions: Array<{ key: string; label: string; color: string; votes: number }> = [];
  // Amigos que han votado por opción (opcional)
  export let friendsByOption: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>> = {};
  // Visitas por opción (opcional)
  export let visitsByOption: Record<string, number> = {};
  // Creador de la publicación por opción (opcional)
  export let creatorsByOption: Record<string, { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean }> = {};
  // Fecha de publicación por opción (opcional)
  export let publishedAtByOption: Record<string, string | Date> = {};

  // Handlers de acciones (opcionales)
  export let onSaveOption: (optionKey: string) => void = () => {};
  export let onShareOption: (optionKey: string) => void = () => {};
  export let onMoreOption: (optionKey: string) => void = () => {};
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
  export let onLoadMorePolls: () => void = () => {};
  
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
    setTimeout(() => {
      navContainer.scrollLeft = navContainer.scrollWidth;
    }, 50);
    previousShowSearch = showSearch;
  } else if (showSearch !== previousShowSearch) {
    previousShowSearch = showSearch;
  }
  
  // Focus en el input cuando se abre la búsqueda, sin hacer scroll
  $: if (showSearch && searchInput) {
    setTimeout(() => {
      searchInput?.focus({ preventScroll: true });
    }, 50);
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
    
    console.log('[Search] Searching for:', query);
    console.log('[Search] NavigationManager available:', !!navigationManager);
    
    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Debounce search
    searchDebounceTimer = setTimeout(async () => {
      isSearching = true;
      const results: Array<{ id: string; name: string; iso?: string; type: 'country' | 'subdivision' }> = [];
      const lowerQuery = query.toLowerCase().trim();
      
      try {
        // Get available options from navigation manager
        if (navigationManager) {
          console.log('[Search] Getting available options...');
          const options = await navigationManager.getAvailableOptions();
          console.log('[Search] Available options:', options.length);
          
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
          
          console.log('[Search] Filtered results:', results.length);
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
        console.log('[Search] Final results:', searchResults);
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
    console.log('[Search] Result selected:', result);
    
    // Close search
    tagQuery = '';
    searchResults = [];
    onToggleSearch();
    
    // Dispatch event to parent to handle navigation
    const option = { id: result.id, name: result.name, iso: result.iso };
    console.log('[Search] Dispatching searchSelect event:', option);
    const event = new CustomEvent('searchSelect', { detail: option });
    window.dispatchEvent(event);
  }

  const dispatch = createEventDispatcher();
  
  // Estado de pantalla completa
  let fullscreenActive = false;
  
  onMount(() => {
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
  $: sortedDisplayOptions = displayOptions.sort((a, b) => b.pct - a.pct);
  $: shouldPaginateMain = sortedDisplayOptions.length > OPTIONS_PER_PAGE;
  $: paginatedMainOptions = shouldPaginateMain 
    ? getPaginatedOptions(sortedDisplayOptions, currentPageMain)
    : { items: sortedDisplayOptions, totalPages: 1, hasNext: false, hasPrev: false };

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
    if (pollId) {
      dispatch('vote', { option: optionKey, pollId });
    } else {
      onVote(optionKey);
      dispatch('vote', { option: optionKey });
    }
  }
  
  // Función para detectar scroll al final y cargar más encuestas
  function handlePollScroll(e: Event) {
    onScroll(e);
    
    const target = e.target as HTMLElement;
    if (target) {
      const scrollTop = target.scrollTop || 0;
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      
      // Mostrar el botón si ha scrolleado más de 200px
      showScrollToTop = scrollTop > 200;
      
      // Si estamos a menos de 200px del final, cargar más
      if (scrollBottom < 200) {
        onLoadMorePolls();
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
    console.log('[BottomSheet] World chart segments:', worldChartSegments);
  }

  // Auto-scroll to active button when navigation changes
  let navContainer: HTMLElement;
  
  $: if (selectedCountryName || selectedSubdivisionName || selectedCityName) {
    // Wait for DOM update then scroll to active button
    setTimeout(() => {
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
    }, 100);
  }
</script>

<div
  class="bottom-sheet {state === 'expanded' ? 'solid' : 'glass'} {state === 'peek' ? 'peek-state' : ''} {isTransitioning ? 'transitioning' : ''}"
  role="dialog"
  aria-modal="true"
  aria-hidden={state === 'hidden'}
  style={`transform: translateY(${y}px);`}
>

  <!-- Header simplificado con indicador visual de arrastre -->
  <div 
    class="sheet-drag-area"
    onpointerdown={onPointerDown}
    ontouchstart={onPointerDown}
  >
    {#if selectedCityName && cityChartSegments.length}
      <div class="drag-chart" role="img" aria-label={`Distribución en ${selectedCityName}`}>
        {#each cityChartSegments as seg}
          <div
            class="drag-seg"
            style={`width:${seg.pct}%; background:${seg.color}`}
            title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
          ></div>
        {/each}
      </div>
    {:else if selectedCountryName && countryChartSegments.length}
      <div class="drag-chart" role="img" aria-label={`Distribución en ${selectedCountryName}`}>
        {#each countryChartSegments as seg}
          <div
            class="drag-seg"
            style={`width:${seg.pct}%; background:${seg.color}`}
            title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
          ></div>
        {/each}
      </div>
    {:else if worldChartSegments.length}
      <div class="drag-chart" role="img" aria-label="Distribución global">
        {#each worldChartSegments as seg}
          <div
            class="drag-seg"
            style={`width:${seg.pct}%; background:${seg.color}`}
            title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
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
  {#if displayOptions.length > 0 && state === 'expanded'}
    <!-- Contenedor scrolleable que incluye TODO cuando está expandido -->
    <div 
      class="main-scroll-container vote-cards-grid" 
      onscroll={handlePollScroll}
      onpointerdown={onPointerDown}
      ontouchstart={onPointerDown}
      bind:this={scrollContainer}
    >
      <div class="vote-cards-section">
      <!-- Título del tema arriba de las tarjetas -->
      <div 
        class="topic-header"
      >
        {#if Math.random() > 0.7}
          {@const creatorNames = ['María González', 'Carlos Ruiz', 'Ana López', 'Pedro Martínez']}
          {@const creatorName = creatorNames[Math.floor(Math.random() * creatorNames.length)]}
          {@const avatarHue = Math.floor(Math.random() * 360)}
          <!-- Encuesta específica -->
          <div class="header-with-avatar">
            <div class="header-content">
              <h3>¿Cuál debería ser la prioridad del gobierno para 2024?</h3>
              <div class="topic-meta">
                <span class="topic-type">Encuesta • {selectedCountryName || 'Global'}</span>
                <span class="topic-time">• {getRelativeTime(Math.floor(Math.random() * 1440))}</span>
              </div>
            </div>
            <div class="header-avatar header-avatar-real">
              <img src="https://i.pravatar.cc/150?img={Math.floor(Math.random() * 70) + 1}" alt="Avatar" />
            </div>
          </div>
        {:else if Math.random() > 0.5}
          {@const creatorNames = ['María González', 'Carlos Ruiz', 'Ana López', 'Pedro Martínez']}
          {@const creatorName = creatorNames[Math.floor(Math.random() * creatorNames.length)]}
          {@const avatarHue = Math.floor(Math.random() * 360)}
          <!-- Hashtag trending -->
          <div class="header-with-avatar">
            <div class="header-content">
              <h3 data-type="hashtag">#CambioClimático2024</h3>
              <div class="topic-meta">
                <span class="topic-type">Hashtag trending • {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
                <span class="topic-time">• {getRelativeTime(Math.floor(Math.random() * 720))}</span>
              </div>
            </div>
            <div class="header-avatar header-avatar-real">
              <img src="https://i.pravatar.cc/150?img={Math.floor(Math.random() * 70) + 1}" alt="Avatar" />
            </div>
          </div>
        {:else if selectedCountryName && selectedSubdivisionName}
          {@const creatorNames = ['María González', 'Carlos Ruiz', 'Ana López', 'Pedro Martínez']}
          {@const creatorName = creatorNames[Math.floor(Math.random() * creatorNames.length)]}
          {@const avatarHue = Math.floor(Math.random() * 360)}
          <!-- Trending regional -->
          <div class="header-with-avatar">
            <div class="header-content">
              <h3>Trending en {selectedSubdivisionName}</h3>
              <div class="topic-meta">
                <span class="topic-type">Encuestas más votadas • {selectedCountryName}</span>
                <span class="topic-time">• {getRelativeTime(Math.floor(Math.random() * 360))}</span>
              </div>
            </div>
            <div class="header-avatar header-avatar-real">
              <img src="https://i.pravatar.cc/150?img={Math.floor(Math.random() * 70) + 1}" alt="Avatar" />
            </div>
          </div>
        {:else if selectedCountryName}
          {@const creatorNames = ['María González', 'Carlos Ruiz', 'Ana López', 'Pedro Martínez']}
          {@const creatorName = creatorNames[Math.floor(Math.random() * creatorNames.length)]}
          {@const avatarHue = Math.floor(Math.random() * 360)}
          <!-- Trending nacional -->
          <div class="header-with-avatar">
            <div class="header-content">
              <h3>Trending en {selectedCountryName}</h3>
              <div class="topic-meta">
                <span class="topic-type">Encuestas más votadas • Nacional</span>
                <span class="topic-time">• {getRelativeTime(Math.floor(Math.random() * 180))}</span>
              </div>
            </div>
            <div class="header-avatar header-avatar-real">
              <img src="https://i.pravatar.cc/150?img={Math.floor(Math.random() * 70) + 1}" alt="Avatar" />
            </div>
          </div>
        {:else}
          {@const creatorNames = ['María González', 'Carlos Ruiz', 'Ana López', 'Pedro Martínez']}
          {@const creatorName = creatorNames[Math.floor(Math.random() * creatorNames.length)]}
          {@const avatarHue = Math.floor(Math.random() * 360)}
          <!-- Trending global -->
          <div class="header-with-avatar">
            <div class="header-content">
              <h3>Trending Global</h3>
              <div class="topic-meta">
                <span class="topic-type">Encuestas más votadas • Mundial</span>
                <span class="topic-time">• {getRelativeTime(Math.floor(Math.random() * 120))}</span>
              </div>
            </div>
            <div class="header-avatar header-avatar-real">
              <img src="https://i.pravatar.cc/150?img={Math.floor(Math.random() * 70) + 1}" alt="Avatar" />
            </div>
          </div>
        {/if}
      </div>
      
      <div class="vote-cards-grid accordion fullwidth {activeAccordionMainIndex != null ? 'open' : ''} {paginatedMainOptions.items.length === 1 ? 'compact-one' : ''} {transitionDirectionMain ? 'page-transition page-transition-' + transitionDirectionMain : ''}"
           style="--items: {paginatedMainOptions.items.length}"
           role="group" aria-label="Opciones de encuesta"
           bind:this={mainGridRef}
           onpointerdown={(e) => handleDragStart(e)}
           ontouchstart={(e) => handleDragStart(e)}>
        {#each paginatedMainOptions.items as option, index}
          <button 
            class="vote-card {activeAccordionMainIndex === index ? 'is-active' : ''} {(state !== 'expanded' || activeAccordionMainIndex !== index) ? 'collapsed' : ''}" 
            style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, option.pct))}%; --fill-pct-val: {Math.max(0, Math.min(100, option.pct))}; --flex: {Math.max(0.5, option.pct / 10)};" 
            onclick={() => {
              // Si solo hay 1 opción, no hacer nada (solo mostrar gráfico)
              if (paginatedMainOptions.items.length === 1) { return; }
              // Si hay más de 1 opción, usar lógica de acordeón
              if (activeAccordionMainIndex !== index) { setActiveMain(index); return; }
              handleVote(option.key);
            }}
            onfocus={() => paginatedMainOptions.items.length > 1 ? setActiveMain(index) : null}
            onkeydown={(e) => onCardKeydown(e, option.key)}
            type="button"
          >
            <!-- Header con avatar y título -->
            <div class="card-header">
              <h2 class="question-title">{getCardTitle(index, 'main')}</h2>
              <img class="creator-avatar" src={`https://i.pravatar.cc/40?u=${encodeURIComponent(creatorsByOption?.[option.key]?.name || option.key)}`} alt="Avatar" loading="lazy" />
            </div>

            <!-- Contenido principal -->
            <div class="card-content">
              {#if paginatedMainOptions.items.length === 1}
                <!-- Gráfico para encuestas de una sola opción -->
                <div class="vote-chart-container">
                  <svg 
                    class="vote-chart" 
                    viewBox="0 0 300 150" 
                    preserveAspectRatio="none"
                    onmousedown="{(e) => handleChartBrushStart(e, e.currentTarget)}"
                    onmousemove="{(e) => isBrushing ? handleChartBrushMove(e, e.currentTarget) : handleChartMouseMove(e, e.currentTarget)}"
                    onmouseup="{handleChartBrushEnd}"
                    onmouseleave="{() => { handleChartBrushEnd(); handleChartMouseLeave(); }}"
                    ontouchstart="{(e) => handleChartBrushStart(e, e.currentTarget)}"
                    ontouchmove="{(e) => handleChartBrushMove(e, e.currentTarget)}"
                    ontouchend="{handleChartBrushEnd}"
                    ontouchcancel="{handleChartBrushEnd}"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:{option.color};stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:{option.color};stop-opacity:0" />
                      </linearGradient>
                    </defs>
                    <!-- Área bajo la curva -->
                    <path
                      d="{createChartPath(historicalData, 300, 150)} L 300,150 L 0,150 Z"
                      fill="url(#chartGradient)"
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
                        <clipPath id="activeClip">
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
                        clip-path="url(#activeClip)"
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
                        class:active="{selectedTimeRange === range.id}"
                        onclick="{(e) => { e.stopPropagation(); selectedTimeRange = range.id; }}"
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
                    style="font-size: {(activeAccordionMainIndex === index && state === 'expanded'
                      ? fontSizeForPct(option.pct)
                      : Math.min(fontSizeForPct(option.pct), 21))}px"
                  >
                    {Math.round(option.pct)}
                  </span>
                </div>
              {/if}
              
              <!-- Avatares de amigos posicionados absolutamente -->
              <div class="friend-avatars-absolute">
                {#each (friendsByOption?.[option.key] || [
                  { id: '1', name: 'Ana García', avatarUrl: `https://i.pravatar.cc/40?u=ana` },
                  { id: '2', name: 'Carlos López', avatarUrl: `https://i.pravatar.cc/40?u=carlos` },
                  { id: '3', name: 'María Silva', avatarUrl: `https://i.pravatar.cc/40?u=maria` }
                ]).slice(0, 3) as friend, i}
                  <img 
                    class="friend-avatar-floating" 
                    src={friend.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(friend.name || friend.id)}`} 
                    alt={friend.name}
                    title={friend.name}
                    loading="lazy"
                    style="z-index: {10 - i};"
                  />
                {/each}
              </div>
            </div>
          </button>
        {/each}
      </div>
      
      <!-- Indicadores de paginación tipo Instagram para main poll -->
      {#if shouldPaginateMain}
        <div class="pagination-dots {paginatedMainOptions.totalPages > 25 ? 'many-pages' : ''}">
          {#each Array(paginatedMainOptions.totalPages) as _, pageIndex}
            <button 
              class="pagination-dot {pageIndex === currentPageMain ? 'active' : ''}"
              onclick={() => { 
                const oldPage = currentPageMain;
                transitionDirectionMain = pageIndex < oldPage ? 'prev' : 'next';
                currentPageMain = pageIndex;
                setTimeout(() => {
                  const newPageOptions = getPaginatedOptions(sortedDisplayOptions, pageIndex);
                  activeAccordionMainIndex = pageIndex < oldPage 
                    ? newPageOptions.items.length - 1 
                    : 0;
                }, 50);
                setTimeout(() => { transitionDirectionMain = null; }, 400);
              }}
              type="button"
              aria-label="Bloque {pageIndex + 1}"
            ></button>
          {/each}
        </div>
      {/if}
      
      <!-- Información total debajo de las tarjetas -->
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
            <span>{formatNumber(displayOptions.length)}</span>
          </div>
          <div class="stat-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>{formatNumber(Math.floor(Math.random() * 2000) + 1000)}</span>
          </div>
        </div>
        <div class="vote-actions">
          <button class="action-badge" type="button" title="Guardar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{formatNumber(Math.floor(Math.random() * 50) + 10)}</span>
          </button>
          <button class="action-badge" type="button" title="Republicar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M17 1l4 4-4 4"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <path d="M7 23l-4-4 4-4"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            <span>{formatNumber(Math.floor(Math.random() * 30) + 5)}</span>
          </button>
          <button class="action-badge action-share" type="button" title="Compartir">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>{formatNumber(Math.floor(Math.random() * 20) + 2)}</span>
          </button>
          <button class="action-badge" type="button" title="Información">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Separador y título de otras encuestas -->
      {#if additionalPolls.length > 0 || state === 'expanded'}
        <div 
          class="more-polls-divider"
        >
          <div class="divider-line"></div>
          <span class="divider-text">Ver otras encuestas de {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
          <div class="divider-line"></div>
        </div>
      {/if}
      </div> <!-- Cierre de vote-cards-section -->
      
      <!-- Encuestas adicionales dentro del mismo contenedor scrolleable -->
      {#each additionalPolls as poll, pollIndex (poll.id)}
        {@const pollCreators = ['Laura Sánchez', 'Miguel Torres', 'Isabel Moreno', 'Diego Fernández', 'Carmen Ruiz', 'Antonio López']}
        {@const pollCreator = pollCreators[pollIndex % pollCreators.length]}
        {@const pollAvatarHue = (pollIndex * 60) % 360}
        
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
        {#if pollIndex === 5 && pollIndex < additionalPolls.length - 2}
          <div class="suggestions-card">
            <h4 class="suggestions-title">A quién seguir</h4>
            <div class="suggestions-scroll">
              {#each Array(8) as _, idx}
                {@const names = ['Ana Martínez', 'Carlos López', 'María Gómez', 'Juan Pérez', 'Laura Fernández', 'Pedro Sánchez', 'Sofía Ruiz', 'Diego Torres']}
                {@const bios = ['Activista social', 'Periodista político', 'Economista', 'Experto en clima', 'Analista de datos', 'Comentarista', 'Investigadora', 'Consultor']}
                <div class="suggestion-item">
                  <div class="suggestion-avatar" style="background: linear-gradient({135 + idx * 30}deg, hsl({idx * 45}, 70%, 60%), hsl({idx * 45 + 40}, 70%, 50%))">
                    {names[idx].charAt(0)}
                  </div>
                  <div class="suggestion-info">
                    <span class="suggestion-name">{names[idx]}</span>
                    <span class="suggestion-bio">{bios[idx]}</span>
                    <span class="suggestion-followers">{formatNumber(Math.floor(Math.random() * 50000) + 1000)} seguidores</span>
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
                  <h3 class="poll-question" data-type="hashtag">#{poll.question}</h3>
                  <div class="poll-meta">
                    <span class="poll-type">Hashtag trending • {poll.region}</span>
                    <span class="poll-time">• {getRelativeTime(Math.floor(Math.random() * 2880))}</span>
                  </div>
                {:else if poll.type === 'trending'}
                  <h3 class="poll-question">Trending en {poll.region}</h3>
                  <div class="poll-meta">
                    <span class="poll-type">Encuestas más votadas</span>
                    <span class="poll-time">• {getRelativeTime(Math.floor(Math.random() * 1440))}</span>
                  </div>
                {:else}
                  <h3 class="poll-question">{poll.question}</h3>
                  <div class="poll-meta">
                    <span class="poll-type">Encuesta • {poll.region}</span>
                    <span class="poll-time">• {getRelativeTime(Math.floor(Math.random() * 5760))}</span>
                  </div>
                {/if}
              </div>
              <div class="header-avatar header-avatar-real">
                <img src="https://i.pravatar.cc/150?img={pollIndex % 70 + 1}" alt="Avatar" />
              </div>
            </div>
          </div>
          
          <!-- Grid de opciones de votación -->
          {#each [poll] as p}
            {@const sortedPollOptions = getNormalizedOptions(p).sort((a, b) => b.pct - a.pct)}
            {@const shouldPaginatePoll = sortedPollOptions.length > OPTIONS_PER_PAGE}
            {@const paginatedPoll = shouldPaginatePoll 
              ? getPaginatedOptions(sortedPollOptions, currentPageByPoll[p.id] || 0)
              : { items: sortedPollOptions, totalPages: 1, hasNext: false, hasPrev: false }}
            {@const isChartView = (currentPageByPoll[poll.id] || 0) === -1}
            <div class="vote-cards-grid accordion fullwidth {activeAccordionByPoll[p.id] != null ? 'open' : ''} {paginatedPoll.items.length === 1 || isChartView ? 'compact-one' : ''} {transitionDirectionByPoll[p.id] ? 'page-transition page-transition-' + transitionDirectionByPoll[p.id] : ''}"
                 style="--items: {isChartView ? 1 : paginatedPoll.items.length}"
                 role="group" aria-label={`Opciones de ${p.region}`}
                 bind:this={pollGridRefs[p.id]}
                 onpointerdown={(e) => handleDragStart(e, p.id)}
                 ontouchstart={(e) => handleDragStart(e, p.id)}>
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
                    <h2 class="question-title">{poll.region}</h2>
                    <img class="creator-avatar" src={`https://i.pravatar.cc/40?u=${encodeURIComponent(poll.creator?.name || poll.id)}`} alt="Avatar" loading="lazy" />
                  </div>

                  <!-- Contenido principal: gráfico combinado -->
                  <div class="card-content">
                    <div class="vote-chart-container">
                      <svg 
                        class="vote-chart" 
                        viewBox="0 0 300 150" 
                        preserveAspectRatio="none"
                        onmousedown="{(e) => handleChartBrushStart(e, e.currentTarget)}"
                        onmousemove="{(e) => isBrushing ? handleChartBrushMove(e, e.currentTarget) : handleChartMouseMove(e, e.currentTarget)}"
                        onmouseup="{handleChartBrushEnd}"
                        onmouseleave="{() => { handleChartBrushEnd(); handleChartMouseLeave(); }}"
                        ontouchstart="{(e) => handleChartBrushStart(e, e.currentTarget)}"
                        ontouchmove="{(e) => handleChartBrushMove(e, e.currentTarget)}"
                        ontouchend="{handleChartBrushEnd}"
                        ontouchcancel="{handleChartBrushEnd}"
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
                          const dataIndex = Math.round((chartHoverData.x / 300) * (optData.length - 1));
                          return optData[dataIndex]?.votes || 0;
                        }).reduce((sum, votes) => sum + votes, 0)}
                        <div class="chart-tooltip">
                          <div class="tooltip-header">
                            <div class="tooltip-date">{formatChartDate(chartHoverData.date, selectedTimeRange)}</div>
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
                            {@const dataIndex = Math.round((chartHoverData.x / 300) * (optData.length - 1))}
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
                            class:active="{selectedTimeRange === range.id}"
                            onclick="{(e) => { e.stopPropagation(); selectedTimeRange = range.id; }}"
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
              {#each paginatedPoll.items as option, index}
              <button 
                class="vote-card {activeAccordionByPoll[poll.id] === index ? 'is-active' : ''} {(state !== 'expanded' || activeAccordionByPoll[poll.id] !== index) ? 'collapsed' : ''}" 
                style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, option.pct))}%; --fill-pct-val: {Math.max(0, Math.min(100, option.pct))}; --flex: {Math.max(0.5, option.pct / 10)};" 
                onclick={() => {
                  // Si solo hay 1 opción, no hacer nada (solo mostrar gráfico)
                  if (paginatedPoll.items.length === 1) { return; }
                  // Si hay más de 1 opción, usar lógica de acordeón
                  if (activeAccordionByPoll[poll.id] !== index) { setActiveForPoll(poll.id, index); return; }
                  handleVote(option.key, poll.id);
                }}
                onfocus={() => paginatedPoll.items.length > 1 ? setActiveForPoll(poll.id, index) : null}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (activeAccordionByPoll[poll.id] !== index) { setActiveForPoll(poll.id, index); return; }
                    handleVote(option.key, poll.id);
                  }
                }}
                type="button"
              >
                <!-- Header con avatar y título -->
                <div class="card-header">
                  <h2 class="question-title">{getCardTitle(index, 'additional', poll.type)}</h2>
                  <img class="creator-avatar" src={`https://i.pravatar.cc/40?u=${encodeURIComponent(poll.creator?.name || option.key)}`} alt="Avatar" loading="lazy" />
                </div>

                <!-- Contenido principal -->
                <div class="card-content">
                  {#if paginatedPoll.items.length === 1}
                    <!-- Gráfico para encuestas de una sola opción -->
                    <div class="vote-chart-container">
                      <svg 
                        class="vote-chart" 
                        viewBox="0 0 300 150" 
                        preserveAspectRatio="none"
                        onmousedown="{(e) => handleChartBrushStart(e, e.currentTarget)}"
                        onmousemove="{(e) => isBrushing ? handleChartBrushMove(e, e.currentTarget) : handleChartMouseMove(e, e.currentTarget)}"
                        onmouseup="{handleChartBrushEnd}"
                        onmouseleave="{() => { handleChartBrushEnd(); handleChartMouseLeave(); }}"
                        ontouchstart="{(e) => handleChartBrushStart(e, e.currentTarget)}"
                        ontouchmove="{(e) => handleChartBrushMove(e, e.currentTarget)}"
                        ontouchend="{handleChartBrushEnd}"
                        ontouchcancel="{handleChartBrushEnd}"
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
                            class:active="{selectedTimeRange === range.id}"
                            onclick="{(e) => { e.stopPropagation(); selectedTimeRange = range.id; }}"
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
                  
                  <!-- Avatares de amigos posicionados absolutamente -->
                  <div class="friend-avatars-absolute">
                    {#each (poll.friendsByOption?.[option.key] || [
                      { id: '1', name: 'Ana García', avatarUrl: `https://i.pravatar.cc/40?u=ana${poll.id}` },
                      { id: '2', name: 'Carlos López', avatarUrl: `https://i.pravatar.cc/40?u=carlos${poll.id}` },
                      { id: '3', name: 'María Silva', avatarUrl: `https://i.pravatar.cc/40?u=maria${poll.id}` }
                    ]).slice(0, 3) as friend, i}
                      <img 
                        class="friend-avatar-floating" 
                        src={friend.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(friend.name || friend.id)}`} 
                        alt={friend.name}
                        title={friend.name}
                        loading="lazy"
                        style="z-index: {10 - i};"
                      />
                    {/each}
                  </div>
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
                      transitionDirectionByPoll[poll.id] = pageIndex < oldPage ? 'prev' : 'next';
                      currentPageByPoll[poll.id] = pageIndex;
                      setTimeout(() => {
                        const sortedOptions = getNormalizedOptions(poll).sort((a, b) => b.pct - a.pct);
                        const newPageOptions = getPaginatedOptions(sortedOptions, pageIndex);
                        activeAccordionByPoll[poll.id] = pageIndex < oldPage 
                          ? newPageOptions.items.length - 1 
                          : 0;
                      }, 50);
                      setTimeout(() => { transitionDirectionByPoll[poll.id] = null; }, 400);
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
                  class:active="{(currentPageByPoll[poll.id] || 0) === -1}"
                  type="button" 
                  title="{(currentPageByPoll[poll.id] || 0) === -1 ? 'Vista opciones' : 'Vista gráfico'}"
                  onclick="{() => { 
                    if ((currentPageByPoll[poll.id] || 0) === -1) {
                      exitChartView(poll.id);
                    } else {
                      goToChartView(poll.id);
                    }
                  }}"
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
                  <span>{formatNumber(Math.floor(Math.random() * 50) + 10)}</span>
                </button>
                <button class="action-badge" type="button" title="Republicar">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M17 1l4 4-4 4"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <path d="M7 23l-4-4 4-4"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  <span>{formatNumber(Math.floor(Math.random() * 30) + 5)}</span>
                </button>
                <button class="action-badge action-share" type="button" title="Compartir">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span>{formatNumber(Math.floor(Math.random() * 20) + 2)}</span>
                </button>
                <button class="action-badge" type="button" title="Información">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/each}
      
      <!-- Indicador de carga -->
      {#if additionalPolls.length > 0}
        <div class="loading-more">
          <div class="loading-spinner"></div>
          <span>Cargando más encuestas...</span>
        </div>
      {/if}
    </div> <!-- Cierre de main-scroll-container -->
  {/if}
  
  <!-- Mostrar encuesta principal sin scroll cuando NO está expandido -->
  {#if displayOptions.length > 0 && state !== 'expanded'}
    <div class="vote-cards-section">
      <!-- Aquí se mostraría la encuesta principal en modo collapsed/peek -->
    </div>
  {/if}
  
  {#if voteOptions.length === 0 || state !== 'expanded'}
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
        aria-label={`Ver más de ${hintTarget}`}
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
</div>
