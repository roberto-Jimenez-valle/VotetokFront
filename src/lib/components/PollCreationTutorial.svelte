<script lang="ts">
  import { fade, fly, scale } from 'svelte/transition';
  import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-svelte';
  import { onMount, tick } from 'svelte';
  
  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
  }
  
  let { isOpen = $bindable(false), onClose }: Props = $props();
  
  let currentStep = $state(0);
  let highlightRect = $state<DOMRect | null>(null);
  let tooltipPosition = $state<'top' | 'bottom' | 'left' | 'right' | 'top-fixed' | 'top-higher'>('bottom');
  let isReady = $state(false);
  
  // Definición de los pasos del tutorial con selectores CSS reales
  const tutorialSteps = [
    {
      id: 'welcome',
      title: '¡Bienvenido al Tutorial!',
      description: 'Te guiaré paso a paso para crear tu primera encuesta. Voy a señalar cada elemento importante.',
      selector: null,
      action: null,
      position: 'center'
    },
    {
      id: 'title',
      title: '1. Escribe tu pregunta',
      description: 'Este es el campo del título. Escribe aquí la pregunta de tu encuesta. Ejemplo: "¿Cuál es tu comida favorita?"',
      selector: '.poll-title-input',
      action: 'Haz clic y escribe tu pregunta',
      position: 'bottom'
    },
    {
      id: 'option-card',
      title: '2. Las tarjetas de opciones',
      description: 'Cada tarjeta representa una opción de respuesta. Los usuarios votarán haciendo clic en ellas.',
      selector: '.option-slide.is-active .poll-option-card, .option-slide:first-child .poll-option-card',
      action: 'Haz clic en la tarjeta para editarla',
      position: 'top'
    },
    {
      id: 'option-textarea',
      title: '3. Escribe en la opción',
      description: 'Escribe el texto de la opción aquí. Puede ser una respuesta corta o una frase.',
      selector: '.option-slide.is-active .option-label-edit, .option-slide:first-child .option-label-edit, .poll-option-card .option-label-edit',
      action: 'Escribe el texto de la respuesta',
      position: 'top-higher'
    },
    {
      id: 'yesno-btn',
      title: '4. Botón Sí/No',
      description: 'Este botón (yin-yang) convierte la opción en dos sub-respuestas: Sí y No. Útil para preguntas de confirmación.',
      selector: '.option-slide.is-active .yesno-btn, .option-slide:first-child .yesno-btn, .edit-buttons .yesno-btn',
      action: 'Pulsa para activar modo Sí/No',
      position: 'left'
    },
    {
      id: 'correct-btn',
      title: '5. Marcar como correcta',
      description: 'Si es un quiz, marca esta opción como la respuesta correcta. Se revelará después de votar.',
      selector: '.option-slide.is-active .correct-btn, .option-slide:first-child .correct-btn, .edit-buttons .correct-btn',
      action: 'Pulsa para marcar como correcta',
      position: 'left'
    },
    {
      id: 'color-btn',
      title: '6. Cambiar color',
      description: 'Personaliza el color de cada opción para hacerla más visual y atractiva.',
      selector: '.option-slide.is-active .color-btn, .option-slide:first-child .color-btn, .edit-buttons .color-btn',
      action: 'Pulsa para abrir el selector de color',
      position: 'left'
    },
    {
      id: 'giphy-btn',
      title: '7. Añadir GIF',
      description: 'Añade GIFs animados de GIPHY para hacer tu encuesta más divertida y visual.',
      selector: '.option-slide.is-active .giphy-btn, .option-slide:first-child .giphy-btn, .edit-buttons .giphy-btn',
      action: 'Pulsa para buscar GIFs',
      position: 'top-fixed'
    },
    {
      id: 'delete-btn',
      title: '8. Eliminar opción',
      description: 'Elimina una opción si no la necesitas. Siempre debes mantener al menos 2 opciones.',
      selector: '.option-slide.is-active .delete-btn, .option-slide:first-child .delete-btn, .edit-buttons .delete-btn',
      action: 'Pulsa para eliminar esta opción',
      position: 'top-fixed'
    },
    {
      id: 'indicators',
      title: '9. Navegación de opciones',
      description: 'Navega entre opciones con estos puntos.',
      selector: '.options-indicators-top, .pagination-dots',
      action: 'Pulsa un punto para cambiar',
      position: 'bottom'
    },
    {
      id: 'poll-type-single',
      title: '10. Tipo: Simple',
      description: 'Cada usuario puede votar UNA sola opción. Es el tipo más común.',
      selector: '.poll-types-inline button:first-child',
      action: 'Icono círculo = voto único',
      position: 'top-fixed'
    },
    {
      id: 'poll-type-multiple',
      title: '11. Tipo: Múltiple',
      description: 'Los usuarios pueden votar VARIAS opciones a la vez.',
      selector: '.poll-types-inline button:nth-child(2)',
      action: 'Icono cuadrado = varios votos',
      position: 'top-fixed'
    },
    {
      id: 'poll-type-collaborative',
      title: '12. Tipo: Colaborativa',
      description: 'Los usuarios pueden AÑADIR sus propias opciones a tu encuesta.',
      selector: '.poll-types-inline button:nth-child(3)',
      action: 'Icono usuarios = todos participan',
      position: 'top-fixed'
    },
    {
      id: 'maximize-btn',
      title: '13. Maximizar tarjeta',
      description: 'Abre la tarjeta en pantalla completa para editar con más detalle.',
      selector: '.maximize-button',
      action: 'Pulsa para expandir',
      position: 'top-fixed'
    },
    {
      id: 'add-option',
      title: '14. Añadir opción',
      description: 'Crea nuevas opciones de respuesta. Máximo 10 opciones por encuesta.',
      selector: '.add-option-floating-bottom',
      action: 'Pulsa + para añadir',
      position: 'top-fixed'
    },
    {
      id: 'publish',
      title: '15. ¡Publicar!',
      description: 'Cuando esté todo listo, publica tu encuesta para que todos voten.',
      selector: '.publish-btn',
      action: 'Pulsa para publicar',
      position: 'bottom'
    },
    {
      id: 'finish',
      title: '¡Tutorial completado! 🎉',
      description: '¡Ya sabes todo! Ahora crea tu primera encuesta.',
      selector: null,
      action: null,
      position: 'center'
    }
  ];
  
  // Buscar elemento y calcular posición
  async function updateHighlight() {
    const step = tutorialSteps[currentStep];
    
    if (!step.selector) {
      highlightRect = null;
      return;
    }
    
    await tick();
    
    // Intentar con cada selector separado por coma
    const selectors = step.selector.split(',').map(s => s.trim());
    let element: Element | null = null;
    
    for (const sel of selectors) {
      element = document.querySelector(sel);
      if (element) break;
    }
    
    if (element) {
      const rect = element.getBoundingClientRect();
      highlightRect = rect;
      tooltipPosition = step.position as any || 'bottom';
      
      // Scroll suave al elemento si está fuera de vista
      const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!isInView) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Recalcular después del scroll
        setTimeout(() => {
          const newRect = element!.getBoundingClientRect();
          highlightRect = newRect;
        }, 300);
      }
    } else {
      highlightRect = null;
    }
  }
  
  function nextStep() {
    if (currentStep < tutorialSteps.length - 1) {
      currentStep++;
      updateHighlight();
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      updateHighlight();
    }
  }
  
  function closeTutorial() {
    isOpen = false;
    currentStep = 0;
    highlightRect = null;
    onClose?.();
  }
  
  function goToStep(index: number) {
    if (index >= 0 && index < tutorialSteps.length) {
      currentStep = index;
      updateHighlight();
    }
  }
  
  // Actualizar highlight cuando cambia el paso o se abre
  $effect(() => {
    if (isOpen) {
      isReady = false;
      currentStep = 0;
      // Dar tiempo al modal de creación a renderizar
      setTimeout(() => {
        isReady = true;
        updateHighlight();
      }, 500);
    }
  });
  
  // Re-calcular en resize
  onMount(() => {
    const handleResize = () => {
      if (isOpen && isReady) {
        updateHighlight();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

{#if isOpen && isReady}
  <!-- Overlay oscuro con agujero para el spotlight -->
  <div class="tutorial-backdrop" transition:fade={{ duration: 200 }}>
    {#if highlightRect}
      <!-- Spotlight/Agujero que deja ver el elemento -->
      <div 
        class="spotlight"
        style="
          top: {highlightRect.top - 8}px;
          left: {highlightRect.left - 8}px;
          width: {highlightRect.width + 16}px;
          height: {highlightRect.height + 16}px;
        "
      >
        <div class="spotlight-pulse"></div>
      </div>
    {/if}
  </div>
  
  <!-- Tooltip flotante -->
  <div 
    class="tutorial-tooltip"
    class:center={!highlightRect}
    class:top-fixed={tooltipPosition === 'top-fixed'}
    class:top-higher={tooltipPosition === 'top-higher'}
    style={highlightRect && tooltipPosition !== 'top-fixed' && tooltipPosition !== 'top-higher' ? `
      top: ${tooltipPosition === 'top' ? highlightRect.top - 160 : 
            tooltipPosition === 'bottom' ? highlightRect.bottom + 20 :
            highlightRect.top + highlightRect.height / 2 - 80}px;
      left: ${tooltipPosition === 'left' ? highlightRect.left - 320 :
             tooltipPosition === 'right' ? highlightRect.right + 20 :
             highlightRect.left + highlightRect.width / 2 - 150}px;
    ` : ''}
    transition:fly={{ y: 20, duration: 300 }}
  >
    <!-- Flecha apuntando al elemento -->
    {#if highlightRect}
      <div class="tooltip-arrow tooltip-arrow-{tooltipPosition}"></div>
    {/if}
    
    <!-- Header del tooltip -->
    <div class="tooltip-header">
      <div class="step-badge">{currentStep + 1}/{tutorialSteps.length}</div>
      <button class="close-btn-small" onclick={closeTutorial} aria-label="Cerrar">
        <X size={18} />
      </button>
    </div>
    
    <!-- Contenido -->
    <div class="tooltip-content">
      <h3 class="tooltip-title">{tutorialSteps[currentStep].title}</h3>
      <p class="tooltip-description">{tutorialSteps[currentStep].description}</p>
      
      {#if tutorialSteps[currentStep].action}
        <div class="tooltip-action">
          <span class="action-icon">👆</span>
          <span>{tutorialSteps[currentStep].action}</span>
        </div>
      {/if}
    </div>
    
    <!-- Progress dots -->
    <div class="tooltip-dots">
      {#each tutorialSteps as _, i}
        <button 
          class="dot"
          class:active={i === currentStep}
          class:completed={i < currentStep}
          onclick={() => goToStep(i)}
          aria-label="Ir al paso {i + 1}"
        ></button>
      {/each}
    </div>
    
    <!-- Navegación -->
    <div class="tooltip-nav">
      <button 
        class="nav-btn prev" 
        onclick={prevStep}
        disabled={currentStep === 0}
      >
        <ChevronLeft size={18} />
        Anterior
      </button>
      
      {#if currentStep === tutorialSteps.length - 1}
        <button class="nav-btn finish" onclick={closeTutorial}>
          <Sparkles size={18} />
          ¡Listo!
        </button>
      {:else}
        <button class="nav-btn next" onclick={nextStep}>
          Siguiente
          <ChevronRight size={18} />
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Backdrop oscuro con agujero transparente - menos oscuro */
  .tutorial-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99998;
    background: rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  
  /* Spotlight que resalta el elemento */
  .spotlight {
    position: fixed;
    border-radius: 12px;
    box-shadow: 
      0 0 0 9999px rgba(0, 0, 0, 0.5),
      0 0 20px 4px rgba(139, 92, 246, 0.6);
    z-index: 99999;
    pointer-events: none;
    transition: all 0.3s ease;
  }
  
  .spotlight-pulse {
    position: absolute;
    inset: -4px;
    border: 2px solid rgba(139, 92, 246, 0.8);
    border-radius: 14px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { 
      opacity: 1;
      transform: scale(1);
    }
    50% { 
      opacity: 0.5;
      transform: scale(1.05);
    }
  }
  
  /* Tooltip flotante */
  .tutorial-tooltip {
    position: fixed;
    z-index: 100000;
    width: 300px;
    background: linear-gradient(180deg, #1e1e2e 0%, #151520 100%);
    border-radius: 16px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    box-shadow: 
      0 20px 40px rgba(0, 0, 0, 0.5),
      0 0 30px rgba(139, 92, 246, 0.2);
    overflow: hidden;
    pointer-events: auto;
  }
  
  .tutorial-tooltip.center {
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%);
  }
  
  .tutorial-tooltip.top-fixed {
    top: 80px !important;
    bottom: auto !important;
    left: 50% !important;
    transform: translateX(-50%);
  }
  
  .tutorial-tooltip.top-higher {
    top: 50px !important;
    bottom: auto !important;
    left: 50% !important;
    transform: translateX(-50%);
  }
  
  /* Flechas del tooltip */
  .tooltip-arrow {
    position: absolute;
    width: 16px;
    height: 16px;
    background: #1e1e2e;
    border: 1px solid rgba(139, 92, 246, 0.3);
    transform: rotate(45deg);
  }
  
  .tooltip-arrow-top {
    bottom: -9px;
    left: 50%;
    margin-left: -8px;
    border-top: none;
    border-left: none;
  }
  
  .tooltip-arrow-bottom {
    top: -9px;
    left: 50%;
    margin-left: -8px;
    border-bottom: none;
    border-right: none;
  }
  
  .tooltip-arrow-left {
    right: -9px;
    top: 50%;
    margin-top: -8px;
    border-left: none;
    border-bottom: none;
  }
  
  .tooltip-arrow-right {
    left: -9px;
    top: 50%;
    margin-top: -8px;
    border-right: none;
    border-top: none;
  }
  
  /* Header del tooltip */
  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(139, 92, 246, 0.1);
  }
  
  .step-badge {
    font-size: 12px;
    font-weight: 700;
    color: #a78bfa;
    background: rgba(139, 92, 246, 0.2);
    padding: 4px 10px;
    border-radius: 20px;
  }
  
  .close-btn-small {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .close-btn-small:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  /* Contenido del tooltip */
  .tooltip-content {
    padding: 16px;
  }
  
  .tooltip-title {
    font-size: 16px;
    font-weight: 700;
    color: white;
    margin: 0 0 8px 0;
    line-height: 1.3;
  }
  
  .tooltip-description {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    line-height: 1.5;
  }
  
  .tooltip-action {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 8px;
    font-size: 12px;
    color: #10b981;
    font-weight: 600;
  }
  
  .action-icon {
    font-size: 14px;
  }
  
  /* Dots de progreso */
  .tooltip-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
  }
  
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: all 0.2s;
  }
  
  .dot:hover {
    background: rgba(255, 255, 255, 0.4);
  }
  
  .dot.active {
    width: 16px;
    border-radius: 3px;
    background: linear-gradient(90deg, #8b5cf6, #3b82f6);
  }
  
  .dot.completed {
    background: #8b5cf6;
  }
  
  /* Navegación del tooltip */
  .tooltip-nav {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
  }
  
  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    flex: 1;
  }
  
  .nav-btn.prev {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    flex: 0.8;
  }
  
  .nav-btn.prev:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .nav-btn.prev:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .nav-btn.next {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
  }
  
  .nav-btn.next:hover {
    background: linear-gradient(135deg, #9333ea, #8b5cf6);
    transform: translateY(-1px);
  }
  
  .nav-btn.finish {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }
  
  .nav-btn.finish:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-1px);
  }
  
  /* Responsive */
  @media (max-width: 480px) {
    .tutorial-tooltip {
      width: calc(100% - 24px);
      max-width: 280px;
      position: fixed !important;
      bottom: 16px !important;
      top: auto !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }
    
    .tutorial-tooltip.center {
      bottom: auto !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
    }
    
    .tutorial-tooltip.top-fixed {
      top: 60px !important;
      bottom: auto !important;
      transform: translateX(-50%) !important;
    }
    
    .tutorial-tooltip.top-higher {
      top: 40px !important;
      bottom: auto !important;
      transform: translateX(-50%) !important;
    }
    
    .tooltip-arrow {
      display: none;
    }
    
    .tooltip-header {
      padding: 8px 12px;
    }
    
    .step-badge {
      font-size: 10px;
      padding: 3px 8px;
    }
    
    .tooltip-content {
      padding: 10px 12px;
    }
    
    .tooltip-title {
      font-size: 14px;
      margin-bottom: 4px;
    }
    
    .tooltip-description {
      font-size: 11px;
      line-height: 1.4;
    }
    
    .tooltip-action {
      padding: 6px 10px;
      margin-top: 8px;
      font-size: 10px;
    }
    
    .tooltip-dots {
      padding: 6px 12px;
      gap: 4px;
    }
    
    .dot {
      width: 5px;
      height: 5px;
    }
    
    .dot.active {
      width: 12px;
    }
    
    .tooltip-nav {
      padding: 8px 12px;
      gap: 6px;
    }
    
    .nav-btn {
      padding: 8px 12px;
      font-size: 12px;
    }
    
    .close-btn-small {
      width: 24px;
      height: 24px;
    }
  }
</style>
