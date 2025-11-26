<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { currentUser } from '$lib/stores';
  import MediaEmbed from '$lib/components/MediaEmbed.svelte';
  
  const dispatch = createEventDispatcher();
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  let showDoubleClickTooltip: boolean = false;
  let showVoteConfirmation: boolean = false;
  let showVoteRemoval: boolean = false;
  let voteConfirmationColor: string = '#10b981';
  let voteRemovalColor: string = '#ef4444';
  let tooltipTimeout: any = null;
  let clickTimeout: any = null;
  let voteConfirmationTimeout: any = null;
  let voteRemovalTimeout: any = null;
  let clickCount = 0;
  let pendingOptionKey: string | null = null;
  let touchStartPosition: { x: number, y: number } | null = null;
  const DOUBLE_CLICK_DELAY = 500; // ms
  const TOUCH_MOVE_THRESHOLD = 10; // px
  
  // Long press tooltip
  let showLongPressTooltip: boolean = false;
  let longPressTooltipText: string = '';
  let longPressTimer: any = null;
  let longPressActivated: boolean = false; // Flag para evitar interferencia con doble click
  const LONG_PRESS_DELAY = 500; // ms
  
  
  // Debug console para móvil
  let debugLogs: string[] = [];
  let showDebugConsole = false;
  
  function addDebugLog(message: string) {
    debugLogs = [...debugLogs.slice(-50), `${new Date().toLocaleTimeString()}: ${message}`];
    console.log(message);
  }
  
  function copyDebugLogs() {
    const text = debugLogs.join('\n');
    
    // Intentar con clipboard API (solo funciona en HTTPS)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Logs copiados al portapapeles');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }
  
  function fallbackCopy(text: string) {
    // Fallback para HTTP: mostrar en textarea para copiar manualmente
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '100%';
    textarea.style.height = '200px';
    textarea.style.zIndex = '99999';
    textarea.style.background = 'white';
    textarea.style.color = 'black';
    document.body.appendChild(textarea);
    textarea.select();
    
    alert('Selecciona todo el texto y cópialo manualmente (Ctrl+C). Luego cierra.');
    
    setTimeout(() => {
      document.body.removeChild(textarea);
    }, 30000);
  }
  
  // Funciones para modal de preview - dispatch evento al padre
  function openPreviewModal(option: any) {
    addDebugLog(`🎬 Abriendo modal fullscreen para: ${option.key}`);
    dispatch('openPreviewModal', { option, pollId: poll.id });
  }
  
  // Log inicial cuando el componente se monta
  onMount(() => {
    addDebugLog('✅ Debug console inicializada');
    if (poll) {
      addDebugLog(`📊 Poll ID: ${poll.id || 'N/A'}`);
      addDebugLog(`📋 Opciones: ${poll.options?.length || 0}`);
    }
  });
  
  // Title tooltip (para títulos truncados)
  let showTitleTooltip: boolean = false;
  let titleTooltipText: string = '';
  
  const OPTIONS_PER_PAGE = 4;
  
  // Props
  export let poll: any;
  export let state: string = 'collapsed';
  export let activeAccordionIndex: number | null = null;
  export let currentPage: number = 0;
  export let userVotes: Record<string, string> = {};
  export let multipleVotes: Record<string, string[]> = {};
  export const pollIndex: number = 0;
  
  // Dirección de paginación
  let paginationDirection: 'forward' | 'backward' = 'forward';
  let lastPage: number = currentPage;
  
  // Detectar cambio de página y actualizar dirección ANTES del render
  $: if (currentPage !== lastPage) {
    paginationDirection = currentPage > lastPage ? 'forward' : 'backward';
    console.log('[Pagination] Dirección:', paginationDirection, 'cambio:', lastPage, '→', currentPage);
    lastPage = currentPage;
  }
  
  // Estado para gráfico histórico
  let selectedTimeRange = '1m';
  let historicalData: Array<{x: number, y: number, votes: number, date: Date}> = [];
  let historicalDataByOption: Map<string, Array<{x: number, y: number, color: string, label: string}>> = new Map();
  let isLoadingHistory = false;
  let chartHoverData: {x: number, y: number, votes: number, date: Date} | null = null;
  let chartSvgElement: SVGElement | null = null;
  let pollOptions: Array<{optionKey: string, optionLabel: string, color: string}> = [];
  
  const timeRanges = [
    { id: '1d', label: '1D', days: 1 },
    { id: '5d', label: '5D', days: 5 },
    { id: '1m', label: '1M', days: 30 },
    { id: '6m', label: '6M', days: 180 },
    { id: '1y', label: '1A', days: 365 }
  ];
  
  // Cargar datos históricos cuando entramos en la vista de gráfico
  $: if (currentPage === -1 && poll?.id) {
    console.log('[Chart] Entrando en vista de gráfico, currentPage:', currentPage, 'pollId:', poll.id);
    loadHistoricalData();
  }
  
  // Debug: mostrar cuando cambia currentPage
  $: console.log('[Chart] currentPage cambió a:', currentPage);
  
  async function loadHistoricalData() {
    if (isLoadingHistory) return;
    
    isLoadingHistory = true;
    try {
      const days = timeRanges.find(r => r.id === selectedTimeRange)?.days || 30;
      const response = await fetch(`/api/polls/${poll.id}/votes-history?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      const timeSeriesData = result.data || [];
      const pollData = result.poll || {};
      const meta = result.meta || {};
      
      console.log('[Chart] Datos recibidos:', {
        puntos: timeSeriesData.length,
        votosEnDB: meta.totalVotesFromDB,
        votosEnSeries: meta.totalVotesInSeries,
        coinciden: meta.totalVotesFromDB === meta.totalVotesInSeries
      });
      
      // DEBUG: Ver primeros 3 puntos
      console.log('[Chart] Primeros 3 puntos:', timeSeriesData.slice(0, 3).map((p: any) => ({
        fecha: new Date(p.timestamp).toISOString(),
        totalVotes: p.totalVotes,
        opciones: p.optionsData?.length
      })));
      
      if (timeSeriesData.length === 0) {
        console.warn('[Chart] No hay votos en este rango de tiempo');
        historicalData = [];
        historicalDataByOption.clear();
        return;
      }
      
      // Guardar opciones de la encuesta
      pollOptions = pollData.options || [];
      
      // Crear series por opción, asegurando datos en todos los períodos
      const seriesByOption = new Map<string, Array<{x: number, y: number, color: string, label: string}>>();
      
      // Inicializar series vacías
      pollOptions.forEach(option => {
        seriesByOption.set(option.optionKey, []);
      });
      
      // Llenar datos para cada opción en cada punto temporal
      timeSeriesData.forEach((point: any) => {
        const optionsData = point.optionsData  || [];
        const optionsDataMap = new Map(optionsData.map((opt: any) => [opt.optionKey, opt]));
        
        // Asegurar que TODAS las opciones tengan un punto en este timestamp
        pollOptions.forEach(option => {
          const series = seriesByOption.get(option.optionKey);
          const optData = optionsDataMap.get(option.optionKey) as { optionKey: string, votes: number } | undefined;
          
          if (series) {
            series.push({
              x: point.timestamp,
              y: optData?.votes  || 0, // 0 si no hay votos en este período
              color: option.color || '#3b82f6',
              label: option.optionLabel
            });
          }
        });
      });
      
      historicalDataByOption = seriesByOption;
      
      // También mantener datos totales para referencia
      historicalData = timeSeriesData.map((point: any) => ({
        x: point.timestamp,
        y: point.totalVotes,
        votes: point.totalVotes,
        date: new Date(point.timestamp)
      }));
      
      console.log('[Chart] Procesadas', seriesByOption.size, 'series con', historicalData.length, 'puntos cada una');
      
    } catch (error) {
      console.error('[Chart] Error cargando datos históricos:', error);
      historicalData = [];
    } finally {
      isLoadingHistory = false;
    }
  }
  
  function changeTimeRange(rangeId: string) {
    if (selectedTimeRange !== rangeId) {
      selectedTimeRange = rangeId;
      loadHistoricalData();
    }
  }
  
  // Crear path SVG desde los datos
  function createChartPath(data: Array<{x: number, y: number}>, width: number, height: number): string {
    if (!data || data.length === 0) {
      return '';
    }
    
    // Filtrar puntos inválidos
    const validData = data.filter(d => 
      d && 
      typeof d.x === 'number' && !isNaN(d.x) && 
      typeof d.y === 'number' && !isNaN(d.y)
    );
    
    if (validData.length === 0) {
      console.warn('[Chart Path] Sin datos válidos después de filtrar');
      return '';
    }
    
    const minY = Math.min(...validData.map(d => d.y));
    const maxY = Math.max(...validData.map(d => d.y));
    const rangeY = maxY - minY || 1;
    
    const points = validData.map((d, i) => {
      const x = (i / Math.max(1, validData.length - 1)) * width;
      const normalizedY = (d.y - minY) / rangeY;
      const y = height - (normalizedY * (height - 20) + 10);
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    
    return `M ${points.join(' L ')}`;
  }
  
  // Manejar hover/touch en el gráfico
  function handleChartInteraction(event: MouseEvent | TouchEvent) {
    if (!chartSvgElement || historicalData.length === 0) return;
    
    event.preventDefault();
    const rect = chartSvgElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = clientX - rect.left;
    
    // Calcular posición relativa (0 a 1)
    const relativeX = Math.max(0, Math.min(1, x / rect.width));
    
    // Encontrar el punto de datos más cercano
    const dataIndex = Math.round(relativeX * (historicalData.length - 1));
    const dataPoint = historicalData[dataIndex];
    
    if (dataPoint) {
      // Calcular la posición Y real del punto en el SVG
      const minY = Math.min(...historicalData.map(d => d.y));
      const maxY = Math.max(...historicalData.map(d => d.y));
      const rangeY = maxY - minY || 1;
      const normalizedY = (dataPoint.y - minY) / rangeY;
      const svgY = 200 - (normalizedY * 180 + 10); // 200 es la altura, dejando padding
      
      chartHoverData = {
        x: x, // Usar la posición real del mouse
        y: dataPoint.y, // Valor real de los datos
        votes: dataPoint.votes,
        date: dataPoint.date
      };
      
      console.log('[Chart Hover] Índice:', dataIndex, 'Votos:', dataPoint.votes, 'Fecha:', dataPoint.date.toLocaleString());
    }
  }
  
  function clearChartHover() {
    chartHoverData = null;
  }
  
  // Title expansion state
  export let pollTitleExpanded: Record<string, boolean> = {};
  export let pollTitleTruncated: Record<string, boolean> = {};
  export let pollTitleElements: Record<string, HTMLElement> = {};
  
  // Vote effect state (passed from parent)
  export let voteEffectActive: boolean = false;
  export let voteEffectPollId: string | null = null;
  export let displayVotes: Record<string, string> = {};
  export let voteClickX: number = 0;
  export let voteClickY: number = 0;
  export let voteIconX: number = 0;
  export let voteIconY: number = 0;
  export let voteEffectColor: string = '#10b981';
  
  // Profile modal state (bindable, controlled from +page.svelte)
  export let isProfileModalOpen: boolean = false;
  export let selectedProfileUserId: number | null = null;
  
  let pollGridRef: HTMLElement;
  let voteIconElement: HTMLElement | null = null;
  
  // Trackear el texto de las opciones en edición para reactividad
  let editingOptionLabels: Record<string, string> = {};
  
  // Helper functions
  function normalizeTo100(values: number[]): number[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return values.map(() => 0);
    return values.map(v => (v / total) * 100);
  }
  
  function formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  }
  
  function getRelativeTime(minutesAgo: number): string {
    if (minutesAgo < 60) return `${minutesAgo}min`;
    if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h`;
    if (minutesAgo < 43200) return `${Math.floor(minutesAgo / 1440)}d`;
    return `${Math.floor(minutesAgo / 525600)}a`;
  }
  
  function fontSizeForPct(pct: number): number {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    
    // Escala gradual más suave
    // 0-20%: 20-25px
    // 21-40%: 26-35px
    // 41-60%: 36-42px
    // 61-80%: 43-47px
    // 81-100%: 48-50px
    const size = 20 + (clamped * 0.3);  // De 20px a 50px de forma lineal
    
    return Math.max(20, Math.min(50, Math.round(size)));
  }
  
  function getNormalizedOptions(poll: any) {
    const opts = poll.options || [];
    const values = opts.map((o: any) => Number(o.votes) || 0);
    const norm = normalizeTo100(values);
    return opts.map((o: any, i: number) => ({ ...o, pct: norm[i] }));
  }
  
  function getPaginatedOptions(options: any[], page: number, perPage: number = OPTIONS_PER_PAGE) {
    const start = page * perPage;
    const end = start + perPage;
    const items = options.slice(start, end);
    return {
      items,
      totalPages: Math.ceil(options.length / perPage),
      hasNext: end < options.length,
      hasPrev: page > 0
    };
  }
  
  function isPollExpired(closedAt: Date | string | null | undefined): boolean {
    if (!closedAt) return false;
    return new Date(closedAt).getTime() < Date.now();
  }
  
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
  
  function getTimeRemainingColor(closedAt: Date | string | null | undefined): string {
    if (!closedAt) return 'normal';
    const now = Date.now();
    const end = new Date(closedAt).getTime();
    const diff = end - now;
    const hours = diff / (1000 * 60 * 60);
    if (hours <= 1) return 'critical';
    if (hours <= 6) return 'warning';
    return 'normal';
  }
  
  function checkTruncation(element: HTMLElement | undefined): boolean {
    if (!element) return false;
    return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
  }
  
  // Reactive data
  // NUNCA reordenar opciones para evitar confusión al usuario
  // Las opciones mantienen su orden original siempre
  $: sortedPollOptions = getNormalizedOptions(poll);
  $: paginatedPoll = getPaginatedOptions(sortedPollOptions, currentPage);
  $: isSingleOptionPoll = sortedPollOptions.length === 1;
  $: isExpired = poll.closedAt ? isPollExpired(poll.closedAt) : false;
  $: pollVotedOption = displayVotes[poll.id] || userVotes[poll.id];
  $: votedOptionData = pollVotedOption ? poll.options.find((o: any) => o.key === pollVotedOption) : null;
  
  // Event handlers
  function handleSetActive(index: number) {
    dispatch('setActive', { pollId: poll.id, index });
  }

  // Detectar scroll y actualizar índice activo
  function handleScrollChange() {
    if (!pollGridRef) return;
    
    const scrollLeft = pollGridRef.scrollLeft;
    const slideWidth = pollGridRef.children[0]?.clientWidth || 0;
    
    if (slideWidth === 0) return;
    
    // Calcular qué slide está más centrado
    const newIndex = Math.round(scrollLeft / slideWidth);
    
    // Actualizar solo si cambió
    if (newIndex !== activeAccordionIndex && newIndex >= 0 && newIndex < sortedPollOptions.length) {
      handleSetActive(newIndex);
    }
  }

  // Función de compartir con Open Graph
  async function sharePoll(event: MouseEvent) {
    event.stopPropagation();
    
    const shareUrl = `${window.location.origin}/poll/${poll.id}`;
    const shareTitle = poll.question || poll.title;
    const shareText = poll.description || `Vota en esta encuesta: ${shareTitle}`;

    // Intentar usar Web Share API (disponible en móviles y algunos navegadores desktop)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        console.log('[Share] Compartido exitosamente via Web Share API');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[Share] Error al compartir:', error);
          // Fallback: copiar al portapapeles
          copyToClipboard(shareUrl);
        }
      }
    } else {
      // Fallback: copiar al portapapeles
      copyToClipboard(shareUrl);
    }
  }

  function copyToClipboard(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showShareToast();
      }).catch(() => {
        // Fallback final
        fallbackCopyToClipboard(text);
      });
    } else {
      fallbackCopyToClipboard(text);
    }
  }

  function fallbackCopyToClipboard(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showShareToast();
    } catch (error) {
      console.error('[Share] Error copiando al portapapeles:', error);
    }
    document.body.removeChild(textarea);
  }

  let showShareToastFlag = false;
  let shareToastTimeout: any = null;
  
  function showShareToast() {
    showShareToastFlag = true;
    if (shareToastTimeout) clearTimeout(shareToastTimeout);
    shareToastTimeout = setTimeout(() => {
      showShareToastFlag = false;
    }, 2000);
  }
  
  // Long press handlers
  function startLongPress(optionText: string, event: MouseEvent | TouchEvent) {
    // Cancelar cualquier long press anterior
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    
    longPressActivated = false; // Resetear flag al inicio
    
    longPressTimer = setTimeout(() => {
      showLongPressTooltip = true;
      longPressTooltipText = optionText;
      longPressActivated = true; // Marcar que se activó el long press
      
      // Cancelar cualquier lógica de doble click en progreso
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }
      clickCount = 0;
      pendingOptionKey = null;
      showDoubleClickTooltip = false;
      
      console.log('[LongPress] Mostrando tooltip:', optionText);
    }, LONG_PRESS_DELAY);
  }
  
  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    showLongPressTooltip = false;
    longPressTooltipText = '';
    
    // Resetear flag después de un pequeño delay para evitar clicks inmediatos
    setTimeout(() => {
      longPressActivated = false;
    }, 100);
  }
  
  function handlePageChange(pageIndex: number) {
    dispatch('pageChange', { pollId: poll.id, page: pageIndex });
    // Abrir automáticamente la primera opción de la nueva página
    setTimeout(() => {
      dispatch('setActive', { pollId: poll.id, index: 0 });
      console.log('[SinglePoll] Abriendo primera opción de página:', pageIndex);
    }, 50);
  }
  
  function handleConfirmMultiple() {
    dispatch('confirmMultiple', { pollId: poll.id });
  }
  
  // Title tooltip handlers
  function showTitleTooltipHandler(text: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    console.log('[TitleTooltip] Intentando mostrar:', text);
    console.log('[TitleTooltip] showTitleTooltip antes:', showTitleTooltip);
    
    showTitleTooltip = true;
    titleTooltipText = text;
    
    console.log('[TitleTooltip] showTitleTooltip después:', showTitleTooltip);
    console.log('[TitleTooltip] titleTooltipText:', titleTooltipText);
    
    // Agregar listener global con delay para evitar que cierre inmediatamente
    setTimeout(() => {
      if (showTitleTooltip && typeof document !== 'undefined') {
        document.addEventListener('click', handleClickOutside, { once: false });
        console.log('[TitleTooltip] Listener global agregado');
      }
    }, 100);
  }
  
  function hideTitleTooltip() {
    console.log('[TitleTooltip] Ocultando tooltip');
    showTitleTooltip = false;
    titleTooltipText = '';
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside);
    }
  }
  
  // Listener global para cerrar tooltip al hacer click fuera
  function handleClickOutside(event: MouseEvent) {
    console.log('[TitleTooltip] Click fuera detectado');
    if (showTitleTooltip) {
      hideTitleTooltip();
    }
  }
  
  function handleAddOption() {
    console.log('[SinglePollSection] handleAddOption called:', { pollId: poll.id, previewColor });
    dispatch('addOption', { pollId: poll.id, previewColor });
  }
  
  function handleOpenInGlobe() {
    dispatch('openInGlobe', { poll });
  }
  
  function handleDragStart(e: PointerEvent | TouchEvent) {
    dispatch('dragStart', { event: e, pollId: poll.id });
  }
  
  // Generar color aleatorio para preview del botón
  const previewColors = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#dc2626', '#ea580c', '#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0d9488'
  ];
  const previewColor = previewColors[Math.floor(Math.random() * previewColors.length)];
