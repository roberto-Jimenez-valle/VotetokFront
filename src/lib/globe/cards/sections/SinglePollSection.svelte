<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { currentUser } from '$lib/stores';
  import { markImageFailed, shouldRetryImage } from '$lib/stores/failed-images-store';
  import MediaEmbed from '$lib/components/MediaEmbed.svelte';
  import FriendsVotesModal from '$lib/components/FriendsVotesModal.svelte';
  import PollOptionCard from '$lib/components/PollOptionCard.svelte';
  import StatsBottomModal from '$lib/components/StatsBottomModal.svelte';
  import CommentsModal from '$lib/components/CommentsModal.svelte';
  import Portal from '$lib/components/Portal.svelte';
  import ShareModal from '$lib/components/ShareModal.svelte';
    
  const dispatch = createEventDispatcher();
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  let showDoubleClickTooltip: boolean = false;
  let showVoteConfirmation: boolean = false;
  let showVoteRemoval: boolean = false;
  let showCommentsModal: boolean = false;
  let showShareModal: boolean = false;
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
      // Debug friendsByOption
      console.log('[SinglePollSection] poll.friendsByOption:', poll.friendsByOption);
      console.log('[SinglePollSection] poll.friendsByOption keys:', Object.keys(poll.friendsByOption || {}));
      console.log('[SinglePollSection] option keys:', poll.options?.map((o: any) => ({ key: o.key, id: o.id, optionKey: o.optionKey })));
    }
  });
  
  // Title tooltip (para títulos truncados)
  let showTitleTooltip: boolean = false;
  let titleTooltipText: string = '';
  
  const OPTIONS_PER_PAGE = 4;
  
  // Props
  export let poll: any;
  export const state: string = 'collapsed';
  export let activeAccordionIndex: number | null = null;
  export let currentPage: number = 0;
  export let userVotes: Record<string, string> = {};
  export let multipleVotes: Record<string, string[]> = {};
  export const pollIndex: number = 0;
  
  // Dirección de paginación
  let paginationDirection: 'forward' | 'backward' = 'forward';
  let lastPage: number = currentPage;
  
  // Estado para menú desplegable
  let isMoreMenuOpen: boolean = false;
  
  // Estado para modal de votos de amigos
  let showFriendsVotesModal: boolean = false;
  
  // Estado para modal de estadísticas
  let showStatsModal: boolean = false;
  
  // Estado para shares
  let shareCount: number = 0;
  let isSharing: boolean = false;
  $: shareCount = poll?.shareCount || poll?.stats?.shareCount || 0;
  
  // Formatear números grandes
  function formatCount(num: number | undefined): string {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }
  
  // Copiar enlace al portapapeles
  async function copyPollLink() {
    try {
      const url = `${window.location.origin}/?poll=${poll.id}`;
      await navigator.clipboard.writeText(url);
      isMoreMenuOpen = false;
      showShareToast();
      registerShare();
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = `${window.location.origin}/?poll=${poll.id}`;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showShareToast();
        registerShare();
      } catch (e) {}
      document.body.removeChild(textarea);
    }
  }
  
  // Registrar share en API
  async function registerShare() {
    if (isSharing) return;
    isSharing = true;
    try {
      const pollId = typeof poll.id === 'string' ? parseInt(poll.id) : poll.id;
      const response = await fetch(`/api/polls/${pollId}/share`, { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        if (result.shareCount !== undefined) {
          shareCount = result.shareCount;
        } else {
          shareCount++;
        }
      }
    } catch (error) {
      shareCount++;
    } finally {
      isSharing = false;
    }
  }
  
  // Cerrar menú al hacer clic fuera
  function handleMenuClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.more-menu-container')) {
      isMoreMenuOpen = false;
    }
  }
  
  // Swipe para cerrar bottom sheet
  let sheetTouchStartY = 0;
  let sheetCurrentY = 0;
  let sheetTranslateY = 0;
  let sheetElement: HTMLDivElement | null = null;
  let canSwipeClose = false;
  
  function handleSheetTouchStart(e: TouchEvent) {
    sheetTouchStartY = e.touches[0].clientY;
    sheetCurrentY = sheetTouchStartY;
    // Solo permitir swipe si el scroll está en la parte superior
    canSwipeClose = sheetElement ? sheetElement.scrollTop <= 0 : true;
  }
  
  function handleSheetTouchMove(e: TouchEvent) {
    if (!canSwipeClose) return;
    sheetCurrentY = e.touches[0].clientY;
    const diff = sheetCurrentY - sheetTouchStartY;
    if (diff > 0) {
      sheetTranslateY = diff;
      e.preventDefault(); // Prevenir scroll mientras arrastramos
    }
  }
  
  function handleSheetTouchEnd() {
    if (sheetTranslateY > 80) {
      isMoreMenuOpen = false;
    }
    sheetTranslateY = 0;
    canSwipeClose = false;
  }
  
  // Detectar cambio de página y actualizar dirección ANTES del render
  $: if (currentPage !== lastPage) {
    paginationDirection = currentPage > lastPage ? 'forward' : 'backward';
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
        loadHistoricalData();
  }
  
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
      
            
      // DEBUG: Ver primeros 3 puntos
            
      if (timeSeriesData.length === 0) {
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
      
            
    } catch (error) {
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
  
  // Formatear tiempo relativo (igual que PollMaximizedView)
  function formatRelativeTime(date: string | Date | undefined): string {
    if (!date) return "Reciente";
    
    try {
      const now = new Date();
      const past = new Date(date);
      
      if (isNaN(past.getTime())) return "Reciente";
      
      const diffMs = now.getTime() - past.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffWeek = Math.floor(diffDay / 7);
      const diffMonth = Math.floor(diffDay / 30);

      if (diffSec < 60) return "Ahora";
      if (diffMin < 60) return `Hace ${diffMin}m`;
      if (diffHour < 24) return `Hace ${diffHour}h`;
      if (diffDay < 7) return `Hace ${diffDay}d`;
      if (diffWeek < 4) return `Hace ${diffWeek}sem`;
      return `Hace ${diffMonth}mes`;
    } catch {
      return "Reciente";
    }
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
  // IMPORTANTE: Las claves de userVotes/displayVotes son strings
  $: pollVotedOption = displayVotes[poll.id.toString()] || userVotes[poll.id.toString()];
  // pollVotedOption puede ser string o array - normalizar para comparaciones
  $: hasVotedAnyOption = Array.isArray(pollVotedOption) ? pollVotedOption.length > 0 : !!pollVotedOption;
  
  $: votedOptionData = hasVotedAnyOption 
    ? poll.options.find((o: any) => 
        Array.isArray(pollVotedOption) 
          ? pollVotedOption.map(String).includes(String(o.key))
          : String(o.key) === String(pollVotedOption)
      ) 
    : null;
  // Variables para el botón de votación estilo PollMaximizedView
  $: votedOptionsCount = Array.isArray(pollVotedOption) ? pollVotedOption.length : (pollVotedOption ? 1 : 0);
  $: activeOption = activeAccordionIndex !== null ? paginatedPoll.items[activeAccordionIndex] : null;
  $: currentOptionVoted = activeOption 
    ? (Array.isArray(pollVotedOption) 
        ? pollVotedOption.map(String).includes(String(activeOption.key))
        : String(pollVotedOption) === String(activeOption.key))
    : false;
  $: currentOptionColor = currentOptionVoted && activeOption ? activeOption.color : '#555';
  $: voteColor = votedOptionData?.color || '#10b981';
  
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

  // Función de compartir - abre el modal de compartir
  function sharePoll(event: MouseEvent) {
    event.stopPropagation();
    showShareModal = true;
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
          }, 50);
  }
  
  function handleConfirmMultiple() {
    dispatch('confirmMultiple', { pollId: poll.id });
  }
  
  // Title tooltip handlers
  function showTitleTooltipHandler(text: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
            
    showTitleTooltip = true;
    titleTooltipText = text;
    
            
    // Agregar listener global con delay para evitar que cierre inmediatamente
    setTimeout(() => {
      if (showTitleTooltip && typeof document !== 'undefined') {
        document.addEventListener('click', handleClickOutside, { once: false });
              }
    }, 100);
  }
  
  function hideTitleTooltip() {
        showTitleTooltip = false;
    titleTooltipText = '';
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside);
    }
  }
  
  // Listener global para cerrar tooltip al hacer click fuera
  function handleClickOutside(event: MouseEvent) {
        if (showTitleTooltip) {
      hideTitleTooltip();
    }
  }
  
  function handleAddOption() {
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
  <!-- Header estilo PollMaximizedView -->
  <div class="poll-header-compact">
    <div class="header-compact-inner">
      <!-- Avatar clickeable -->
      <button 
        class="header-avatar-mini" 
        onclick={(e) => {
          e.stopPropagation();
          if (poll.user?.id) {
            selectedProfileUserId = poll.user.id;
            isProfileModalOpen = true;
          }
        }}
        aria-label="Ver perfil de {poll.user?.displayName || poll.user?.username || 'usuario'}"
      >
        {#if poll.user?.avatarUrl && shouldRetryImage(poll.user.avatarUrl)}
          <img 
            src={poll.user.avatarUrl} 
            alt={poll.user.displayName || 'Avatar'} 
            loading="lazy"
            onerror={(e: Event) => { if (e.target) { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; markImageFailed(poll.user?.avatarUrl || ''); }}}
          />
        {:else}
          <img src={DEFAULT_AVATAR} alt="Avatar" loading="lazy" />
        {/if}
      </button>
      
      <!-- Info del usuario y metadatos -->
      <div class="header-user-info">
        <div class="header-username-row">
          <span class="header-username">@{poll.user?.username || poll.user?.displayName || 'usuario'}</span>
          <!-- Botón seguir -->
          <button
            class="header-follow-btn"
            onclick={(e) => { e.stopPropagation(); /* TODO: Follow logic */ }}
            type="button"
            aria-label="Seguir a {poll.user?.username || 'usuario'}"
          >
            <span class="follow-text">Seguir</span>
          </button>
        </div>
        <div class="header-metadata">
          <span>{formatRelativeTime(poll.createdAt || poll.created_at || poll.publishedAt || poll.published_at || poll.timestamp)}</span>
          <span class="header-metadata-dot">·</span>
          <span class="header-poll-type">
            {#if poll.type === 'multiple'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M4 4h16v16H4z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              Voto Múltiple
            {:else if poll.type === 'collaborative'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Colaborativo
            {:else if poll.type === 'hashtag'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="4" y1="9" x2="20" y2="9"/>
                <line x1="4" y1="15" x2="20" y2="15"/>
                <line x1="10" y1="3" x2="8" y2="21"/>
                <line x1="16" y1="3" x2="14" y2="21"/>
              </svg>
              Hashtag
            {:else}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="9"/>
              </svg>
              Voto Único
            {/if}
          </span>
        </div>
      </div>
      
      <!-- Botón menú (3 puntos) -->
      <button 
        class="header-menu-btn" 
        type="button" 
        title="Más opciones"
        aria-label="Más opciones"
        onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = !isMoreMenuOpen; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="19" r="2"/>
        </svg>
      </button>
    </div>
    
    <!-- Pregunta de la encuesta -->
    <div class="header-question-row">
      <h3 
        class="poll-question" 
        class:expanded={pollTitleExpanded[poll.id]}
        class:truncated={pollTitleTruncated[poll.id] && !pollTitleExpanded[poll.id]}
        bind:this={pollTitleElements[poll.id]}
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
        {#if poll.type === 'hashtag'}#{/if}{poll.question || poll.title}
      </h3>
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
  </div>
    
    <!-- Indicadores de opciones (debajo del título) -->
    <div class="options-indicators">
      {#each sortedPollOptions as opt, idx}
        {@const isCurrentOption = idx === activeAccordionIndex}
        {@const userVoteVal = displayVotes[poll.id] || userVotes[poll.id]}
        {@const isPollVoted = poll.type === 'multiple'
          ? (multipleVotes[poll.id]?.includes(opt.key) || 
             (Array.isArray(userVoteVal) ? userVoteVal.map(String).includes(String(opt.key)) : String(userVoteVal)?.split(',').map(s => s.trim()).includes(String(opt.key))))
          : String(userVoteVal) === String(opt.key)}
        {@const hasVotedAny = Array.isArray(userVoteVal) ? userVoteVal.length > 0 : !!userVoteVal}
        {@const totalVotes = sortedPollOptions.reduce((sum: number, o: any) => sum + (o.votes || 0), 0)}
        {@const flexWeight = hasVotedAny 
          ? Math.max(opt.votes || 0, totalVotes * 0.02) 
          : 1}
        <button
          class="option-indicator {isCurrentOption ? 'active' : ''}"
          style="flex: {flexWeight} 1 0%; opacity: {isCurrentOption ? 1 : (hasVotedAny ? 0.3 : 0.5)}; transform: {hasVotedAny && isCurrentOption ? 'scaleY(1.5)' : 'scaleY(1)'};"
          onclick={(e) => {
            e.stopPropagation();
            if (activeAccordionIndex !== idx) {
              dispatch('setActive', { pollId: poll.id, index: idx });
            }
          }}
          aria-label="Ver opción {idx + 1}: {opt.label}"
          type="button"
        >
          <div
            class="indicator-fill"
            style="width: {hasVotedAny ? '100%' : (activeAccordionIndex !== null && idx < activeAccordionIndex ? '100%' : (isCurrentOption ? '100%' : '0%'))}; background-color: {hasVotedAny ? opt.color : (isCurrentOption ? '#fff' : 'rgba(255, 255, 255, 0.2)')};"
          ></div>
        </button>
      {/each}
    </div>
  
  <!-- Contenedor de opciones con scroll horizontal (estilo PollMaximizedView) -->
  <div class="poll-options-scroll-container" style="position: relative;">
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
        {@const userVoteValue = displayVotes[poll.id] || userVotes[poll.id]}
        {@const isPollVoted = poll.type === 'multiple'
          ? (multipleVotes[poll.id]?.includes(option.key) || 
             (Array.isArray(userVoteValue) ? userVoteValue.map(String).includes(String(option.key)) : String(userVoteValue)?.split(',').map(s => s.trim()).includes(String(option.key))))
          : String(userVoteValue) === String(option.key)}
        {@const isNewOption = poll.type === 'collaborative' && option.isEditing === true}
        {@const displayPct = isNewOption ? 25 : option.pct}
        
        <button
          class={`option-slide ${index === activeAccordionIndex ? 'is-active' : ''} ${isPollVoted ? 'voted' : ''}`}
          style="scroll-snap-stop: always; --option-border-color: {(displayVotes[poll.id] || userVotes[poll.id]) ? option.color : '#555'};" 
          type="button"
          aria-pressed={isPollVoted}
          aria-label={`Opción ${index + 1}: ${option.label}`}
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
                console.log('[SinglePoll] 🎯 Single click - abriendo maximized para poll:', poll.id, 'opción:', index);
                dispatch('openMaximized', { 
                  pollId: poll.id.toString(), 
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
                                    dispatch('publishOption', { pollId: pollIdStr, optionKey: option.key, label: currentLabel.trim(), color: option.color });
                }
              }}
              ontouchend={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const currentLabel = editingOptionLabels[option.key] || option.label || '';
                if (currentLabel && currentLabel.trim()) {
                  const pollIdStr = poll.id.toString();
                                    dispatch('publishOption', { pollId: pollIdStr, optionKey: option.key, label: currentLabel.trim(), color: option.color });
                }
              }}
              title="Publicar opción"
              type="button"
              disabled={!editingOptionLabels[option.key] || !editingOptionLabels[option.key].trim()}
              aria-label="Publicar opción"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          {:else}
            <!-- Layout usando PollOptionCard unificado -->
            {@const allFriendsKeys = Object.keys(poll.friendsByOption || {})}
            {@const realFriends = poll.friendsByOption?.[option.key] || poll.friendsByOption?.[option.id] || poll.friendsByOption?.[option.optionKey] || poll.friendsByOption?.[String(option.key)] || poll.friendsByOption?.[String(option.id)] || []}
            <!-- TEST: Añadir amigo de prueba si no hay datos reales para verificar que el UI funciona -->
            {@const testFriend = index === 0 ? [{ id: 'test-1', name: 'Test Friend', avatarUrl: null }] : []}
            {@const friendsForOption = (realFriends.length > 0 ? realFriends : testFriend).filter((friend: any) => friend.id !== poll.user?.id)}
            {@const _debug = console.log('[SinglePoll] Option', index, 'key:', option.key, 'optionKey:', option.optionKey, 'realFriends:', realFriends.length, 'testFriend:', testFriend.length, 'friendsByOption keys:', allFriendsKeys)}
            {@const userHasVoted = hasVotedAnyOption}
            {@const isThisOptionVoted = Array.isArray(pollVotedOption) 
              ? pollVotedOption.map(String).includes(String(option.key))
              : String(pollVotedOption) === String(option.key)}
            
            <PollOptionCard
              label={option.label}
              color={option.color}
              imageUrl={option.imageUrl}
              percentage={displayPct}
              isVoted={isThisOptionVoted}
              mode="view"
              isActive={activeAccordionIndex === index}
              friends={friendsForOption}
              userHasVoted={userHasVoted}
              showPercentageLabel={hasVotedAnyOption}
              onFriendsClick={() => { showFriendsVotesModal = true; }}
              isClickable={false}
              compact={activeAccordionIndex !== index}
            />
          {/if}
        </button>
      {/each}
      </div>
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
  
  <!-- BARRA DE CONTROL PRINCIPAL - Nuevo Diseño -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="mini-action-bar more-menu-container" onclick={handleMenuClickOutside}>
    
    <!-- Modal Bottom Sheet -->
    {#if isMoreMenuOpen}
      <!-- Overlay -->
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div 
        class="mini-bottom-sheet-overlay"
        onclick={() => isMoreMenuOpen = false}
      ></div>
      <!-- Bottom Sheet -->
      <div 
        bind:this={sheetElement}
        class="mini-bottom-sheet" 
        style="transform: translateY({sheetTranslateY}px)"
        transition:fly={{ y: 200, duration: 250 }}
        ontouchstart={handleSheetTouchStart}
        ontouchmove={handleSheetTouchMove}
        ontouchend={handleSheetTouchEnd}
      >
        <div class="mini-bottom-sheet-handle"></div>
        <div class="mini-bottom-sheet-items">
          
          <!-- Votar -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => {
              e.stopPropagation();
              isMoreMenuOpen = false;
              const activeOption = activeAccordionIndex !== null ? paginatedPoll.items[activeAccordionIndex] : null;
              if (hasVotedAnyOption) {
                dispatch('clearVote', { pollId: poll.id });
              } else if (activeOption) {
                dispatch('optionClick', { event: e, optionKey: activeOption.key, pollId: poll.id, optionColor: activeOption.color });
              }
            }}
          >
            <div class="mini-bottom-sheet-icon" style="background-color: {hasVotedAnyOption && votedOptionData ? `${votedOptionData.color}33` : 'rgba(255, 255, 255, 0.1)'}">
              {#if hasVotedAnyOption}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="{votedOptionData?.color || '#10b981'}" stroke="{votedOptionData?.color || '#10b981'}" stroke-width="2">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
              {/if}
            </div>
            <div class="mini-bottom-sheet-text">
              <span style="color: {hasVotedAnyOption && votedOptionData ? votedOptionData.color : 'inherit'}">{hasVotedAnyOption ? 'Votado' : 'Votar'}</span>
              <p>{formatCount(poll.stats?.totalVotes || poll.totalVotes)} votos</p>
            </div>
          </button>

          <!-- Comentarios -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="mini-bottom-sheet-icon bg-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Comentarios</span>
              <p>0 comentarios</p>
            </div>
          </button>

          <!-- Ver en globo -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; handleOpenInGlobe(); }}
          >
            <div class="mini-bottom-sheet-icon bg-cyan-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Ver en el globo</span>
              <p>Explorar ubicación</p>
            </div>
          </button>

          <!-- Estadísticas -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; showStatsModal = true; }}
          >
            <div class="mini-bottom-sheet-icon bg-purple-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Estadísticas</span>
              <p>Ver gráficos y datos</p>
            </div>
          </button>

          <div class="mini-bottom-sheet-divider"></div>

          <!-- Compartir -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; sharePoll(e); }}
          >
            <div class="mini-bottom-sheet-icon bg-blue-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Compartir</span>
              <p>0 compartidos</p>
            </div>
          </button>

          <!-- Repostear -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="mini-bottom-sheet-icon bg-green-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                <path d="M17 1l4 4-4 4"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 23l-4-4 4-4"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Repostear</span>
              <p>0 reposts</p>
            </div>
          </button>

          <!-- Guardar -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="mini-bottom-sheet-icon bg-yellow-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Guardar</span>
              <p>Añadir a guardados</p>
            </div>
          </button>

          <!-- Copiar enlace -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); copyPollLink(); }}
          >
            <div class="mini-bottom-sheet-icon bg-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Copiar enlace</span>
              <p>Compartir URL</p>
            </div>
          </button>

          <div class="mini-bottom-sheet-divider"></div>

          <!-- No me interesa -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="mini-bottom-sheet-icon bg-gray-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>No me interesa</span>
              <p>Ver menos como esto</p>
            </div>
          </button>

          <!-- Reportar -->
          <button 
            class="mini-bottom-sheet-item"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
            style="padding-right: 10px;"
          >
            <div class="mini-bottom-sheet-icon bg-red-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="mini-bottom-sheet-text">
              <span>Reportar</span>
              <p>Denunciar contenido</p>
            </div>
          </button>

        </div>
      </div>
    {/if}

    <!-- Barra de control - Vote/Comments fijos + scroll desde Menu -->
    <div class="mini-control-bar-new">
      <!-- Zona fija: Vote, Comments -->
      <div class="mini-fixed-actions">
        <!-- Votar (estilo PollMaximizedView) -->
        <div class="vote-btn-wrapper">
          {#if hasVotedAnyOption}
            <button 
              class="vote-remove-badge"
              style="background-color: {voteColor}"
              onclick={(e) => {
                e.stopPropagation();
                // Quitar todos los votos
                dispatch('clearVote', { pollId: poll.id });
              }}
              aria-label="Eliminar votos"
            >
              <span class="vote-remove-count">{votedOptionsCount}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          {/if}
          <button 
            bind:this={voteIconElement}
            class="mini-action-btn"
            type="button"
            title={currentOptionVoted ? 'Cambiar voto' : 'Votar'}
            aria-label="Votar"
            onclick={(e) => {
              e.stopPropagation();
              if (activeOption) {
                voteConfirmationColor = activeOption.color;
                showVoteConfirmation = true;
                if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                voteConfirmationTimeout = setTimeout(() => showVoteConfirmation = false, 800);
                dispatch('optionClick', { event: e, optionKey: activeOption.key, pollId: poll.id, optionColor: activeOption.color });
              }
            }}
          >
            {#if currentOptionVoted}
              <div class="vote-icon-voted-container {poll.type === 'multiple' ? 'is-multiple' : ''}" style="background-color: {currentOptionColor}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" class="vote-check-icon">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            {:else}
              <div class="vote-icon-empty-container {poll.type === 'multiple' ? 'is-multiple' : ''}">
                {#if poll.type === 'multiple'}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                {:else}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                {/if}
              </div>
            {/if}
            <span class="mini-action-count {currentOptionVoted ? 'voted' : ''}" style="{currentOptionVoted ? `color: ${currentOptionColor}` : ''}">{formatCount(poll.stats?.totalVotes || poll.totalVotes)}</span>
          </button>
        </div>

        <!-- Comentarios -->
        <button 
          class="mini-action-btn" 
          type="button" 
          title="Comentarios" 
          aria-label="Comentarios"
          onclick={(e) => { e.stopPropagation(); showCommentsModal = true; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <span class="mini-action-count">{poll.stats?.commentsCount || poll.commentsCount || 0}</span>
        </button>

        <!-- Botón añadir opción (colaborativas) -->
        {#if poll.type === 'collaborative' && !poll.options.some((opt: any) => opt.isEditing)}
          <button
            type="button"
            class="mini-action-btn add-collab-btn"
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

      <!-- Zona scroll: Globo, Stats, Share, etc -->
      <div class="mini-scroll-actions-new hide-scrollbar">
        <div class="mini-scroll-content">
          <!-- Globo y Estadísticas - Solo si ha votado -->
          {#if hasVotedAnyOption}
            <button 
              class="mini-action-btn"
              type="button"
              title="Ver en el globo"
              aria-label="Ver en el globo"
              onclick={(e) => { e.stopPropagation(); handleOpenInGlobe(); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </button>

            <button 
              class="mini-action-btn"
              type="button"
              title="Ver estadísticas"
              aria-label="Ver estadísticas"
              onclick={(e) => { e.stopPropagation(); showStatsModal = true; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </button>
          {/if}

          <!-- Compartir -->
          <button 
            class="mini-action-btn"
            type="button"
            title="Compartir"
            aria-label="Compartir"
            onclick={(e) => { e.stopPropagation(); sharePoll(e); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span class="mini-action-count">0</span>
          </button>

          <!-- Repostear -->
          <button class="mini-action-btn-secondary" type="button" title="Repostear" aria-label="Repostear">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 1l4 4-4 4"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <path d="M7 23l-4-4 4-4"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            <span class="mini-action-count-secondary">0</span>
          </button>

        </div>
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
  <div
    class="title-tooltip-overlay"
    role="dialog"
    aria-label="Título completo"
    tabindex="0"
    onclick={hideTitleTooltip}
    onkeydown={(e) => e.key === 'Enter' && hideTitleTooltip()}
  >
    <div class="title-tooltip-content" role="document" onclick={(e) => e.stopPropagation()}>
      {titleTooltipText}
    </div>
  </div>
{/if}

<!-- MODAL DE VOTOS DE AMIGOS -->
<FriendsVotesModal 
  bind:isOpen={showFriendsVotesModal}
  pollTitle={poll.title || ''}
  options={poll.options?.map((opt: any) => ({ 
    id: opt.id || opt.key, 
    key: opt.key || opt.optionKey || opt.id, 
    label: opt.label || opt.optionLabel, 
    color: opt.color,
    votes: opt.voteCount || opt.votes || 0
  })) || []}
  friendsByOption={poll.friendsByOption || {}}
  onClose={() => showFriendsVotesModal = false}
/>

<!-- MODAL DE ESTADÍSTICAS (Portal para salir del BottomSheet) -->
<Portal>
  <StatsBottomModal 
    bind:isOpen={showStatsModal}
    pollId={poll.id}
    pollTitle={poll.title || poll.question || 'Estadísticas'}
    options={poll.options?.map((opt: any) => ({ 
      key: opt.key || opt.optionKey,
      label: opt.label || opt.optionLabel, 
      color: opt.color,
      votes: opt.voteCount || opt.votes || 0
    })) || []}
    onClose={() => showStatsModal = false}
  />
</Portal>

<!-- MODAL DE COMENTARIOS (Portal para salir del BottomSheet) -->
<Portal>
  <CommentsModal 
    bind:isOpen={showCommentsModal}
    pollId={poll.id}
    pollTitle={poll.title || poll.question || ''}
  />
</Portal>

<!-- MODAL DE COMPARTIR -->
<Portal>
  <ShareModal 
    bind:isOpen={showShareModal}
    pollId={poll.id}
    pollHashId={poll.hashId || ''}
    pollTitle={poll.title || poll.question || ''}
  />
</Portal>

<style>
  /* Estilos de botón de votación estilo PollMaximizedView */
  .vote-btn-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .vote-remove-badge {
    position: absolute;
    top: -4px;
    left: -4px;
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 2px 5px;
    background: rgba(50, 50, 50, 0.95);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    z-index: 10;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.15s ease;
  }

  .vote-remove-badge:hover {
    background: rgba(70, 70, 70, 0.95);
    transform: scale(1.1);
  }

  .vote-remove-badge:active {
    transform: scale(0.9);
  }

  .vote-remove-count {
    font-size: 10px;
    font-weight: 700;
  }

  .vote-icon-empty-container {
    position: relative;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(45, 45, 45, 0.95);
    border: 2px solid rgba(70, 70, 70, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vote-icon-empty-container.is-multiple {
    border-radius: 8px;
  }

  .vote-icon-empty-container svg {
    color: rgba(255, 255, 255, 0.45);
  }

  .vote-icon-voted-container {
    position: relative;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }

  .vote-icon-voted-container.is-multiple {
    border-radius: 8px;
  }

  .vote-check-icon {
    color: white;
    position: absolute;
    top: 48%;
    left: 52%;
    transform: translate(-50%, -50%);
    filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.15));
  }

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
    justify-content: flex-end;
    padding: 8px 16px;
    margin: 0;
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

  /* Botón añadir opción - estilo card con borde color */
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

  .add-option-button-bottom:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .add-option-button-bottom:active {
    transform: scale(0.95);
  }

  /* Botón añadir opción en action bar - alineado a la derecha */
  .add-option-button-inline {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    border: 1.5px solid var(--preview-color, #8b5cf6);
    color: var(--preview-color, #8b5cf6);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .add-option-button-inline:hover {
    background: rgba(139, 92, 246, 0.25);
    transform: scale(1.05);
  }

  .add-option-button-inline:active {
    transform: scale(0.95);
  }

  .add-option-button-inline svg {
    stroke: var(--preview-color, #8b5cf6);
  }

  /* Botón añadir colaborativa en action bar - fijo a la derecha */
  .add-collab-btn {
    position: absolute !important;
    right: 12px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 30px !important;
    height: 30px !important;
    min-width: 30px !important;
    border-radius: 6px !important;
    background: #2a2c31 !important;
    border: none !important;
    border-bottom: 2.5px solid var(--preview-color, #8b5cf6) !important;
    color: white !important;
    cursor: pointer;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    gap: 0 !important;
    z-index: 10;
  }

  .add-collab-btn:hover {
    transform: translateY(-50%) scale(1.05) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .add-collab-btn:active {
    transform: translateY(-50%) scale(0.95) !important;
  }

  .add-collab-btn svg {
    stroke: white !important;
  }

  .add-collab-btn .mini-action-count {
    display: none !important;
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

  /* Botón añadir opción en action bar - alineado a la derecha */
  .add-option-button-action-bar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.2);
    border: 1.5px solid rgba(59, 130, 246, 0.5);
    color: #3b82f6;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    margin-left: auto;
  }

  .add-option-button-action-bar:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.7);
    transform: scale(1.05);
  }

  .add-option-button-action-bar:active {
    transform: scale(0.95);
  }

  .add-option-button-action-bar svg {
    stroke: #3b82f6;
  }

  /* Vote cards con background sólido - OCULTAR SCROLL AGRESIVAMENTE */
  :global(.vote-card) {
    background: #2a2c31 !important;
    overflow: hidden !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    max-width: 100%;
  }

  :global(.vote-card.collapsed) {
    background: #2a2c31 !important;
    overflow: hidden !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    max-width: 100%;
  }

  /* Ocultar scrollbars en TODOS los elementos dentro de vote-card */
  :global(.vote-card *),
  :global(.vote-card *::before),
  :global(.vote-card *::after) {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  
  :global(.vote-card *::-webkit-scrollbar) {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  :global(.vote-card iframe),
  :global(.vote-card .media-embed),
  :global(.vote-card .embed-container),
  :global(.vote-card .linkedin-card),
  :global(.vote-card .mini-card) {
    overflow: hidden !important;
    overflow-x: hidden !important;
    max-width: 100% !important;
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

  /* Layout para opciones nuevas colaborativas - Estilo action-bar */
  .remove-option-badge-top {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-option-badge-top:hover {
    background: rgba(239, 68, 68, 0.4);
    border-color: rgba(239, 68, 68, 0.6);
  }

  .remove-option-badge-top:active {
    transform: scale(0.95);
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
    border-radius: 32px;
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
    border-radius: 32px;
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

  /* Botones posicionados absolutamente para opciones en edición - Estilo action-bar */
  .color-picker-badge-absolute {
    position: absolute;
    bottom: 16px;
    right: 60px;
    padding: 8px 10px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
  }

  .color-picker-badge-absolute:hover {
    border-color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.1);
  }

  .color-picker-badge-absolute:active {
    transform: scale(0.95);
  }

  .color-picker-badge-absolute svg {
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 0.9);
  }

  .publish-option-btn-absolute {
    position: absolute;
    bottom: 16px;
    right: 16px;
    padding: 8px 10px;
    border-radius: 16px;
    background: rgba(16, 185, 129, 0.3);
    border: 1px solid rgba(16, 185, 129, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 3;
  }

  .publish-option-btn-absolute:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.5);
    border-color: rgba(16, 185, 129, 0.8);
  }

  .publish-option-btn-absolute:active:not(:disabled) {
    transform: scale(0.95);
  }

  .publish-option-btn-absolute:disabled {
    background: rgba(107, 114, 128, 0.2);
    border-color: rgba(107, 114, 128, 0.3);
    cursor: not-allowed;
    opacity: 0.5;
  }

  .publish-option-btn-absolute svg {
    width: 20px;
    height: 20px;
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
    background: transparent;
    border-radius: 0;
    overflow: visible;
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
    background: transparent;
  }

  .header-compact-inner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .header-menu-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    color: rgba(255, 255, 255, 0.6);
    flex-shrink: 0;
    margin-left: auto;
  }

  .header-menu-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }

  .header-menu-btn:active {
    transform: scale(0.95);
  }

  .header-avatar-mini {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    padding: 0;
    cursor: pointer;
  }

  .header-avatar-mini img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .header-user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-username-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-username {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-follow-btn {
    padding: 2px 8px;
    border-radius: 4px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .header-follow-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .header-follow-btn:active {
    transform: scale(0.95);
  }

  .follow-text {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .header-metadata {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .header-metadata-dot {
    color: rgba(255, 255, 255, 0.3);
  }

  .header-poll-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: rgba(255, 255, 255, 0.6);
  }

  .header-question-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 4px 0;
  }

  .header-question-row .poll-question {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
    flex: 1;
    cursor: pointer;
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
    padding: 10px 16px 8px 16px;
    box-sizing: border-box;
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
    opacity: 1;
    z-index: 0;
  }

  .noise-overlay {
    display: none;
  }

  .media-embed-background {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .media-gradient-overlay {
    display: none;
  }

  /* Degradado inferior - desactivado para color plano */
  .maximized-bottom-gradient {
    display: none;
  }

  /* Contenido en la parte INFERIOR */
  .option-content-maximized {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 16px 20px 24px 20px;
    text-align: left;
  }

  /* Label grande - ESTILO UNIFICADO */
  .option-label-maximized {
    font-size: 18px;
    font-weight: 800;
    color: white;
    letter-spacing: -0.02em;
    line-height: 1.1;
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.6),
      0 1px 3px rgba(0, 0, 0, 0.8);
    word-wrap: break-word;
    max-width: 100%;
    margin: 0;
  }

  /* Línea divisoria blanca fina */
  .maximized-divider-line {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.4);
    margin: 8px 0;
  }

  /* Porcentaje cuando ha votado - posicionado abajo del label */
  .option-percentage-voted-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 12px;
  }

  /* Porcentaje grande - ESTILO UNIFICADO */
  .percentage-value-large {
    font-size: 32px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.5),
      0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* Subtítulo del porcentaje - ESTILO UNIFICADO */
  .percentage-subtitle {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  /* === LAYOUT VIDEO/SPOTIFY/SOUNDCLOUD MINI === */
  .card-video-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    border-radius: 32px;
    overflow: hidden;
  }

  .card-video-area {
    flex: 0 0 40%;
    min-height: 0;
    overflow: hidden;
    border-radius: 28px 28px 0 0;
    background: inherit;
  }

  .card-video-area :global(iframe),
  .card-video-area :global(video),
  .card-video-area :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-video-area :global(.media-embed-container),
  .card-video-area :global(.embed-wrapper),
  .card-video-area :global(div) {
    background: inherit !important;
  }

  .card-video-bottom {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 12px 16px 16px 16px;
    gap: 6px;
    background: transparent;
  }

  .card-divider-line {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.3);
  }

  .card-bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 8px;
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

  /* Avatares de amigos en diseño maximizado (posición absoluta) */
  .friend-avatars-maximized {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 4px;
    z-index: 10;
  }

  /* Avatares de amigos inline (junto al porcentaje) */
  .friend-avatars-inline {
    display: flex;
    align-items: center;
    gap: -4px;
    margin-left: auto;
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

  /* Botón clickeable para avatares de amigos - Sin fondo */
  .friend-avatars-btn-mini {
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .friend-avatars-btn-mini:not(:disabled):hover {
    transform: scale(1.05);
  }

  .friend-avatars-btn-mini:not(:disabled):active {
    transform: scale(0.95);
  }

  .friend-avatars-btn-mini:disabled {
    cursor: default;
    opacity: 0.9;
  }

  /* Contenedor principal de scroll horizontal */
  .poll-options-scroll-container {
    width: 100%;
    margin: 0;
    padding-left: 10px;
    background: transparent;
  }

  /* Scroll horizontal estilo SearchModal (scrollbar oculto) */
  .options-horizontal-scroll {
    display: flex;
    overflow-x: auto;
    overflow-y: visible;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    /* Ocultar scrollbar */
    scrollbar-width: none;
    -ms-overflow-style: none;
    gap: 12px;
    height: 250px;
    padding: 4px 12px;
  }

  .options-horizontal-scroll::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  /* Cada slide/opción ocupa el 100% del ancho */
  .option-slide {
    flex-shrink: 0;
    width: 100%;
    height: 100%;
    scroll-snap-align: start;
    position: relative;
    border-radius: 32px;
    overflow: hidden;
    margin: 0;
    background: transparent;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    /* Borde siempre visible con el color de la opción */
    box-shadow: none;
    border: 3px solid var(--option-border-color, transparent);
    /* Ocultar scrollbars */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .option-slide::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
  
  .option-slide *,
  .option-slide *::-webkit-scrollbar {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  
  .option-slide *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
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


    /* Media query mantiene consistencia */
    .percentage-value-large {
      font-size: 32px;
    }

    .percentage-subtitle {
      font-size: 9px;
    }

    .options-horizontal-scroll {
      height: 230px;
    }

    .option-slide {
      width: 100%;
      margin: 0;
      border-radius: 32px;
    }

    .options-indicators {
      gap: 2px;
      width: 100%;
      padding: 8px 14px 6px 14px;
    }

    .option-indicator {
      height: 5px;
    }
  }

  /* ========================================
     MINI ACTION BAR - Vote/Comments fijos + scroll desde Menu
     ======================================== */
  
  .mini-action-bar {
    position: relative;
    padding: 8px 12px;
    background: transparent;
  }

  /* Nuevo layout: contenedor centrado con ancho máximo */
  .mini-control-bar-new {
    width: 100%;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .mini-fixed-actions {
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
  }

  .mini-scroll-actions-new {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    /* Ancho máximo para el scroll */
    max-width: 155px;
  }

  .mini-scroll-actions-new::-webkit-scrollbar {
    display: none;
  }

  .mini-scroll-content {
    display: flex;
    align-items: center;
    gap: 0;
    width: max-content;
  }

  /* Layout anterior (deprecado pero mantenido por compatibilidad) */
  .mini-control-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
  }

  .mini-action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border: none;
    border-radius: 20px;
    background: transparent;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mini-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .mini-action-btn:active {
    transform: scale(0.95);
  }

  .mini-action-btn.voted {
    background: color-mix(in srgb, var(--vote-color, #10b981) 15%, transparent);
    color: var(--vote-color, #10b981);
  }

  .mini-action-btn svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .mini-icon-voted {
    animation: miniBeat 0.8s ease-out;
  }

  @keyframes miniBeat {
    0% { transform: scale(1); }
    15% { transform: scale(1.25); }
    30% { transform: scale(1); }
    45% { transform: scale(1.15); }
    60% { transform: scale(1); }
  }

  .mini-action-count {
    font-size: 11px;
    font-weight: 600;
    font-family: monospace;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.8);
  }

  .mini-action-count.voted {
    color: var(--vote-color, #10b981);
  }

  .mini-more-btn-scroll {
    opacity: 0.6;
  }

  .mini-more-btn-scroll:hover {
    opacity: 1;
  }

  .mini-action-subtle {
    opacity: 0.5;
  }

  .mini-action-subtle:hover {
    opacity: 1;
  }

  /* Bottom Sheet Modal */
  .mini-bottom-sheet-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
  }

  .mini-bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1001;
    background: #1a1a1a;
    border-radius: 24px 24px 0 0;
    padding: 16px 16px 24px;
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.5);
    max-height: 60vh;
    overflow-y: auto;
  }

  .mini-bottom-sheet-handle {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    margin: 0 auto 16px;
  }

  .mini-bottom-sheet-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mini-bottom-sheet-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: white;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .mini-bottom-sheet-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .mini-bottom-sheet-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .mini-bottom-sheet-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mini-bottom-sheet-text span {
    font-size: 15px;
    font-weight: 500;
  }

  .mini-bottom-sheet-text p {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
  }

  .mini-bottom-sheet-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 8px 0;
  }

  .mini-scroll-actions {
    flex: 1;
    overflow-x: auto;
    -webkit-mask-image: linear-gradient(to right, black 95%, transparent 100%);
    mask-image: linear-gradient(to right, black 95%, transparent 100%);
  }

  .mini-scroll-actions::-webkit-scrollbar {
    display: none;
  }

  .mini-scroll-actions {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .mini-scroll-inner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 60px;
    padding-left: 0;
  }

  .mini-action-btn-secondary {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .mini-action-btn-secondary:hover {
    color: white;
  }

  .mini-action-btn-secondary:active {
    transform: scale(0.95);
  }

  .mini-action-btn-secondary svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .mini-action-count-secondary {
    font-size: 10px;
    font-weight: 500;
    font-family: monospace;
    color: rgba(255, 255, 255, 0.6);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Menú desplegable glassmorphism */
  .mini-glass-menu {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    width: 180px;
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .mini-menu-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mini-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: white;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .mini-menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .mini-menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
  }

  .mini-menu-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: rgba(20, 20, 20, 0.95);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
</style>

<!-- Modal de perfil movida a +page.svelte para que esté al nivel superior -->
