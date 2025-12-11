<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, ChevronDown, Eye, Activity, TrendingUp, RefreshCw } from 'lucide-svelte';
  import { onMount } from 'svelte';

  interface PollOption {
    id?: string;
    key: string;
    label: string;
    color: string;
    votes?: number;
    optionKey?: string;
    optionLabel?: string;
  }

  interface Props {
    isOpen: boolean;
    pollId: string | number;
    pollTitle: string;
    options: PollOption[];
    onClose: () => void;
  }

  let { 
    isOpen = $bindable(false), 
    pollId,
    pollTitle = 'Datos Globales',
    options = [],
    onClose 
  }: Props = $props();

  // Time range state
  const timeRanges = [
    { id: '1d', label: '1D', hours: 24 },
    { id: '1w', label: '1W', hours: 168 },
    { id: '1m', label: '1M', hours: 720 },
    { id: '1y', label: '1Y', hours: 8760 }
  ];
  
  let selectedTimeRange = $state('1d');
  let showAllOptions = $state(true);
  let visibleOptions = $state<Set<string>>(new Set());
  
  // Chart type: 'line' | 'bar' | 'pie'
  let chartType = $state<'line' | 'bar' | 'pie'>('line');
  
  // Donut chart selected segment
  let selectedDonutOption = $state<string | null>(null);
  
  // Country filter
  let selectedCountry = $state<string>('global');
  let showCountryDropdown = $state(false);
  const countries = [
    { code: 'global', name: 'Globales' },
    { code: 'ESP', name: 'España' },
    { code: 'MEX', name: 'México' },
    { code: 'ARG', name: 'Argentina' },
    { code: 'COL', name: 'Colombia' },
    { code: 'USA', name: 'Estados Unidos' },
  ];
  
  // Chart state
  let historicalData: Array<{x: number, y: number, votes: number, date: Date}> = $state([]);
  let historicalDataByOption: Map<string, Array<{x: number, y: number, color: string, label: string}>> = $state(new Map());
  let isLoadingHistory = $state(false);
  let hasLoadedOnce = $state(false);
  let chartHoverData: {x: number, y: number, votes: number, date: Date, optionLabel?: string} | null = $state(null);
  let chartSvgElement: SVGElement | null = $state(null);
  let chartScrollArea: HTMLDivElement | null = $state(null);
  
  // Dynamic value labels that update on scroll
  let visibleValues: Map<string, {y: number, value: number, color: string}> = $state(new Map());
  
  // Global min/max for shared Y scale
  let globalMinY = $state(0);
  let globalMaxY = $state(100);
  
  // Swipe to close
  let sheetTouchStartY = $state(0);
  let sheetCurrentY = $state(0);
  let sheetTranslateY = $state(0);
  let canSwipeClose = $state(false);
  
  // Track previous isOpen to detect changes
  let prevIsOpen = false;
  
  // Initialize visible options - only on first open
  $effect(() => {
    if (isOpen && !prevIsOpen) {
      // Modal just opened
      prevIsOpen = true;
      // Use string keys for consistency
      visibleOptions = new Set(options.map(opt => String(opt.key || opt.optionKey || '')));
      if (!hasLoadedOnce) {
        loadHistoricalData();
      }
    } else if (!isOpen && prevIsOpen) {
      // Modal just closed
      prevIsOpen = false;
      hasLoadedOnce = false;
    }
  });
  
  async function loadHistoricalData() {
    if (isLoadingHistory || !pollId) return;
    
    isLoadingHistory = true;
    try {
      const range = timeRanges.find(r => r.id === selectedTimeRange);
      const days = range ? Math.ceil(range.hours / 24) : 1;
      
      const response = await fetch(`/api/polls/${pollId}/votes-history?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      const timeSeriesData = result.data || [];
      const pollData = result.poll || {};
      
      if (timeSeriesData.length === 0) {
        historicalData = [];
        historicalDataByOption = new Map();
        return;
      }
      
      const pollOptions = pollData.options || options;
      const seriesByOption = new Map<string, Array<{x: number, y: number, color: string, label: string}>>();
      
      // Initialize series for each option using consistent string keys
      pollOptions.forEach((option: any) => {
        const key = String(option.optionKey || option.key);
        seriesByOption.set(key, []);
      });
      
      // Also add series for passed-in options if not already present
      options.forEach((option: any) => {
        const key = String(option.key || option.optionKey);
        if (!seriesByOption.has(key)) {
          seriesByOption.set(key, []);
        }
      });
      
      timeSeriesData.forEach((point: any) => {
        const optionsData = point.optionsData || [];
        const optionsDataMap = new Map(optionsData.map((opt: any) => [String(opt.optionKey), opt]));
        
        seriesByOption.forEach((series, key) => {
          const optData = optionsDataMap.get(key) as { optionKey: string, votes: number } | undefined;
          const option = pollOptions.find((o: any) => String(o.optionKey || o.key) === key) || 
                         options.find((o: any) => String(o.key || o.optionKey) === key);
          
          series.push({
            x: point.timestamp,
            y: optData?.votes || 0,
            color: option?.color || '#3b82f6',
            label: option?.optionLabel || option?.label || ''
          });
        });
      });
      
      historicalDataByOption = seriesByOption;
      historicalData = timeSeriesData.map((point: any) => ({
        x: point.timestamp,
        y: point.totalVotes,
        votes: point.totalVotes,
        date: new Date(point.timestamp)
      }));
      
      // Calculate global min/max for shared Y scale
      let allValues: number[] = [];
      seriesByOption.forEach((series) => {
        series.forEach(point => allValues.push(point.y));
      });
      if (allValues.length > 0) {
        globalMinY = Math.min(...allValues);
        globalMaxY = Math.max(...allValues);
        // Add some padding
        const padding = (globalMaxY - globalMinY) * 0.1;
        globalMinY = Math.max(0, globalMinY - padding);
        globalMaxY = globalMaxY + padding;
      }
      
      hasLoadedOnce = true;
      
      // Initialize visible values with last points
      updateVisibleValuesFromScroll();
      
      // Scroll to right (most recent data) after a tick
      setTimeout(() => {
        if (chartScrollArea) {
          chartScrollArea.scrollLeft = chartScrollArea.scrollWidth;
          updateVisibleValuesFromScroll();
        }
      }, 100);
      
    } catch (error) {
      console.error('[StatsModal] Error loading history:', error);
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
  
  function toggleOption(key: string) {
    const newSet = new Set(visibleOptions);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    visibleOptions = newSet;
  }
  
  // Update visible values based on scroll position
  function updateVisibleValuesFromScroll() {
    if (!chartScrollArea || historicalDataByOption.size === 0) return;
    
    const scrollLeft = chartScrollArea.scrollLeft;
    const clientWidth = chartScrollArea.clientWidth;
    const scrollWidth = chartScrollArea.scrollWidth;
    
    // Calculate what percentage of the chart is visible at the right edge
    const rightEdgePercent = Math.min(1, (scrollLeft + clientWidth) / scrollWidth);
    
    const newValues = new Map<string, {y: number, value: number, color: string}>();
    
    historicalDataByOption.forEach((seriesData, optionKey) => {
      if (!visibleOptions.has(optionKey) || seriesData.length === 0) return;
      
      // Find the data point at the visible right edge
      const dataIndex = Math.min(
        Math.floor(rightEdgePercent * seriesData.length),
        seriesData.length - 1
      );
      const point = seriesData[dataIndex];
      
      if (point) {
        newValues.set(optionKey, {
          y: getYPosition(point.y, 240),
          value: point.y,
          color: point.color
        });
      }
    });
    
    visibleValues = newValues;
  }
  
  // Handle scroll event
  function handleChartScroll() {
    updateVisibleValuesFromScroll();
  }
  
  // Convert Y value to SVG Y coordinate using global scale
  function getYPosition(value: number, height: number, paddingTop: number = 20, paddingBottom: number = 30): number {
    const rangeY = globalMaxY - globalMinY || 1;
    const normalizedY = (value - globalMinY) / rangeY;
    const chartHeight = height - paddingTop - paddingBottom;
    return paddingTop + chartHeight * (1 - normalizedY);
  }
  
  // Create chart path using global Y scale
  function createChartPath(data: Array<{x: number, y: number}>, width: number, height: number, paddingLeft: number = 0, paddingRight: number = 50): string {
    if (!data || data.length === 0) return '';
    
    const validData = data.filter(d => 
      d && typeof d.x === 'number' && !isNaN(d.x) && 
      typeof d.y === 'number' && !isNaN(d.y)
    );
    
    if (validData.length === 0) return '';
    
    const chartWidth = width - paddingLeft - paddingRight;
    
    const points = validData.map((d, i) => {
      const x = paddingLeft + (i / Math.max(1, validData.length - 1)) * chartWidth;
      const y = getYPosition(d.y, height);
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    
    return `M ${points.join(' L ')}`;
  }
  
  // Get Y axis tick values
  function getYAxisTicks(): number[] {
    const range = globalMaxY - globalMinY;
    const step = range / 4;
    return [
      globalMaxY,
      globalMaxY - step,
      globalMaxY - step * 2,
      globalMaxY - step * 3,
      globalMinY
    ];
  }
  
  // Get date labels from historical data
  function getDateLabels(): Array<{x: number, label: string}> {
    if (historicalData.length === 0) return [];
    
    const labels: Array<{x: number, label: string}> = [];
    const totalPoints = historicalData.length;
    const step = Math.max(1, Math.floor(totalPoints / 5));
    
    for (let i = 0; i < totalPoints; i += step) {
      const point = historicalData[i];
      const x = (i / Math.max(1, totalPoints - 1)) * 250; // 300 - 50 padding
      const date = point.date;
      let label = '';
      
      if (selectedTimeRange === '1d' || selectedTimeRange === '1h' || selectedTimeRange === '24h') {
        // Para 1 día, mostrar horas
        label = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      } else if (selectedTimeRange === '1w' || selectedTimeRange === '7d') {
        // Para 1 semana, mostrar día de la semana + número
        label = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      } else {
        // Para 1 mes o más, mostrar día y mes
        label = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      }
      
      labels.push({ x, label });
    }
    
    return labels;
  }
  
  function handleChartInteraction(event: MouseEvent | TouchEvent) {
    if (!chartSvgElement || historicalData.length === 0) return;
    
    event.preventDefault();
    const rect = chartSvgElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = clientX - rect.left;
    const relativeX = Math.max(0, Math.min(1, x / rect.width));
    const dataIndex = Math.round(relativeX * (historicalData.length - 1));
    const dataPoint = historicalData[dataIndex];
    
    if (dataPoint) {
      chartHoverData = {
        x: x,
        y: dataPoint.y,
        votes: dataPoint.votes,
        date: dataPoint.date
      };
    }
  }
  
  function clearChartHover() {
    chartHoverData = null;
  }
  
  function handleClose() {
    isOpen = false;
    onClose?.();
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }
  
  function handleSheetTouchStart(e: TouchEvent, sheetElement: HTMLElement | null) {
    sheetTouchStartY = e.touches[0].clientY;
    canSwipeClose = sheetElement ? sheetElement.scrollTop <= 0 : true;
  }
  
  function handleSheetTouchMove(e: TouchEvent) {
    if (!canSwipeClose) return;
    sheetCurrentY = e.touches[0].clientY;
    const diff = sheetCurrentY - sheetTouchStartY;
    if (diff > 0) {
      sheetTranslateY = diff;
      e.preventDefault();
    }
  }
  
  function handleSheetTouchEnd() {
    if (sheetTranslateY > 50) {
      handleClose();
    }
    sheetTranslateY = 0;
    canSwipeClose = false;
  }
  
  // Block body scroll when open
  $effect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  });
  
  // Teleport action to move modal to body (not currently used - using Portal instead)
  function teleportToBody(node: HTMLElement) {
    document.body.appendChild(node);
    
    return {
      destroy() {
        if (node.parentNode === document.body) {
          document.body.removeChild(node);
        }
      }
    };
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div 
    class="modal-backdrop"
    transition:fade={{ duration: 200 }}
    role="button"
    tabindex="-1"
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Enter' && handleClose()}
    ontouchmove={(e) => e.preventDefault()}
  >
    <!-- Modal Sheet -->
    <div 
      class="modal-sheet"
      transition:fly={{ y: 500, duration: 300, easing: cubicOut }}
      style="transform: translateY({sheetTranslateY}px)"
      ontouchstart={(e) => handleSheetTouchStart(e, e.currentTarget)}
      ontouchmove={handleSheetTouchMove}
      ontouchend={handleSheetTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
    >
      <!-- Drag Handle -->
      <div class="drag-handle">
        <div class="drag-bar"></div>
      </div>
      
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <!-- Country filter button - opens modal -->
          <button 
            class="country-filter-btn"
            onclick={() => showCountryDropdown = true}
            aria-label="Filtrar por país"
          >
            <span>Datos {selectedCountry === 'global' ? 'Globales' : `de ${countries.find(c => c.code === selectedCountry)?.name}`}</span>
            <ChevronDown size={18} class="filter-chevron" />
          </button>
        </div>
      </div>
      
      <!-- Options Pills -->
      <div class="options-bar">
        <button 
          class="eye-toggle {showAllOptions ? 'active' : ''}"
          onclick={() => {
            showAllOptions = !showAllOptions;
            if (showAllOptions) {
              visibleOptions = new Set(options.map(opt => opt.key || opt.optionKey || ''));
            } else {
              visibleOptions = new Set();
            }
          }}
          title={showAllOptions ? 'Ocultar todas' : 'Mostrar todas'}
          aria-label={showAllOptions ? 'Ocultar todas las opciones' : 'Mostrar todas las opciones'}
        >
          <Eye size={18} />
        </button>
        
        <div class="options-scroll">
          {#each options as option}
            {@const optKey = option.key || option.optionKey || ''}
            {@const isVisible = visibleOptions.has(optKey)}
            <button 
              class="option-pill {isVisible ? 'active' : ''}"
              style="--pill-color: {option.color}"
              onclick={() => toggleOption(optKey)}
            >
              <span class="pill-dot" style="background-color: {option.color}"></span>
              <span class="pill-label">{option.label || option.optionLabel}</span>
            </button>
          {/each}
        </div>
      </div>
      
      <!-- Chart Area -->
      <div class="chart-container">
        {#if isLoadingHistory}
          <div class="chart-loading">
            <RefreshCw size={24} class="spinning" />
            <span>Cargando datos...</span>
          </div>
        {:else if historicalDataByOption.size > 0 || options.length > 0}
          {#if chartType === 'line'}
          <!-- Chart wrapper with fixed Y-axis -->
          <div class="chart-wrapper">
            <!-- Scrollable chart area -->
            <div class="chart-scroll-area" bind:this={chartScrollArea} onscroll={handleChartScroll}>
              <svg 
                viewBox="0 0 600 260" 
                preserveAspectRatio="none"
                class="chart-svg"
                bind:this={chartSvgElement}
                role="img"
                aria-label="Histórico de votos"
              >
                <!-- Horizontal grid lines -->
                {#each getYAxisTicks() as tick, i}
                  {@const y = getYPosition(tick, 240)}
                  <line 
                    x1="0" 
                    y1={y} 
                    x2="600" 
                    y2={y} 
                    stroke="rgba(255,255,255,0.08)" 
                    stroke-width="1" 
                    stroke-dasharray={i === 2 ? "4,4" : "none"}
                  />
                {/each}
                
                <!-- Lines per option -->
                {#each Array.from(historicalDataByOption.entries()) as [optionKey, seriesData]}
                  {@const chartPath = createChartPath(seriesData, 600, 240, 0, 0)}
                  {@const color = seriesData[0]?.color || '#3b82f6'}
                  {@const isVisible = visibleOptions.has(optionKey)}
                  {@const lastPoint = seriesData[seriesData.length - 1]}
                  
                  {#if chartPath && isVisible}
                    <!-- Line -->
                    <path
                      d={chartPath}
                      fill="none"
                      stroke={color}
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    
                    <!-- End dot -->
                    {#if lastPoint}
                      {@const dotY = getYPosition(lastPoint.y, 240)}
                      <circle 
                        cx="600" 
                        cy={dotY} 
                        r="4" 
                        fill={color}
                      />
                    {/if}
                  {/if}
                {/each}
              
              <!-- Date labels at bottom -->
              {#each getDateLabels() as dateLabel}
                <text 
                  x={dateLabel.x * 2.4} 
                  y="210" 
                  fill="rgba(255,255,255,0.5)" 
                  font-size="10" 
                  text-anchor="middle"
                >
                  {dateLabel.label}
                </text>
              {/each}
              
              </svg>
            </div>
            
            <!-- Fixed Y-axis labels on right -->
            <div class="y-axis-labels">
              {#each getYAxisTicks() as tick}
                {@const y = getYPosition(tick, 240)}
                <div class="y-label" style="top: {y}px">
                  {tick.toFixed(0)}
                </div>
              {/each}
              
              <!-- Dynamic value labels that move with scroll -->
              {#each Array.from(visibleValues.entries()) as [optionKey, valueData]}
                <div 
                  class="value-label" 
                  style="top: {valueData.y - 10}px; background-color: {valueData.color}"
                >
                  {valueData.value.toFixed(2)}
                </div>
              {/each}
            </div>
          </div>
        {:else if chartType === 'bar'}
          <!-- Bar Chart View -->
          <div class="bar-chart-container">
            {#each options as option, i}
              {@const optKey = option.key || option.optionKey || ''}
              {@const isVisible = visibleOptions.has(optKey)}
              {@const totalVotes = options.reduce((sum, o) => sum + (o.votes || 0), 0)}
              {@const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes * 100) : 0}
              {#if isVisible}
                <div class="bar-chart-item">
                  <div class="bar-rank">#{i + 1}</div>
                  <div class="bar-info">
                    <div class="bar-label">{option.label || option.optionLabel}</div>
                    <div class="bar-track">
                      <div 
                        class="bar-fill" 
                        style="width: {percentage}%; background-color: {option.color}"
                      ></div>
                    </div>
                  </div>
                  <div class="bar-percentage">{percentage.toFixed(0)}%</div>
                </div>
              {/if}
            {/each}
          </div>
        {:else if chartType === 'pie'}
          <!-- Donut Chart View -->
          {@const visibleOpts = options.filter(o => visibleOptions.has(o.key || o.optionKey || ''))}
          {@const totalVotes = visibleOpts.reduce((sum, o) => sum + (o.votes || 0), 0)}
          {@const circumference = 2 * Math.PI * 77.5}
          <div class="donut-chart-container">
            <svg viewBox="0 0 200 200" class="donut-svg" preserveAspectRatio="xMidYMid meet">
              <!-- Background circle -->
              <circle cx="100" cy="100" r="77.5" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="25"/>
              
              <!-- Segments - rendered in reverse order so first option is on top -->
              {#each visibleOpts as option, i}
                {@const optKey = option.key || option.optionKey || ''}
                {@const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes * 100) : 0}
                {@const prevTotal = visibleOpts.slice(0, i).reduce((sum, o) => sum + (o.votes || 0), 0)}
                {@const prevPercentage = totalVotes > 0 ? (prevTotal / totalVotes * 100) : 0}
                {@const dashLength = (percentage / 100) * circumference}
                {@const dashOffset = -(prevPercentage / 100) * circumference}
                {#if percentage > 0}
                  <circle 
                    cx="100" 
                    cy="100" 
                    r="77.5"
                    fill="none"
                    stroke={option.color}
                    stroke-width="25"
                    stroke-linecap="butt"
                    stroke-dasharray="{dashLength} {circumference - dashLength}"
                    stroke-dashoffset={dashOffset}
                    transform="rotate(-90 100 100)"
                    class="donut-segment"
                    role="button"
                    tabindex="0"
                    onclick={() => selectedDonutOption = optKey === selectedDonutOption ? null : optKey}
                    onkeydown={(e) => e.key === 'Enter' && (selectedDonutOption = optKey === selectedDonutOption ? null : optKey)}
                  />
                {/if}
              {/each}
            </svg>
            <!-- Center text - only show when segment is selected -->
            {#if selectedDonutOption}
              {@const selectedOpt = options.find(o => (o.key || o.optionKey) === selectedDonutOption)}
              {@const selectedPct = totalVotes > 0 ? ((selectedOpt?.votes || 0) / totalVotes * 100) : 0}
              <div class="donut-center">
                <span class="donut-percentage">{selectedPct.toFixed(0)}%</span>
                <span class="donut-label">{selectedOpt?.label || selectedOpt?.optionLabel}</span>
              </div>
            {/if}
          </div>
          {/if}
        {:else}
          <div class="chart-empty">
            <Activity size={48} class="empty-icon" />
            <p>No hay datos históricos disponibles</p>
          </div>
        {/if}
      </div>
      
      <!-- Bottom Controls: Chart Type + Time Range -->
      <div class="bottom-controls">
        <!-- Chart Type Buttons -->
        <div class="chart-type-bar">
          <button 
            class="chart-type-btn {chartType === 'line' ? 'active' : ''}" 
            onclick={() => chartType = 'line'}
            aria-label="Gráfico de líneas"
          >
            <TrendingUp size={18} />
          </button>
          <button 
            class="chart-type-btn {chartType === 'bar' ? 'active' : ''}" 
            onclick={() => chartType = 'bar'}
            aria-label="Gráfico de barras"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="10" width="4" height="10" rx="1"/>
              <rect x="10" y="6" width="4" height="14" rx="1"/>
              <rect x="17" y="2" width="4" height="18" rx="1"/>
            </svg>
          </button>
          <button 
            class="chart-type-btn {chartType === 'pie' ? 'active' : ''}" 
            onclick={() => chartType = 'pie'}
            aria-label="Gráfico circular"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2v10l8.5 5"/>
            </svg>
          </button>
        </div>
        
        <!-- Time Range Buttons -->
        <div class="time-range-bar">
          {#each timeRanges as range}
            <button
              class="time-btn {selectedTimeRange === range.id ? 'active' : ''}"
              onclick={() => changeTimeRange(range.id)}
            >
              {range.label}
            </button>
          {/each}
        </div>
      </div>
      
      <!-- Close button -->
      <button class="close-btn" onclick={handleClose} aria-label="Cerrar">
        <X size={24} />
      </button>
    </div>
  </div>
  
  <!-- Country Selection Modal -->
  {#if showCountryDropdown}
    <div 
      class="country-modal-backdrop"
      role="button"
      tabindex="-1"
      onclick={() => showCountryDropdown = false}
      onkeydown={(e) => e.key === 'Escape' && (showCountryDropdown = false)}
      transition:fade={{ duration: 150 }}
    >
      <div 
        class="country-modal"
        onclick={(e) => e.stopPropagation()}
        transition:fly={{ y: 300, duration: 250, easing: cubicOut }}
      >
        <div class="country-modal-header">
          <h3>Seleccionar región</h3>
          <button class="country-modal-close" onclick={() => showCountryDropdown = false}>
            <X size={20} />
          </button>
        </div>
        <div class="country-list">
          {#each countries as country}
            <button 
              class="country-list-item {selectedCountry === country.code ? 'active' : ''}"
              onclick={() => { selectedCountry = country.code; showCountryDropdown = false; }}
            >
              <span class="country-name">{country.name}</span>
              {#if selectedCountry === country.code}
                <span class="country-check">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Use :global since the element is teleported to body */
  :global(.stats-modal-backdrop) {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.7) !important;
    backdrop-filter: blur(4px);
    z-index: 9999999 !important;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 9999999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    touch-action: none; /* Prevent background scroll on touch */
    overscroll-behavior: contain;
  }
  
  .modal-sheet {
    position: relative;
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    background: linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%);
    border-radius: 24px 24px 0 0;
    padding: 0 16px calc(24px + env(safe-area-inset-bottom));
    padding-bottom: max(24px, calc(24px + env(safe-area-inset-bottom)));
    overflow: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: none;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  
  .drag-handle {
    display: flex;
    justify-content: center;
    padding: 12px 0 8px;
  }
  
  .drag-bar {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0 16px;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  /* Country Filter Button */
  .country-filter-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    background: transparent;
    border: none;
    color: white;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
  }
  
  .country-filter-btn :global(.filter-chevron) {
    opacity: 0.6;
  }
  
  /* Country Selection Modal */
  .country-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 99999999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  
  .country-modal {
    width: 100%;
    max-width: 500px;
    background: #0d0d0d;
    border-radius: 20px 20px 0 0;
    padding: 16px;
    max-height: 60vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .country-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .country-modal-header h3 {
    font-size: 16px;
    font-weight: 600;
    color: white;
    margin: 0;
  }
  
  .country-modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
  }
  
  .country-list {
    overflow-y: auto;
    padding-top: 8px;
  }
  
  .country-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 14px 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  
  .country-list-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .country-list-item.active {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .country-check {
    color: #22c55e;
    font-weight: 600;
  }
  
  /* Bar Chart */
  .bar-chart-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.2) transparent;
  }
  
  .bar-chart-container::-webkit-scrollbar {
    width: 4px;
  }
  
  .bar-chart-container::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .bar-chart-container::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
  }
  
  .bar-chart-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .bar-rank {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    min-width: 24px;
  }
  
  .bar-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .bar-label {
    font-size: 13px;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }
  
  .bar-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  
  .bar-percentage {
    font-size: 14px;
    font-weight: 700;
    color: white;
    min-width: 40px;
    text-align: right;
  }
  
  /* Donut Chart */
  .donut-chart-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  
  .donut-svg {
    width: 180px;
    height: 180px;
  }
  
  .donut-segment {
    cursor: pointer;
    outline: none;
  }
  
  .donut-segment:focus {
    outline: none;
  }
  
  .donut-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  
  .donut-percentage {
    font-size: 32px;
    font-weight: 700;
    color: white;
  }
  
  .donut-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    max-width: 80px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .options-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .eye-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .eye-toggle.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
  
  .options-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding: 4px 0;
  }
  
  .options-scroll::-webkit-scrollbar {
    display: none;
  }
  
  .option-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    max-width: 150px;
  }
  
  .option-pill.active {
    background: rgba(var(--pill-color), 0.2);
    border-color: var(--pill-color);
    color: white;
  }
  
  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .pill-label {
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }
  
  .chart-container {
    position: relative;
    height: 260px;
    margin: 16px 0;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    overflow: hidden;
  }
  
  .chart-wrapper {
    display: flex;
    height: 100%;
    position: relative;
  }
  
  .chart-scroll-area {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox - ocultar scrollbar */
  }
  
  .chart-scroll-area::-webkit-scrollbar {
    display: none; /* Chrome/Safari - ocultar scrollbar */
  }
  
  .chart-svg {
    width: 600px;
    height: 220px;
    display: block;
    touch-action: pan-x;
    flex-shrink: 0;
  }
  
  .y-axis-labels {
    position: relative;
    width: 50px;
    flex-shrink: 0;
    margin-left: -2px;
  }
  
  .y-label {
    position: absolute;
    right: 4px;
    font-size: 9px;
    color: rgba(255,255,255,0.4);
    transform: translateY(-50%);
  }
  
  .value-label {
    position: absolute;
    left: 0;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    transition: top 0.15s ease-out;
    z-index: 5;
  }
  
  .chart-loading,
  .chart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .chart-loading :global(.spinning) {
    animation: spin 1s linear infinite;
  }
  
  .chart-empty :global(.empty-icon) {
    opacity: 0.3;
  }
  
  .bottom-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    gap: 12px;
  }
  
  .chart-type-bar {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 16px;
    padding: 4px;
    gap: 4px;
  }
  
  .chart-type-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .chart-type-btn:hover {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .chart-type-btn.active {
    background: rgba(40, 40, 50, 0.9);
    color: white;
  }
  
  .time-range-bar {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 16px;
    padding: 4px;
    gap: 4px;
  }
  
  .time-btn {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .time-btn:hover {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .time-btn.active {
    background: rgba(40, 40, 50, 0.9);
    color: white;
  }
  
  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }
  
  @media (max-width: 480px) {
    .modal-sheet {
      max-height: 90vh;
      padding: 0 12px 20px;
    }
    
    .modal-title {
      font-size: 18px;
    }
    
    .time-btn {
      padding: 8px 14px;
      font-size: 12px;
    }
  }
  
  @media (min-width: 640px) {
    .modal-sheet {
      max-width: 700px;
      width: 700px;
      max-height: 88vh;
    }
    
    .chart-container {
      height: 280px;
    }
    
    .chart-svg {
      width: 800px;
      height: 280px;
    }
    
    .donut-svg {
      width: 220px;
      height: 220px;
    }
    
    .bar-chart-item {
      gap: 16px;
    }
    
    .bar-label {
      max-width: 250px;
    }
  }
  
  @media (min-width: 1024px) {
    .modal-sheet {
      max-width: 850px;
      width: 850px;
      max-height: 90vh;
    }
    
    .chart-container {
      height: 340px;
    }
    
    .chart-svg {
      width: 1000px;
      height: 340px;
    }
    
    .donut-svg {
      width: 260px;
      height: 260px;
    }
    
    .bar-label {
      max-width: 350px;
      font-size: 14px;
    }
    
    .bar-percentage {
      font-size: 16px;
    }
    
    .y-label {
      font-size: 11px;
    }
    
    .value-label {
      font-size: 12px;
      padding: 3px 7px;
    }
  }
</style>