</script>

<div class="poll-item">
  <!-- Sin DataBar superior, ahora va dentro del header -->

  <!-- Header de la encuesta simplificado -->
  <div class="poll-header-compact">
    <div class="header-compact-inner">
      <div class="header-avatar-mini">
        {#if poll.user?.avatarUrl}
          <button 
            class="avatar-button-mini" 
            onclick={(e) => {
              e.stopPropagation();
              if (poll.user?.id) {
                selectedProfileUserId = poll.user.id;
                isProfileModalOpen = true;
              }
            }}
            aria-label="Ver perfil de {poll.user.displayName || 'usuario'}"
          >
            <img src={poll.user.avatarUrl} alt={poll.user.displayName || 'Avatar'} loading="lazy" />
          </button>
        {:else}
          <div class="avatar-mini-default">
            <img src={DEFAULT_AVATAR} alt="Avatar" loading="lazy" />
          </div>
        {/if}
      </div>
      <div class="header-content-compact">
        {#if poll.type === 'hashtag'}
          <div class="poll-question-wrapper">
            <div class="poll-question-row" style="position: relative;">
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
              
              <!-- Botón de tooltip para título truncado -->
              {#if pollTitleTruncated[poll.id] || poll.question.length > 50}
                <button 
                  class="title-tooltip-btn"
                  onclick={(e) => showTitleTooltipHandler(`#${poll.question}`, e)}
                  title="Ver título completo"
                >
                  ⋯
                </button>
              {/if}
              {#if poll.closedAt}
                {@const timeColor = getTimeRemainingColor(poll.closedAt)}
                {@const timeText = getTimeRemaining(poll.closedAt)}
                <div class="time-remaining-badge {timeColor} {isExpired ? 'expired' : ''}">
                  {#if isExpired}
                    🔒 Cerrada
                  {:else}
                    ⏰ {timeText}
                  {/if}
                </div>
              {/if}
            </div>
            <div class="poll-meta">
              <span class="topic-type">Hashtag # • {poll.region || 'General'}</span>
              {#if poll.createdAt}
                <span class="topic-time">• {getRelativeTime(Math.floor((Date.now() - new Date(poll.createdAt).getTime()) / 60000))}</span>
              {/if}
            </div>
          </div>
        {:else}
          <div class="poll-question-wrapper">
            <div class="poll-question-row" style="position: relative;">
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
                {poll.question || poll.title}
                {#if pollTitleExpanded[poll.id]}
                  <span class="collapse-indicator-poll"> [−]</span>
                {/if}
              </h3>
              
              <!-- Botón de tooltip para título truncado -->
              {#if pollTitleTruncated[poll.id] || (poll.question || poll.title || '').length > 50}
                <button 
                  class="title-tooltip-btn"
                  onclick={(e) => showTitleTooltipHandler(poll.question || poll.title, e)}
                  title="Ver título completo"
                >
                  ⋯
                </button>
              {/if}
              {#if poll.closedAt}
                {@const timeColor = getTimeRemainingColor(poll.closedAt)}
                {@const timeText = getTimeRemaining(poll.closedAt)}
                <div class="time-remaining-badge {timeColor} {isExpired ? 'expired' : ''}">
                  {#if isExpired}
                    🔒 Cerrada
                  {:else}
                    ⏰ {timeText}
                  {/if}
                </div>
              {/if}
            </div>
            <div class="poll-meta">
              <span class="topic-type">
                {#if poll.type === 'multiple'}
                  Encuesta ☑️
                {:else if poll.type === 'collaborative'}
                  Encuesta 👥
                {:else}
                  Encuesta ⭕
                {/if}
                • {poll.region || 'General'}
              </span>
              {#if poll.createdAt}
                <span class="topic-time">• {getRelativeTime(Math.floor((Date.now() - new Date(poll.createdAt).getTime()) / 60000))}</span>
              {/if}
            </div>
          </div>
        {/if}
        
        <!-- Indicadores de opciones (debajo del título) -->
        <div class="options-indicators">
          {#each sortedPollOptions as opt, idx}
            {@const isCurrentOption = idx === activeAccordionIndex}
            {@const isPollVoted = poll.type === 'multiple'
              ? (multipleVotes[poll.id]?.includes(opt.key) || 
                 (displayVotes[poll.id] || userVotes[poll.id])?.split(',').includes(opt.key))
              : (displayVotes[poll.id] || userVotes[poll.id]) === opt.key}
            {@const hasVotedAny = !!(displayVotes[poll.id] || userVotes[poll.id])}
            {@const totalVotes = sortedPollOptions.reduce((sum, o) => sum + (o.votes || 0), 0)}
            {@const flexWeight = hasVotedAny 
              ? Math.max(opt.votes || 0, totalVotes * 0.02) 
              : 1}
            <button
              class="option-indicator {isCurrentOption ? 'active' : ''}"
              style="flex: {flexWeight} 1 0%; opacity: {isCurrentOption ? 1 : (hasVotedAny ? 0.3 : 0.5)}; transform: {hasVotedAny && isCurrentOption ? 'scaleY(1.5)' : 'scaleY(1)'};"
              onclick={(e) => {
                e.stopPropagation();
                // Actualizar índice activo primero
                handleSetActive(idx);
                // Scroll a la opción correspondiente
                if (pollGridRef && pollGridRef.children[0]) {
                  const containerWidth = pollGridRef.clientWidth;
                  const slideWidth = pollGridRef.children[0]?.clientWidth || containerWidth;
                  const targetScrollLeft = idx * slideWidth;
                  
                  pollGridRef.scrollTo({
                    left: targetScrollLeft,
                    behavior: 'smooth'
                  });
                }
              }}
              aria-label="Ver opción {idx + 1}: {opt.label}"
              type="button"
            >
              <div
                class="indicator-fill"
                style="width: {hasVotedAny ? '100%' : (idx < activeAccordionIndex ? '100%' : (isCurrentOption ? '100%' : '0%'))}; background-color: {hasVotedAny ? opt.color : (isCurrentOption ? '#fff' : 'rgba(255, 255, 255, 0.2)')};"
              ></div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Contenedor de opciones con scroll horizontal (estilo PollMaximizedView) -->
  <div class="poll-options-scroll-container" style="position: relative;">
    <!-- Vista de gráfico histórico (currentPage === -1) -->
    {#if currentPage === -1}
      <div class="historical-chart-wrapper">
        <!-- Área del gráfico con botones dentro -->
        <div class="chart-area">
          <!-- Botones de filtro posicionados absolutamente dentro -->
          <div class="time-pills-container" style="position: absolute; top: 8px; left: 8px; z-index: 10;">
            {#each timeRanges as range}
              <button
                class="time-button {selectedTimeRange === range.id ? 'selected' : ''}"
                onclick={(e) => {
                  e.stopPropagation();
                  console.log('[Chart] Cambiando rango a:', range.id);
                  changeTimeRange(range.id);
                }}
                type="button"
              >
                {range.label}
              </button>
            {/each}
          </div>
          
          <!-- Tooltip fijo superpuesto con z-index -->
          {#if chartHoverData}
            <div class="chart-tooltip-overlay">
              <div class="tooltip-value">{chartHoverData.votes} votos</div>
              <div class="tooltip-date">{chartHoverData.date.toLocaleString('es-ES', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}</div>
            </div>
          {/if}
          
            {#if isLoadingHistory}
              <div class="chart-loading">
                <span>Cargando...</span>
              </div>
            {:else if historicalDataByOption.size > 0}
              <svg 
                viewBox="0 0 300 200" 
                preserveAspectRatio="none"
                class="full-chart-svg"
                style="width: 100%; height: 100%; display: block;"
                bind:this={chartSvgElement}
                onmousemove={handleChartInteraction}
                onmouseleave={clearChartHover}
                ontouchstart={handleChartInteraction}
                ontouchmove={handleChartInteraction}
                ontouchend={clearChartHover}
              >
                
                <!-- Línea por cada opción -->
                {#each Array.from(historicalDataByOption.entries()) as [optionKey, seriesData]}
                  {@const chartPath = createChartPath(seriesData, 300, 200)}
                  {@const color = seriesData[0]?.color || '#3b82f6'}
                  
                  {#if chartPath}
                    <!-- Área con gradiente por opción -->
                    <defs>
                      <linearGradient id="grad-{poll.id}-{optionKey}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:{color};stop-opacity:0.15"/>
                        <stop offset="100%" style="stop-color:{color};stop-opacity:0"/>
                      </linearGradient>
                      
                      <!-- Gradiente atenuado para la parte derecha -->
                      <linearGradient id="grad-dimmed-{poll.id}-{optionKey}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:rgba(50, 50, 50, 0.08);stop-opacity:1"/>
                        <stop offset="100%" style="stop-color:rgba(50, 50, 50, 0);stop-opacity:0"/>
                      </linearGradient>
                      
                      <!-- Máscara para atenuar parte derecha cuando hay hover -->
                      {#if chartHoverData}
                        <mask id="mask-left-{poll.id}-{optionKey}">
                          <rect x="0" y="0" width="{chartHoverData.x}" height="200" fill="white"/>
                        </mask>
                        <mask id="mask-right-{poll.id}-{optionKey}">
                          <rect x="{chartHoverData.x}" y="0" width="{300 - chartHoverData.x}" height="200" fill="white"/>
                        </mask>
                      {/if}
                    </defs>
                    
                    {#if chartHoverData}
                      <!-- Área izquierda con color normal -->
                      <path 
                        d="{chartPath} L 300 200 L 0 200 Z"
                        fill="url(#grad-{poll.id}-{optionKey})"
                        mask="url(#mask-left-{poll.id}-{optionKey})"
                      />
                      <!-- Área derecha atenuada -->
                      <path 
                        d="{chartPath} L 300 200 L 0 200 Z"
                        fill="url(#grad-dimmed-{poll.id}-{optionKey})"
                        mask="url(#mask-right-{poll.id}-{optionKey})"
                      />
                    {:else}
                      <!-- Área completa sin hover -->
                      <path 
                        d="{chartPath} L 300 200 L 0 200 Z"
                        fill="url(#grad-{poll.id}-{optionKey})"
                      />
                    {/if}
                    
                    {#if chartHoverData}
                      <!-- Línea parte izquierda (color normal) -->
                      <path
                        d={chartPath}
                        fill="none"
                        stroke={color}
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.9"
                        mask="url(#mask-left-{poll.id}-{optionKey})"
                      />
                      <!-- Línea parte derecha (atenuada casi negra) -->
                      <path
                        d={chartPath}
                        fill="none"
                        stroke="rgba(50, 50, 50, 0.4)"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.5"
                        mask="url(#mask-right-{poll.id}-{optionKey})"
                      />
                    {:else}
                      <!-- Línea completa sin hover -->
                      <path
                        d={chartPath}
                        fill="none"
                        stroke={color}
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.9"
                      />
                    {/if}
                  {/if}
                {/each}
                
              </svg>
            {:else}
              <div class="chart-empty">
                <span>Sin datos históricos</span>
              </div>
            {/if}
        </div>
      </div>
    {:else}
      <!-- Tooltip de long press con texto completo -->
      {#if showLongPressTooltip}
        <div class="long-press-tooltip">
          {longPressTooltipText}
        </div>
      {/if}

      <!-- Scroll horizontal para opciones (estilo PollMaximizedView) -->
      <div 
        class="options-horizontal-scroll"
        role="region"
        aria-label="Opciones de {poll.question || poll.title}"
        bind:this={pollGridRef}
        onscroll={handleScrollChange}
      >
      {#each sortedPollOptions as option, index (option.key || option.id || index)}
        {@const isPollVoted = poll.type === 'multiple'
          ? (multipleVotes[poll.id]?.includes(option.key) || 
             (displayVotes[poll.id] || userVotes[poll.id])?.split(',').includes(option.key))
          : (displayVotes[poll.id] || userVotes[poll.id]) === option.key}
        {@const isNewOption = poll.type === 'collaborative' && option.isEditing === true}
        {@const displayPct = isNewOption ? 25 : option.pct}
        
        <div
          class="option-slide {index === activeAccordionIndex ? 'is-active' : ''} {isPollVoted ? 'voted' : ''}"
          style="scroll-snap-stop: always;" 
          ontouchstart={(e: TouchEvent) => {
            if (isNewOption) return;
            // Guardar posición inicial del touch
            touchStartPosition = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY
            };
          }}
          ontouchend={(e: TouchEvent) => {
            if (isNewOption) return;
            
            // Cancelar long press al soltar
            cancelLongPress();
            
            // Detectar si hubo movimiento significativo (swipe)
            if (touchStartPosition && e.changedTouches[0]) {
              const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartPosition.x);
              const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartPosition.y);
              
              // Si hubo movimiento > threshold, es un swipe, no un tap
              if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
                console.log('[SinglePoll] 👉 Swipe detectado, ignorando tap. Delta:', { deltaX, deltaY });
                touchStartPosition = null;
                clickCount = 0;
                pendingOptionKey = null;
                return;
              }
            }
            
            // Solo prevenir eventos si es un tap válido
            e.preventDefault();
            e.stopPropagation();
            
            clickCount += 1;
            pendingOptionKey = option.key;
            touchStartPosition = null;
            
            if (clickTimeout) clearTimeout(clickTimeout);
            
            clickTimeout = setTimeout(() => {
              if (clickCount >= 2) {
                // Doble touch → votar / desvotar
                console.log('[SinglePoll] ✅ DOBLE TOUCH confirmado - Votando:', pendingOptionKey);
                
                const isUnvoting = isPollVoted;
                
                if (isUnvoting) {
                  voteRemovalColor = option.color;
                  showVoteRemoval = true;
                  if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
                  voteRemovalTimeout = setTimeout(() => {
                    showVoteRemoval = false;
                  }, 800);
                } else {
                  voteConfirmationColor = option.color;
                  showVoteConfirmation = true;
                  if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                  voteConfirmationTimeout = setTimeout(() => {
                    showVoteConfirmation = false;
                  }, 800);
                }
                
                dispatch('optionClick', { 
                  event: e, 
                  optionKey: pendingOptionKey, 
                  pollId: poll.id, 
                  optionColor: option.color 
                });
              } else if (clickCount === 1) {
                // Single touch → abrir maximized con esta opción
                dispatch('openMaximized', { 
                  pollId: poll.id.toString(), 
                  optionIndex: index 
                });
              }
              
              clickCount = 0;
              pendingOptionKey = null;
            }, DOUBLE_CLICK_DELAY);
          }}
          onclick={(e: MouseEvent) => {
            if (isNewOption) return;
            
            e.preventDefault();
            e.stopPropagation();

            // Si el navegador ya detecta doble click (detail >= 2), procesar directamente como voto
            if (e.detail >= 2) {
              console.log('[SinglePoll] 🖱️ detail>=2 → tratar como doble click inmediato');

              showDoubleClickTooltip = false;
              if (tooltipTimeout) clearTimeout(tooltipTimeout);

              const isUnvoting = isPollVoted;

              if (isUnvoting) {
                voteRemovalColor = option.color;
                showVoteRemoval = true;
                if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
                voteRemovalTimeout = setTimeout(() => {
                  showVoteRemoval = false;
                }, 800);
              } else {
                voteConfirmationColor = option.color;
                showVoteConfirmation = true;
                if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                voteConfirmationTimeout = setTimeout(() => {
                  showVoteConfirmation = false;
                }, 800);
              }

              dispatch('optionClick', {
                event: e,
                optionKey: option.key,
                pollId: poll.id,
                optionColor: option.color
              });

              // Resetear estado de doble click manual
              clickCount = 0;
              pendingOptionKey = null;
              if (clickTimeout) {
                clearTimeout(clickTimeout);
              }
              return;
            }

            // Doble click para votar
            clickCount += 1;
            pendingOptionKey = option.key;

            if (clickTimeout) clearTimeout(clickTimeout);

            clickTimeout = setTimeout(() => {
              if (clickCount >= 2) {
                // Doble click → votar / desvotar
                console.log('[SinglePoll] ✅ DOBLE CLICK confirmado - Votando:', pendingOptionKey);

                const isUnvoting = isPollVoted;

                if (isUnvoting) {
                  voteRemovalColor = option.color;
                  showVoteRemoval = true;
                  if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
                  voteRemovalTimeout = setTimeout(() => {
                    showVoteRemoval = false;
                  }, 800);
                } else {
                  voteConfirmationColor = option.color;
                  showVoteConfirmation = true;
                  if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                  voteConfirmationTimeout = setTimeout(() => {
                    showVoteConfirmation = false;
                  }, 800);
                }

                dispatch('optionClick', { 
                  event: e, 
                  optionKey: pendingOptionKey, 
                  pollId: poll.id, 
                  optionColor: option.color 
                });
              } else if (clickCount === 1) {
                // Single click → abrir maximized con esta opción
                console.log('[SinglePoll] 👆 SINGLE CLICK - Abriendo maximized:', pendingOptionKey);
                dispatch('openMaximized', { 
                  pollId: poll.id, 
                  optionIndex: index 
                });
              }

              // Reset
              clickCount = 0;
              pendingOptionKey = null;
            }, DOUBLE_CLICK_DELAY);
          }}
        >
          {#if isNewOption}
            <!-- Layout para opciones nuevas: Avatar + Botón X arriba, textarea medio, porcentaje abajo -->
            <!-- Avatar del usuario logueado arriba a la izquierda -->
            <img 
              class="creator-avatar-editing" 
              src={$currentUser?.avatarUrl || DEFAULT_AVATAR} 
              alt={$currentUser?.displayName || 'Usuario'} 
              loading="lazy" 
            />
            
            <!-- Botón X para cerrar/eliminar arriba -->
            <button
              class="remove-option-badge-top"
              onclick={(e) => {
                e.stopPropagation();
                // Emitir evento para que el padre elimine la opción
                dispatch('cancelEditing', { pollId: poll.id, optionKey: option.key });
              }}
              ontouchend={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Emitir evento para que el padre elimine la opción
                dispatch('cancelEditing', { pollId: poll.id, optionKey: option.key });
              }}
              title="Cerrar"
              type="button"
              aria-label="Cerrar opción"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            
            <!-- Textarea en el centro -->
            <div class="new-option-content">
              <textarea
                class="question-title editable new-option"
                placeholder="Escribe tu opción..."
                value={editingOptionLabels[option.key] || option.label || ''}
                oninput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  option.label = target.value;
                  editingOptionLabels = { ...editingOptionLabels, [option.key]: target.value };
                }}
                onclick={(e) => e.stopPropagation()}
                ontouchstart={(e) => e.stopPropagation()}
                ontouchmove={(e) => e.stopPropagation()}
                ontouchend={(e) => e.stopPropagation()}
                onmousedown={(e) => e.stopPropagation()}
                onpointerdown={(e) => e.stopPropagation()}
                maxlength="200"
                autofocus
              ></textarea>
            </div>
            
            <!-- Contenedor con gradiente de color -->
            <div class="card-content">
              <div class="percentage-display">
                <span class="percentage-large" style="font-size: {fontSizeForPct(displayPct)}px;">
                  {Math.round(displayPct)}
                </span>
              </div>
            </div>
            
            <!-- Botones posicionados absolutamente -->
            <!-- Botón selector de color -->
            <button
              class="color-picker-badge-absolute"
              style="background-color: {option.color}"
              onclick={(e) => {
                e.stopPropagation();
                dispatch('openColorPicker', { pollId: poll.id, optionKey: option.key });
              }}
              ontouchend={(e) => {
                e.stopPropagation();
                dispatch('openColorPicker', { pollId: poll.id, optionKey: option.key });
              }}
              title="Cambiar color"
              type="button"
              aria-label="Cambiar color"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
            
            <!-- Botón publicar -->
            <button
              class="publish-option-btn-absolute"
              onclick={(e) => {
                e.stopPropagation();
                const currentLabel = editingOptionLabels[option.key] || option.label || '';
                if (currentLabel && currentLabel.trim()) {
                  const pollIdStr = poll.id.toString();
                  console.log('[SinglePollSection] Dispatching publishOption:', { 
                    pollId: pollIdStr, 
                    optionKey: option.key, 
                    label: currentLabel.trim(), 
                    color: option.color 
                  });
                  dispatch('publishOption', { pollId: pollIdStr, optionKey: option.key, label: currentLabel.trim(), color: option.color });
                }
              }}
              ontouchend={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const currentLabel = editingOptionLabels[option.key] || option.label || '';
                if (currentLabel && currentLabel.trim()) {
                  const pollIdStr = poll.id.toString();
                  console.log('[SinglePollSection] Touch - Dispatching publishOption:', { 
                    pollId: pollIdStr, 
                    optionKey: option.key, 
                    label: currentLabel.trim(), 
                    color: option.color 
                  });
                  dispatch('publishOption', { pollId: pollIdStr, optionKey: option.key, label: currentLabel.trim(), color: option.color });
                }
              }}
              title="Publicar opción"
              type="button"
              disabled={!editingOptionLabels[option.key] || !editingOptionLabels[option.key].trim()}
              aria-label="Publicar opción"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </button>
          {:else}
            <!-- Layout estilo PollMaximizedView (reducido) -->
            {@const textLength = option.label.length}
            {@const fontSize = textLength > 60 ? 'text-base' : textLength > 40 ? 'text-lg' : 'text-xl'}
            
            <!-- Fondo de color + overlay de gradiente -->
            <div class="option-background-maximized" style="--option-color: {option.color};">
              <!-- Noise texture overlay -->
              <div class="noise-overlay"></div>
              
              <!-- MediaEmbed de fondo (si hay imageUrl) -->
              {#if option.imageUrl}
                <div class="media-embed-background">
                  <MediaEmbed 
                    url={option.imageUrl} 
                    mode="full"
                    width="100%"
                    height="100%"
                  />
                </div>
                <div class="media-gradient-overlay"></div>
              {/if}
            </div>
            
            <!-- Contenido centrado (label + percentage) -->
            <div class="option-content-maximized">
              <!-- Label grande en uppercase con tamaño dinámico y truncamiento -->
              <h2 class="option-label-maximized {fontSize}" style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; word-break: break-word;">
                {option.label}
              </h2>
              
              <!-- Porcentaje grande si ha votado -->
              {#if pollVotedOption}
                <div class="option-percentage-voted">
                  <span class="percentage-value-large" style="color: {option.color}">
                    {Math.round(displayPct)}%
                  </span>
                  <span class="percentage-subtitle">del total</span>
                </div>
              {/if}
              
            </div>
            
            <!-- Avatares de amigos (si hay) -->
            {#if poll.friendsByOption?.[option.key] && poll.friendsByOption[option.key].length > 0}
              {@const filteredFriends = poll.friendsByOption[option.key].filter((friend: any) => friend.id !== poll.user?.id)}
              {@const userHasVoted = !!(displayVotes[poll.id] || userVotes[poll.id])}
              {#if filteredFriends.length > 0}
                <div class="friend-avatars-maximized">
                  {#each filteredFriends.slice(0, 3) as friend, i}
                    <div 
                      class="friend-avatar-wrapper" 
                      style="z-index: {10 - i};"
                      title={userHasVoted ? friend.name : 'Vota para ver quién eligió esta opción'}
                    >
                      {#if userHasVoted}
                        <img 
                          class="friend-avatar-mini" 
                          src={friend.avatarUrl || DEFAULT_AVATAR}
                          alt={friend.name}
                          loading="lazy"
                        />
                      {:else}
                        <div class="friend-avatar-mystery">
                          <span>?</span>
                        </div>
                      {/if}
                    </div>
                  {/each}
                  {#if filteredFriends.length > 3}
                    <div class="more-friends-count">+{filteredFriends.length - 3}</div>
                  {/if}
                </div>
              {/if}
            {/if}
          {/if}
        </div>
      {/each}
    </div>
    {/if}
  </div>
  
  <!-- Tooltip de doble click -->
  {#if showDoubleClickTooltip && poll.type !== 'multiple' && poll.type !== 'collaborative'}
    <div class="double-click-tooltip">
      Doble click para votar
    </div>
  {/if}
  
  <!-- Tooltip de confirmación de voto -->
  {#if showVoteConfirmation}
    <div class="vote-confirmation-tooltip" style="--vote-color: {voteConfirmationColor}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  {/if}
  
  <!-- Tooltip de eliminación de voto -->
  {#if showVoteRemoval}
    <div class="vote-removal-tooltip" style="--vote-color: {voteRemovalColor}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  {/if}
  
  <!-- Controles inferiores simplificados (solo acciones) -->
  <div class="bottom-controls-container">
    <!-- Lado derecho: Botones de acción -->
    <div class="bottom-controls-right">
      <!-- Botón confirmar votos múltiples -->
      {#if poll.type === 'multiple'}
        {@const selectedCount = multipleVotes[poll.id]?.length || 0}
        {@const hasVoted = !!userVotes[poll.id]}
        {@const hasNewSelections = selectedCount > 0}
        {@const shouldActivate = hasNewSelections && (!hasVoted || selectedCount > 0)}
        <button
          class="confirm-multiple-btn-compact {shouldActivate ? 'has-selection' : ''} {hasVoted && !hasNewSelections ? 'voted-state' : ''} {isExpired ? 'disabled' : ''}"
          onclick={handleConfirmMultiple}
          disabled={selectedCount === 0 || isExpired}
          type="button"
          title="{selectedCount === 0 ? 'Selecciona opciones' : `Confirmar ${selectedCount} ${selectedCount === 1 ? 'voto' : 'votos'}`}"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {#if selectedCount > 0}
            <span class="count-badge">{selectedCount}</span>
          {/if}
        </button>
      {/if}
      
      <!-- Botón añadir opción (colaborativas) -->
      {#if poll.type === 'collaborative' && poll.options.length < 10 && !poll.options.some((opt: any) => opt.isEditing)}
        <button
          type="button"
          class="add-option-button-bottom"
          style="--preview-color: {previewColor}"
          onclick={handleAddOption}
          title="Añadir nueva opción"
          aria-label="Añadir nueva opción"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Botones de acción -->
  <div class="vote-summary-info">
    <div class="vote-actions">
      <!-- Lado izquierdo: Votos, Vistas y Globo -->
      <div class="action-group-left">
        <button 
          bind:this={voteIconElement}
          class="action-badge action-vote {pollVotedOption ? 'has-voted' : 'no-vote'}" 
          type="button" 
          title={pollVotedOption ? `Tu voto: ${votedOptionData?.label || pollVotedOption} (Click para quitar)` : activeAccordionIndex !== null && paginatedPoll.items[activeAccordionIndex] ? `Votar: ${paginatedPoll.items[activeAccordionIndex].label}` : "Selecciona una opción"}
          style="{pollVotedOption && votedOptionData ? `--vote-color: ${votedOptionData.color};` : ''}"
          ontouchend={(e) => {
            e.stopPropagation();
            const activeOption = activeAccordionIndex !== null ? paginatedPoll.items[activeAccordionIndex] : null;
            console.log('[SinglePoll] 🗑️ Touch en botón de voto');
            console.log('[SinglePoll] pollVotedOption:', pollVotedOption);
            console.log('[SinglePoll] activeOption:', activeOption);
            
            if (pollVotedOption) {
              // Quitar voto
              console.log('[SinglePoll] Despachando clearVote para:', poll.id);
              voteRemovalColor = votedOptionData?.color || '#ef4444';
              showVoteRemoval = true;
              if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
              voteRemovalTimeout = setTimeout(() => {
                showVoteRemoval = false;
              }, 800);
              dispatch('clearVote', { pollId: poll.id });
            } else if (activeOption) {
              // Votar opción activa
              console.log('[SinglePoll] Votando opción activa:', activeOption.key);
              voteConfirmationColor = activeOption.color;
              showVoteConfirmation = true;
              if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
              voteConfirmationTimeout = setTimeout(() => {
                showVoteConfirmation = false;
              }, 800);
              dispatch('optionClick', { event: e, optionKey: activeOption.key, pollId: poll.id, optionColor: activeOption.color });
            }
          }}
          onclick={(e) => {
            e.stopPropagation();
            const activeOption = activeAccordionIndex !== null ? paginatedPoll.items[activeAccordionIndex] : null;
            console.log('[SinglePoll] 👁️ Click en botón de voto');
            console.log('[SinglePoll] pollVotedOption:', pollVotedOption);
            console.log('[SinglePoll] activeOption:', activeOption);
            
            if (pollVotedOption) {
              // Quitar voto
              console.log('[SinglePoll] Despachando clearVote para:', poll.id);
              voteRemovalColor = votedOptionData?.color || '#ef4444';
              showVoteRemoval = true;
              if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
              voteRemovalTimeout = setTimeout(() => {
                showVoteRemoval = false;
              }, 800);
              dispatch('clearVote', { pollId: poll.id });
            } else if (activeOption) {
              // Votar opción activa
              console.log('[SinglePoll] Votando opción activa:', activeOption.key);
              voteConfirmationColor = activeOption.color;
              showVoteConfirmation = true;
              if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
              voteConfirmationTimeout = setTimeout(() => {
                showVoteConfirmation = false;
              }, 800);
              dispatch('optionClick', { event: e, optionKey: activeOption.key, pollId: poll.id, optionColor: activeOption.color });
            }
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={pollVotedOption ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>{formatNumber(poll.stats?.totalVotes || poll.totalVotes || 0)}</span>
        </button>
        <button class="action-badge" type="button" title="Vistas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>{formatNumber(poll.stats?.totalViews || poll.totalViews || 0)}</span>
        </button>
        <button 
          class="action-badge action-globe" 
          type="button" 
          title="Ver en el globo"
          aria-label="Ver en el globo"
          onclick={handleOpenInGlobe}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </button>
        <button 
          class="action-badge action-chart" 
          type="button" 
          title="Ver estadísticas"
          aria-label="Ver estadísticas"
          onclick={(e) => {
            e.stopPropagation();
            dispatch('goToChart', { pollId: poll.id.toString() });
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </button>
      </div>
      
      <!-- Lado derecho: Guardar, Republicar, Compartir -->
      <div class="action-group-right">
        
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
        <button class="action-badge action-share" type="button" title="Compartir" onclick={(e) => sharePoll(e)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>{formatNumber(0)}</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Toast de confirmación de compartir -->
{#if showShareToastFlag}
  <div class="share-toast" transition:fly={{ y: -20, duration: 300 }}>
    ✓ Enlace copiado
  </div>
{/if}

<!-- Tooltip del título truncado (fuera de todo para máxima visibilidad) -->
{#if showTitleTooltip}
  <div class="title-tooltip-overlay" onclick={hideTitleTooltip}>
    <div class="title-tooltip-content" onclick={(e) => e.stopPropagation()}>
      {titleTooltipText}
    </div>
  </div>
{/if}

<style>
  /* Botón confirmar votos múltiples - Versión compacta */
  .confirm-multiple-btn-compact {
    width: 36px;
    height: 36px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: visible;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .confirm-multiple-btn-compact.has-selection {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 
                0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .confirm-multiple-btn-compact.has-selection:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
  }

  .confirm-multiple-btn-compact.has-selection:active {
    transform: scale(0.92);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }

  .confirm-multiple-btn-compact.disabled,
  .confirm-multiple-btn-compact:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .confirm-multiple-btn-compact svg {
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }
  
  .count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  /* Badge apagado cuando ya has votado */
  .count-badge-voted {
    position: absolute;
    top: -4px;
    right: -4px;
    background: rgba(107, 114, 128, 0.4);
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  /* Estado apagado cuando ya has votado */
  .confirm-multiple-btn-compact.voted-state {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.4);
    cursor: default;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .confirm-multiple-btn-compact.voted-state:hover {
    background: rgba(255, 255, 255, 0.03);
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* Paginación - Exacto como CreatePollModal */
  .pagination-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 2px 0 0px;
    margin: 0;
  }
  
  .pagination-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }
  
  .pagination-dot:hover {
    background: rgba(255, 255, 255, 0.5);
    transform: scale(1.2);
  }
  
  .pagination-dot.active {
    background: #3b82f6;
    width: 24px;
    border-radius: 4px;
  }

  /* Contenedor de controles inferiores */
  .bottom-controls-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    margin: 0 16px;
    gap: 8px;
  }
  
  .bottom-controls-left,
  .bottom-controls-right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 36px;
  }
  
  /* Botón de estadísticas */
  .stats-icon-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: color 0.2s ease, transform 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: none;
  }
  
  .stats-icon-btn:hover {
    color: rgba(255, 255, 255, 0.95);
    transform: scale(1.05);
  }
  
  .stats-icon-btn:active {
    transform: scale(0.95);
  }
  
  .stats-icon-btn svg {
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }
  
  .stats-icon-btn.active {
    color: #3b82f6;
  }
  
  .stats-icon-btn.active svg {
    filter: drop-shadow(0 1px 4px rgba(59, 130, 246, 0.4));
  }
  
  .bottom-controls-center {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  /* Botón añadir opción pequeño debajo - estilo card con borde color */
  .add-option-button-bottom {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: #2a2c31;
    border: none;
    border-bottom: 2.5px solid var(--preview-color, #8b5cf6);
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Vote cards con background sólido */
  :global(.vote-card) {
    background: #2a2c31 !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
  }

  :global(.vote-card.collapsed) {
    background: #2a2c31 !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
  }

  /* Contenedor de tarjetas con botón añadir */
  .vote-cards-container {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin: 0 -1rem;
    padding: 0 1rem;
  }

  /* Altura de la card de estadísticas (vista de gráfico) igual a opciones */

  /* Botón añadir opción inline a la derecha - Efecto Glass */
  .add-option-button-inline {
    
    
    flex-shrink:0;
    min-width: 60px;
    width: 50px;
    height: 224px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: none;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0 16px 16px 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.25rem;
    font-weight: 300;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex
;
    align-items: center;
    padding-right: 7px;
    justify-content: right;
    margin-left: -43px;
    margin-right: 16px;
    z-index: 0;
  }

  .add-option-button-inline:hover {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-left-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
   
    transform: translateX(2px);
  }

  /* Layout para opciones nuevas colaborativas */
  .remove-option-badge-top {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 8px;
    background: #000000;
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .remove-option-badge-top:hover {
    background: #1a1a1a;
    transform: scale(1.1);
  }

  .card-header {
    background: transparent;
    position: relative;
    z-index: 4;
    pointer-events: none;
  }

  .question-title {
    background: transparent;
    position: relative;
    z-index: 4;
    pointer-events: none;
  }

  .percentage-large {
    background: transparent;
    pointer-events: none;
  }

  .creator-avatar-editing {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 3;
  }

  .new-option-content {
    padding: 48px 16px 16px 16px;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    pointer-events: none;
    position: relative;
    z-index: 1;
  }

  .question-title.editable.new-option {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    width: 100%;
    resize: none;
    overflow: hidden;
    vertical-align: top;
    word-wrap: break-word;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    min-height: 60px;
    max-height: 120px;
    pointer-events: auto;
    position: relative;
    z-index: 2;
  }

  .question-title.editable.new-option::placeholder {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 500;
  }

  .card-content {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 0;
  }

  /* MediaEmbed de fondo en opciones - igual que CreatePollModal */
  .option-media-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 55%;
    max-height: 220px;
    max-width: 100%;
    border-radius: 16px;
    overflow: hidden;
    z-index: 0;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  
  /* Permitir clicks cuando está activa PERO NO en el contenido del MediaEmbed */
  .option-media-background.interactive {
    pointer-events: none;
    z-index: 3;
    cursor: pointer;
  }
  
  /* Modo maximizado - preview ocupa toda la card y permite interacción */
  .option-media-background.is-maximized {
    height: 100%;
    max-height: 100%;
    z-index: 10;
    cursor: zoom-out;
    border-radius: 16px;
    pointer-events: auto;
  }
  
  .option-media-background.is-maximized :global(*) {
    pointer-events: auto;
  }
  
  .option-media-background.is-maximized :global(img),
  .option-media-background.is-maximized :global(video),
  .option-media-background.is-maximized :global(iframe) {
    pointer-events: auto;
  }
  
  /* Overlay minimizado (oscuro) cuando está maximizado */
  .media-overlay.minimized {
    opacity: 0.3;
  }
  
  .option-media-background :global(img),
  .option-media-background :global(video),
  .option-media-background :global(iframe) {
    width: 100%;
    height: 100%;
    max-width: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  
  .option-media-background :global(.media-embed-container) {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    pointer-events: none;
  }
  
  .option-media-background :global(*) {
    pointer-events: none;
  }
  
  /* Cuando está activa, ocupar toda la altura */
  :global(.vote-card.is-active) .option-media-background {
    height: 100%;
    max-height: 260px;
  }
  
  :global(.vote-card.is-active) .option-media-background :global(img),
  :global(.vote-card.is-active) .option-media-background :global(video),
  :global(.vote-card.is-active) .option-media-background :global(iframe) {
    object-fit: contain;
  }
  
  /* Overlay oscuro sobre el media */
  .media-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.7) 0%,
      rgba(0, 0, 0, 0.5) 30%,
      rgba(0, 0, 0, 0.3) 50%,
      rgba(0, 0, 0, 0.5) 70%,
      rgba(0, 0, 0, 0.8) 100%
    );
    pointer-events: none;
    z-index: 1;
    transition: opacity 0.3s ease;
  }
  
  .media-overlay.hidden {
    opacity: 0;
  }
  
  /* Ocultar elementos completamente */
  .hidden {
    display: none !important;
  }
  
  /* Header y content con z-index superior cuando hay preview */
  .card-header.with-preview,
  .card-header.with-preview ~ .card-content {
    position: relative;
    z-index: 2;
  }

  .card-content::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--fill-window, 120px) * (var(--fill-pct-val, 0) / 100));
    max-height: var(--fill-window, 120px);
    background: var(--card-color, rgba(0, 0, 0, 0.4));
    pointer-events: none;
    z-index: 1;
    opacity: 0.8;
    transition: height 0.3s ease, opacity 0.2s ease;
  }

  .card-content-bottom {
    padding: 0 16px 16px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 4;
  }

  .bottom-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }
  
  .percentage-display {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    position: relative;
    z-index: 4;
    pointer-events: none;
  }
  
  /* Cuando está desplegada, mover a la izquierda */
  .vote-card.is-active .percentage-display {
    justify-content: flex-start;
    padding-left: 20px;
  }
  
  /* Tooltip de doble click */
  .double-click-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    pointer-events: none;
    z-index: 1000;
    animation: tooltipFadeIn 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  /* Tooltip de confirmación de voto */
  .vote-confirmation-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--vote-color, #10b981);
    color: white;
    padding: 12px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 1000;
    animation: voteConfirmFlyUp 0.8s ease-out forwards;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }
  
  .vote-confirmation-tooltip svg {
    flex-shrink: 0;
  }
  
  @keyframes voteConfirmFlyUp {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -150%) scale(0.8);
    }
  }
  
  /* Tooltip de eliminación de voto */
  .vote-removal-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--vote-color, #ef4444);
    color: white;
    padding: 12px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 1000;
    animation: voteRemovalFlyUp 0.8s ease-out forwards;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }
  
  .vote-removal-tooltip svg {
    flex-shrink: 0;
  }
  
  @keyframes voteRemovalFlyUp {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8) rotate(0deg);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1) rotate(90deg);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -150%) scale(0.8) rotate(180deg);
    }
  }
  
  /* Tooltip de long press con texto completo */
  .long-press-tooltip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.92);
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    pointer-events: none;
    z-index: 10000;
    max-width: min(400px, 90vw);
    font-size: 14px;
    line-height: 1.4;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: fadeInUp 0.2s ease-out;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    word-wrap: break-word;
    white-space: normal;
  }
  
  /* Flecha del tooltip apuntando hacia abajo */
  .long-press-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.92);
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .long-press-tooltip {
      padding: 10px 16px;
      font-size: 13px;
      max-width: 85vw;
      bottom: calc(100% + 8px);
    }
  }
  
  /* Botón de tres puntos para tooltip del título */
  .title-tooltip-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 18px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }
  
  .title-tooltip-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
    transform: translateY(-50%) scale(1.1);
  }
  
  /* Botón de tres puntos para opciones */
  .option-tooltip-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    margin-left: 4px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 16px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 1000;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    position: absolute;
    bottom: 4px;
    right: 8px;
    pointer-events: auto;
  }
  
  .option-tooltip-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    color: white;
    transform: scale(1.15);
  }
  
  /* Overlay del tooltip del título */
  .title-tooltip-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  
  .title-tooltip-content {
    background: rgba(20, 20, 20, 0.95);
    color: white;
    padding: 24px 32px;
    border-radius: 16px;
    max-width: min(600px, 90vw);
    max-height: 70vh;
    overflow-y: auto;
    font-size: 16px;
    line-height: 1.6;
    text-align: center;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8);
    animation: scaleIn 0.3s ease-out;
    word-wrap: break-word;
    white-space: pre-wrap;
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
  
  @media (max-width: 768px) {
    .title-tooltip-btn {
      padding: 3px 8px;
      font-size: 16px;
    }
    
    .title-tooltip-content {
      padding: 20px 24px;
      font-size: 15px;
      max-width: 92vw;
    }
  }

  .color-picker-badge-bottom {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    position: relative;
    overflow: visible;
  }

  .color-picker-badge-bottom:hover {
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  }

  /* Note: .publish-option-btn is unused - component uses .publish-option-btn-absolute instead */
  .publish-option-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    color: white;
  }

  .publish-option-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.5);
  }

  .publish-option-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .publish-option-btn:disabled {
    background: rgba(107, 114, 128, 0.3);
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  /* Botones posicionados absolutamente para opciones en edición */
  .color-picker-badge-absolute {
    position: absolute;
    bottom: 16px;
    right: 60px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
    padding: 0;
  }

  .color-picker-badge-absolute:hover {
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  }

  .color-picker-badge-absolute svg {
    width: 1rem;
    height: 1rem;
    color: rgba(255, 255, 255, 0.9);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }

  .publish-option-btn-absolute {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    color: white;
    z-index: 3;
    padding: 0;
  }

  .publish-option-btn-absolute:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.5);
  }

  .publish-option-btn-absolute:disabled {
    background: rgba(107, 114, 128, 0.3);
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  .publish-option-btn-absolute svg {
    width: 1.125rem;
    height: 1.125rem;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }
  
  /* Contenedor de información de votos */
  .vote-summary-info {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  
  /* Grupos de acciones */
  .vote-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    margin: 0 16px 0;
    gap: 8px;
    width: calc(100% - 32px);
  }
  
  .action-group-left,
  .action-group-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  /* Botones de acción - estilo sutil sin bordes */
  .action-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-badge:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
  }
  
  .action-badge:active {
    transform: translateY(0);
  }
  
  .action-badge svg {
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  
  .action-badge:hover svg {
    opacity: 1;
  }
  
  .action-badge span {
    font-weight: 500;
    font-size: 12px;
  }
  
  .action-globe {
    color: rgba(59, 130, 246, 0.8);
  }
  
  .action-globe:hover {
    color: rgb(59, 130, 246);
  }
  
  .action-share:hover {
    color: rgba(16, 185, 129, 0.9);
  }
  
  .action-chart {
    color: rgba(139, 92, 246, 0.7);
  }
  
  .action-chart:hover {
    color: rgba(139, 92, 246, 0.9);
  }
  
  .action-chart.active-chart {
    background: rgba(139, 92, 246, 0.15);
    color: rgb(139, 92, 246);
  }
  
  .action-chart.active-chart svg {
    opacity: 1;
  }
  
  /* Reducir espaciado del header y meta */
  .poll-header {
    margin-bottom: 0;
    padding-bottom: 4px;
  }
  
  .poll-meta {
    margin-top: 4px;
    margin-bottom: 0;
  }
  
  .header-with-avatar {
    margin-bottom: 0;
  }
  
  .poll-item {
    margin-bottom: 0;
    padding-bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(26, 26, 31, 0.95) 0%,
      rgba(30, 30, 35, 0.98) 100%
    );
    border-radius: 0;
    overflow: visible;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  
  /* Reducir padding de botones individuales */
  .action-badge {
    padding: 2px 4px !important;
  }
  
  /* Estilo para avatar clickeable */
  .header-avatar-real {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .header-avatar-real:hover {
    transform: scale(1.1);
  }
  
  /* Botón de votos con estados */
  .action-vote.has-voted {
    color: var(--vote-color, #10b981);
  }
  
  .action-vote.has-voted svg {
    opacity: 1;
  }
  
  .action-vote.no-vote {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .action-vote.no-vote span {
    color: rgba(255, 255, 255, 0.9);
  }
  
  .action-vote:hover {
    color: rgba(16, 185, 129, 0.9);
  }
  
  /* Gráfico histórico - Estructura simplificada */
  .historical-chart-wrapper {
    width: 100%;
    height: auto; /* altura automática según contenido */
    background: transparent;
    border-radius: 0;
    padding: 0 16px; /* padding horizontal a los lados */
    display: flex;
    flex-direction: column;
    border: none;
    box-shadow: none;
    box-sizing: border-box;
  }
  
  .chart-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .chart-title {
    font-size: 20px;
    font-weight: 700;
    color: white;
    margin: 0;
  }
  
  .time-pills-container {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  
  .time-button {
    padding: 4px 10px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    letter-spacing: 0.3px;
  }
  
  .time-button:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.4);
    color: white;
    transform: translateY(-1px);
  }
  
  .time-button.selected {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }
  
  .chart-area {
    width: 100%;
    height: 160px; /* altura más reducida */
    position: relative;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 12px;
    padding: 36px 8px 8px 0; /* sin padding izquierdo */
    box-sizing: border-box;
    touch-action: pan-y; /* permitir scroll vertical */
  }
  
  .full-chart-svg {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: block;
    touch-action: pan-y; /* permitir scroll vertical, bloquear horizontal */
  }
  
  .chart-tooltip {
    position: absolute;
    top: 20px;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    padding: 10px 14px;
    border-radius: 10px;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 120px;
    text-align: center;
  }
  
  .chart-tooltip-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    padding: 8px 14px;
    border-radius: 8px;
    pointer-events: none;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    min-width: 110px;
    text-align: center;
    z-index: 50;
  }
  
  .chart-tooltip-overlay .tooltip-value {
    font-size: 17px;
    font-weight: 600;
    color: #3b82f6;
    margin-bottom: 2px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  .chart-tooltip-overlay .tooltip-date {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }
  
  .tooltip-value {
    font-size: 18px;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 4px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  .tooltip-date {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }
  
  .chart-loading,
  .chart-empty {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    height: 100% !important;
    color: white !important;
    font-size: 16px !important;
    font-weight: 600 !important;
    background: rgba(255, 255, 255, 0.03) !important;
  }
  
  .chart-loading span::after {
    content: '...';
    animation: dots 1.5s steps(4, end) infinite;
  }
  
  @keyframes dots {
    0%, 20% { content: '.'; }
    40% { content: '..'; }
    60%, 100% { content: '...'; }
  }
  /* Modal fullscreen para preview (estilo Instagram) */
  .preview-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }
  
  .preview-modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  .preview-modal-close {
    position: absolute;
    top: 20px;
    top: calc(20px + env(safe-area-inset-top));
    right: 20px;
    right: calc(20px + env(safe-area-inset-right));
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100001;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }
  
  .preview-modal-close:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }
  
  .preview-modal-close svg {
    color: white;
  }
  
  .preview-modal-media {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  
  .preview-modal-media :global(.media-embed-container) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }
  
  .preview-modal-media :global(img),
  .preview-modal-media :global(video) {
    max-width: 100vw;
    max-height: 100vh;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  
  .preview-modal-media :global(iframe) {
    width: 100vw;
    height: 56.25vw; /* 16:9 aspect ratio */
    max-height: 100vh;
  }
  
  .preview-modal-info {
    position: absolute;
    bottom: 40px;
    bottom: calc(40px + env(safe-area-inset-bottom));
    left: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 20px;
    z-index: 100000;
  }
  
  .preview-modal-title {
    color: white;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 8px 0;
  }
  
  .preview-modal-votes {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    margin: 0;
  }
  
  .title-tooltip-btn {
    margin: 0;
  }

  /* Toast de confirmación */
  .share-toast {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4),
                0 2px 8px rgba(16, 185, 129, 0.3);
    z-index: 999999;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  @media (max-width: 640px) {
    .share-toast {
      top: 60px;
      padding: 10px 20px;
      font-size: 13px;
    }
  }

  /* ========================================
     NUEVOS ESTILOS TIPO POLLMAXIMIZEDVIEW
     ======================================== */

  /* Header compacto */
  .poll-header-compact {
    padding: 12px 16px 8px 16px;
    margin-bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.4) 0%,
      rgba(0, 0, 0, 0.2) 50%,
      transparent 100%
    );
    backdrop-filter: blur(8px);
  }

  .header-compact-inner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .header-avatar-mini {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .avatar-button-mini,
  .avatar-mini-default {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .avatar-button-mini {
    padding: 0;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .avatar-button-mini:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  }

  .avatar-button-mini img,
  .avatar-mini-default img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .header-content-compact {
    flex: 1;
    min-width: 0;
  }

  /* Reducir tamaño del título en header compact */
  .header-content-compact .poll-question {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 6px;
    color: white;
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.6),
      0 1px 3px rgba(0, 0, 0, 0.4);
    letter-spacing: -0.01em;
  }

  .header-content-compact .poll-meta {
    font-size: 11px;
    opacity: 0.85;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    font-weight: 600;
  }

  /* Indicadores de opciones (barras tipo Instagram Stories) */
  .options-indicators {
    display: flex;
    gap: 2px;
    width: 100%;
    padding: 10px 12px 8px 12px;
    margin: 0 -12px;
  }

  .option-indicator {
    height: 6px;
    border: none;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(4px);
    cursor: pointer;
    transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    position: relative;
    overflow: hidden;
  }
  
  .indicator-fill {
    height: 100%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 2px;
  }

  .option-indicator:hover {
    opacity: 0.85;
  }

  /* Fondo de opción estilo maximizado */
  .option-background-maximized {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
    overflow: hidden;
    z-index: 0;
    background-color: transparent;
  }
  
  .option-background-maximized::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: var(--option-color);
    opacity: 0.7;
    z-index: 0;
  }

  .noise-overlay {
    position: absolute;
    inset: 0;
    background-image: url('https://grainy-gradients.vercel.app/noise.svg');
    opacity: 0.4;
    mix-blend-mode: overlay;
    pointer-events: none;
  }

  .media-embed-background {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .media-gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.3) 0%,
      transparent 40%,
      transparent 60%,
      rgba(0, 0, 0, 0.4) 100%
    );
    z-index: 2;
    pointer-events: none;
  }

  /* Contenido centrado */
  .option-content-maximized {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    height: 100%;
    text-align: center;
  }

  /* Label grande en uppercase */
  .option-label-maximized {
    /* font-size controlado por clases Tailwind dinámicas */
    font-weight: 900;
    color: white;
    text-transform: uppercase;
    letter-spacing: -0.03em;
    line-height: 0.95;
    text-shadow: 
      0 3px 12px rgba(0, 0, 0, 0.7),
      0 6px 24px rgba(0, 0, 0, 0.5),
      0 1px 3px rgba(0, 0, 0, 0.8);
    word-wrap: break-word;
    max-width: 90%;
    margin: 0;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
  }

  /* Porcentaje cuando ha votado */
  .option-percentage-voted {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
  }

  .percentage-value-large {
    font-size: 42px;
    font-weight: 900;
    line-height: 1;
    text-shadow: 
      0 3px 12px rgba(0, 0, 0, 0.5),
      0 1px 4px rgba(0, 0, 0, 0.3);
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  }

  .percentage-subtitle {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  /* Indicador "Doble toque para votar" */
  .vote-hint-indicator {
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0.9;
    animation: pulse-hint 2.5s ease-in-out infinite;
    margin-top: 12px;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  @keyframes pulse-hint {
    0%, 100% {
      opacity: 0.7;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
    }
  }

  .vote-hint-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .tap-line {
    width: 2.5px;
    height: 16px;
    background: white;
    border-radius: 2px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .vote-hint-text {
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: white;
    text-shadow: 
      0 2px 4px rgba(0, 0, 0, 0.6),
      0 1px 2px rgba(0, 0, 0, 0.4);
    font-weight: 700;
  }

  /* Avatares de amigos en diseño maximizado */
  .friend-avatars-maximized {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 4px;
    z-index: 10;
  }

  .friend-avatar-wrapper {
    position: relative;
    display: inline-block;
  }

  .friend-avatar-mini {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    object-fit: cover;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease;
  }

  .friend-avatar-mini:hover {
    transform: scale(1.15);
  }
  
  .friend-avatar-mystery {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
    transition: transform 0.2s ease, background 0.2s ease;
  }
  
  .friend-avatar-mystery span {
    color: white;
    font-size: 14px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  .friend-avatar-mystery:hover {
    transform: scale(1.15);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%);
  }

  .more-friends-count {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  /* Contenedor principal de scroll horizontal */
  .poll-options-scroll-container {
    width: 100%;
    margin: 0;
    padding: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.1) 0%,
      transparent 20%,
      transparent 80%,
      rgba(0, 0, 0, 0.1) 100%
    );
  }

  /* Scroll horizontal estilo PollMaximizedView */
  .options-horizontal-scroll {
    display: flex;
    overflow-x: scroll;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox */
    gap: 0;
    height: 250px;
  }

  .options-horizontal-scroll::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  /* Cada slide/opción ocupa el 100% del ancho */
  .option-slide {
    flex-shrink: 0;
    width: 100%;
    height: 100%;
    scroll-snap-align: start;
    position: relative;
    border-radius: 0;
    overflow: hidden;
    margin: 0;
    background: #2a2c31;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .option-slide.is-active {
    transform: scale(1.02);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 4px 16px rgba(0, 0, 0, 0.3),
      inset 0 0 0 2px rgba(255, 255, 255, 0.1);
  }

  .option-slide:active {
    transform: scale(0.98);
  }

  /* Responsive para móviles */
  @media (max-width: 640px) {
    .poll-header-compact {
      padding: 10px 14px 6px 14px;
    }

    .header-content-compact .poll-question {
      font-size: 15px;
    }

    .header-content-compact .poll-meta {
      font-size: 10px;
    }

    .avatar-button-mini,
    .avatar-mini-default {
      width: 26px;
      height: 26px;
    }


    .percentage-value-large {
      font-size: 36px;
    }

    .percentage-subtitle {
      font-size: 11px;
    }

    .options-horizontal-scroll {
      height: 220px;
    }

    .option-slide {
      width: 100%;
      margin: 0;
      border-radius: 0;
    }

    .options-indicators {
      gap: 2px;
      padding: 8px 10px 6px 10px;
      margin: 0 -10px;
    }

    .option-indicator {
      height: 5px;
    }
  }
  
</style>

<!-- Modal de perfil movida a +page.svelte para que esté al nivel superior -->