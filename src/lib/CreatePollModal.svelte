<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X, Plus, Trash2, Image as ImageIcon, Hash, Palette } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '$lib/stores';
  
  const dispatch = createEventDispatcher();
  
  interface Props {
    isOpen?: boolean;
    buttonColors?: string[];
  }
  
  let { isOpen = $bindable(false), buttonColors = [] }: Props = $props();
  
  // Form state
  let title = '';
  let description = '';
  let category = '';
  let imageUrl = '';
  let imageFile: File | null = null;
  let imagePreview: string | null = null;
  
  // Paleta organizada por tonos
  const COLOR_PALETTE = {
    rojos: ['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#fca5a5', '#f43f5e', '#e11d48', '#be123c', '#fb7185', '#fda4af'],
    naranjas: ['#f97316', '#ea580c', '#c2410c', '#fb923c', '#fdba74', '#ff6b35', '#ff8c42', '#ffa552', '#ffb562', '#ffc672'],
    amarillos: ['#f59e0b', '#d97706', '#b45309', '#fbbf24', '#fcd34d', '#eab308', '#ca8a04', '#a16207', '#facc15', '#fde047'],
    verdes: ['#10b981', '#059669', '#047857', '#34d399', '#6ee7b7', '#22c55e', '#16a34a', '#15803d', '#4ade80', '#86efac'],
    azules: ['#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd', '#0ea5e9', '#0284c7', '#0369a1', '#38bdf8', '#7dd3fc'],
    morados: ['#8b5cf6', '#7c3aed', '#6d28d9', '#a78bfa', '#c4b5fd', '#a855f7', '#9333ea', '#7e22ce', '#c084fc', '#d8b4fe'],
    rosas: ['#ec4899', '#db2777', '#be185d', '#f472b6', '#f9a8d4', '#e879f9', '#d946ef', '#c026d3', '#f0abfc', '#f5d0fe'],
    teales: ['#14b8a6', '#0d9488', '#0f766e', '#2dd4bf', '#5eead4', '#06b6d4', '#0891b2', '#0e7490', '#22d3ee', '#67e8f9'],
  };
  
  const COLORS = [
    ...COLOR_PALETTE.rojos,
    ...COLOR_PALETTE.naranjas,
    ...COLOR_PALETTE.amarillos,
    ...COLOR_PALETTE.verdes,
    ...COLOR_PALETTE.azules,
    ...COLOR_PALETTE.morados,
    ...COLOR_PALETTE.rosas,
    ...COLOR_PALETTE.teales,
  ];
  
  // Categorías disponibles
  const CATEGORIES = [
    'Política', 'Deportes', 'Entretenimiento', 'Tecnología', 'Ciencia',
    'Cultura', 'Economía', 'Salud', 'Educación', 'Medio Ambiente', 'Otro'
  ];
  
  type PollOption = {
    id: string;
    label: string;
    color: string;
  };
  
  type PollType = 'single' | 'multiple' | 'rating' | 'reactions' | 'collaborative';
  
  let options: PollOption[] = $state([
    { id: '1', label: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] },
    { id: '2', label: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] }
  ]);
  
  let previousIsOpen = $state(false);
  
  // Actualizar colores solo cuando el modal se abre por primera vez
  $effect(() => {
    if (isOpen && !previousIsOpen && buttonColors && buttonColors.length >= 2) {
      // Solo actualizar colores, no recrear el array completo
      if (options[0]) options[0].color = buttonColors[0];
      if (options[1]) options[1].color = buttonColors[1];
    }
    previousIsOpen = isOpen;
  });
  
  let pollType: PollType = 'single';
  let hashtags = '';
  let location = '';
  let duration = '7d'; // 1d, 3d, 7d, 30d, never
  
  // Opciones específicas por tipo
  let ratingCount = 5; // Para tipo 'rating'
  let ratingIcon = '🔥'; // Icono para rating (fuego por defecto)
  let collaborativePermission = 'anyone'; // 'anyone', 'friends', 'specific'
  let specificFriend = ''; // Para cuando se selecciona 'specific'
  
  // Iconos disponibles para rating
  const RATING_ICONS = [
    { icon: '⭐', label: 'Estrella' },
    { icon: '🔥', label: 'Fuego' },
    { icon: '❤️', label: 'Corazón' },
    { icon: '👍', label: 'Me gusta' },
    { icon: '🎉', label: 'Fiesta' },
    { icon: '💡', label: 'Idea' },
    { icon: '⚡', label: 'Rayo' },
    { icon: '🏆', label: 'Trofeo' }
  ];
  
  const POLL_TYPES = [
    { id: 'single', label: 'Única', icon: 'circle' },
    { id: 'multiple', label: 'Múltiple', icon: 'check-square' },
    { id: 'rating', label: 'Rating', icon: 'star' },
    { id: 'reactions', label: 'Reacciones', icon: 'smile' },
    { id: 'collaborative', label: 'Colaborativa', icon: 'users' }
  ] as const;
  
  const DURATIONS = [
    { value: '1d', label: '1 día' },
    { value: '3d', label: '3 días' },
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
    { value: 'never', label: 'Sin límite' }
  ];
  
  let errors: Record<string, string> = {};
  let isSubmitting = false;
  let showTypeOptionsModal = $state(false);
  let activeAccordionIndex: number | null = 0;
  let currentPage = 0;
  
  // Variables para swipe táctil
  let touchStartX = 0;
  let touchStartY = 0;
  let isDragging = false;
  let gridRef: HTMLElement | null = null;
  
  // Referencias a los inputs de texto de cada opción
  let optionInputs: Record<string, HTMLTextAreaElement> = {};
  
  // Estado del color picker
  let colorPickerOpenFor = $state<string | null>(null);
  let selectedHue = $state(0);
  let selectedSaturation = $state(85);
  let isDraggingColor = $state(false);
  
  let selectedColor = $derived(`hsl(${selectedHue}, ${selectedSaturation}%, 55%)`);
  
  // Paginación - máximo 4 opciones por página como en BottomSheet
  const ITEMS_PER_PAGE = 4;
  
  let totalPages = $derived(Math.ceil(options.length / ITEMS_PER_PAGE));
  let paginatedOptions = $derived({
    items: options.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE),
    totalPages: totalPages,
    hasNext: currentPage < totalPages - 1,
    hasPrev: currentPage > 0
  });
  
  // Función para cambiar acordeón activo
  function setActive(index: number) {
    const wasAlreadyActive = activeAccordionIndex === index;
    
    // Si se hace click en la ya activa, también enfocar si está vacía
    // Si se hace click en otra, cambiar
    if (!wasAlreadyActive) {
      activeAccordionIndex = index;
    }
    
    // Enfocar el input si la opción está vacía (tanto al cambiar como al hacer click en la activa)
    setTimeout(() => {
      const option = paginatedOptions.items[index];
      if (option && !option.label.trim()) {
        const input = optionInputs[option.id];
        if (input) {
          input.focus();
        }
      }
    }, wasAlreadyActive ? 0 : 100);
  }
  
  // Función para calcular font size basado en porcentaje (exacta del BottomSheet)
  function fontSizeForPct(pct: number): number {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const bucket = Math.max(1, Math.ceil(clamped / 10));
    const size = bucket * 10;
    return Math.max(20, Math.min(70, size));
  }
  
  // Añadir nueva opción
  function addOption() {
    if (options.length >= 10) return;
    
    const newId = String(Date.now());
    const randomColorIndex = Math.floor(Math.random() * COLORS.length);
    
    options = [...options, {
      id: newId,
      label: '',
      color: COLORS[randomColorIndex]
    }];
    
    // Ir a la última página
    const newPage = Math.ceil(options.length / ITEMS_PER_PAGE) - 1;
    currentPage = newPage;
    // Activar la nueva opción (última de la página)
    const itemsInPage = options.slice(newPage * ITEMS_PER_PAGE, (newPage + 1) * ITEMS_PER_PAGE).length;
    activeAccordionIndex = itemsInPage - 1;
    
    // Enfocar el input de la nueva opción
    setTimeout(() => {
      const input = optionInputs[newId];
      if (input) {
        input.focus();
      }
    }, 150);
  }
  
  // Generar opciones automáticamente para rating
  function generateRatingOptions() {
    const newOptions: PollOption[] = [];
    for (let i = 1; i <= ratingCount; i++) {
      const icons = ratingIcon.repeat(i);
      newOptions.push({
        id: String(Date.now() + i),
        label: `${icons} (${i}/${ratingCount})`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
    options = newOptions;
    currentPage = 0;
    activeAccordionIndex = 0;
  }
  
  // Aplicar configuración del tipo de encuesta
  function applyTypeConfiguration() {
    if (pollType === 'rating') {
      generateRatingOptions();
    }
    showTypeOptionsModal = false;
  }
  
  // Eliminar opción
  function removeOption(id: string) {
    if (options.length <= 1) return;
    
    // Encontrar el índice de la opción que se va a eliminar
    const optionIndex = options.findIndex(opt => opt.id === id);
    if (optionIndex === -1) return;
    
    // Calcular en qué página está la opción
    const optionPage = Math.floor(optionIndex / ITEMS_PER_PAGE);
    const optionIndexInPage = optionIndex % ITEMS_PER_PAGE;
    
    // Verificar si es la última opción de la página actual
    const isLastInPage = optionIndexInPage === paginatedOptions.items.length - 1;
    const isCurrentlyActive = activeAccordionIndex === optionIndexInPage && currentPage === optionPage;
    
    // Eliminar la opción
    options = options.filter(opt => opt.id !== id);
    
    // Si era la última de la página y estaba activa, ir a la anterior
    if (isLastInPage && isCurrentlyActive) {
      const newTotalPages = Math.ceil(options.length / ITEMS_PER_PAGE);
      
      if (optionIndexInPage === 0 && currentPage > 0) {
        // Era la única en la página, ir a la última de la página anterior
        currentPage -= 1;
        const itemsInPreviousPage = Math.min(ITEMS_PER_PAGE, options.length - (currentPage * ITEMS_PER_PAGE));
        activeAccordionIndex = itemsInPreviousPage - 1;
      } else if (optionIndexInPage > 0) {
        // Ir a la anterior en la misma página
        activeAccordionIndex = optionIndexInPage - 1;
      } else if (currentPage >= newTotalPages && newTotalPages > 0) {
        // La página actual ya no existe, ir a la última página
        currentPage = newTotalPages - 1;
        const itemsInLastPage = options.length % ITEMS_PER_PAGE || ITEMS_PER_PAGE;
        activeAccordionIndex = itemsInLastPage - 1;
      }
    } else if (isCurrentlyActive && activeAccordionIndex !== null && activeAccordionIndex >= paginatedOptions.items.length - 1) {
      // Ajustar el índice si ahora está fuera de rango
      activeAccordionIndex = Math.max(0, paginatedOptions.items.length - 2);
    }
  }
  
  // Handle image file selection
  async function handleImageSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      errors.image = 'Por favor selecciona una imagen válida';
      return;
    }
    
    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      errors.image = 'La imagen debe pesar menos de 5MB';
      return;
    }
    
    imageFile = file;
    errors.image = '';
    
    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
  
  // Validar formulario
  function validate(): boolean {
    errors = {};
    
    if (!title.trim()) {
      errors.title = 'El título es obligatorio';
    } else if (title.trim().length < 10) {
      errors.title = 'El título debe tener al menos 10 caracteres';
    } else if (title.trim().length > 200) {
      errors.title = 'El título no puede superar 200 caracteres';
    }
    
    if (description && description.length > 500) {
      errors.description = 'La descripción no puede superar 500 caracteres';
    }
    
    // Validar opciones (solo las que tienen contenido)
    const validOptions = options.filter(opt => opt.label.trim());
    
    if (validOptions.length < 2) {
      errors.options = 'Debes añadir al menos 2 opciones';
    }
    
    // Validar longitud de cada opción válida
    validOptions.forEach((opt) => {
      if (opt.label.trim().length > 200) {
        errors[`option_${opt.id}`] = 'Máximo 200 caracteres';
      }
    });
    
    // Verificar opciones duplicadas
    const labels = validOptions.map(opt => opt.label.trim().toLowerCase());
    const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (duplicates.length > 0) {
      errors.options = 'No puedes tener opciones duplicadas';
    }
    
    return Object.keys(errors).length === 0;
  }
  
  // Submit del formulario
  async function handleSubmit() {
    console.log('🚀 Intentando crear encuesta...');
    console.log('Título:', title);
    console.log('Opciones:', options);
    
    if (!validate()) {
      console.error('❌ Validación fallida:', errors);
      return;
    }
    
    console.log('✅ Validación pasada');
    isSubmitting = true;
    
    try {
      // Filtrar opciones vacías
      const validOptions = options.filter(opt => opt.label.trim());
      
      // Preparar datos para enviar
      const pollData = {
        userId: $currentUser?.id || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category,
        type: pollType,
        imageUrl: imageUrl || undefined,
        duration: duration,
        hashtags: hashtags.split(' ').filter(h => h.startsWith('#')).map(h => h.substring(1)),
        location: location || undefined,
        options: validOptions.map((opt, index) => ({
          optionKey: opt.id,
          optionLabel: opt.label.trim(),
          color: opt.color,
          displayOrder: index
        })),
        // Opciones específicas por tipo
        settings: {
          ratingIcon: pollType === 'rating' ? ratingIcon : undefined,
          ratingCount: pollType === 'rating' ? ratingCount : undefined,
          collaborativePermission: pollType === 'collaborative' ? collaborativePermission : undefined,
          specificFriend: pollType === 'collaborative' && collaborativePermission === 'specific' ? specificFriend : undefined
        }
      };
      
      // Si hay imagen de archivo, subirla primero
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const uploadResponse = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData
        });
        
        if (uploadResponse.ok) {
          const { url } = await uploadResponse.json();
          pollData.imageUrl = url;
        }
      }
      
      // Crear la encuesta
      console.log('📤 Enviando datos al servidor:', pollData);
      
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pollData)
      });
      
      console.log('📥 Respuesta del servidor:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error del servidor:', error);
        throw new Error(error.message || 'Error al crear la encuesta');
      }
      
      const result = await response.json();
      console.log('✅ Encuesta creada exitosamente:', result);
      
      // Emitir evento de éxito
      dispatch('created', result.data);
      
      // Limpiar y cerrar
      resetForm();
      close();
      
    } catch (error: any) {
      console.error('Error creating poll:', error);
      errors.submit = error.message || 'Error al crear la encuesta. Inténtalo de nuevo.';
    } finally {
      isSubmitting = false;
    }
  }
  
  // Cerrar modal
  function close() {
    if (isSubmitting) return;
    // Limpiar estados de modales secundarios
    colorPickerOpenFor = null;
    showTypeOptionsModal = false;
    isOpen = false;
  }
  
  // Reset del formulario
  function resetForm() {
    title = '';
    description = '';
    category = '';
    imageUrl = '';
    imageFile = null;
    imagePreview = null;
    pollType = 'single';
    hashtags = '';
    location = '';
    duration = '7d';
    options = [
      { id: '1', label: '', color: COLORS[0] },
      { id: '2', label: '', color: COLORS[1] }
    ];
    errors = {};
    // Limpiar estados de modales secundarios
    colorPickerOpenFor = null;
    showTypeOptionsModal = false;
  }
  
  // Cerrar al presionar Escape
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isSubmitting) {
      close();
    }
  }
  
  // Funciones para manejo de swipe táctil
  function handleTouchStart(e: TouchEvent) {
    // No procesar si el touch empieza en un textarea, input o botón
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
      isDragging = false;
      return;
    }
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = false;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!gridRef) return;
    
    // No procesar si el touch está en un textarea, input o botón
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // Detectar si es movimiento horizontal (más horizontal que vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      isDragging = true;
      e.preventDefault();
      
      const currentIndex = activeAccordionIndex;
      const totalCards = paginatedOptions.items.length;
      
      if (deltaX > 50) {
        if (currentIndex !== null && currentIndex > 0) {
          // Swipe derecha -> card anterior
          const newIndex = currentIndex - 1;
          activeAccordionIndex = newIndex;
          touchStartX = touch.clientX; // Reset para siguiente detección
          
          // Enfocar el input si la opción está vacía
          setTimeout(() => {
            const option = paginatedOptions.items[newIndex];
            if (option && !option.label.trim()) {
              const input = optionInputs[option.id];
              if (input) {
                input.focus();
              }
            }
          }, 100);
        } else if (currentIndex === 0 && currentPage > 0) {
          // Swipe derecho desde primera card -> página anterior
          currentPage -= 1;
          activeAccordionIndex = ITEMS_PER_PAGE - 1;
          touchStartX = touch.clientX; // Reset para siguiente detección
        }
      } else if (deltaX < -50) {
        if (currentIndex !== null && currentIndex < totalCards - 1) {
          // Swipe izquierda -> card siguiente
          const newIndex = currentIndex + 1;
          activeAccordionIndex = newIndex;
          touchStartX = touch.clientX; // Reset para siguiente detección
          
          // Enfocar el input si la opción está vacía
          setTimeout(() => {
            const option = paginatedOptions.items[newIndex];
            if (option && !option.label.trim()) {
              const input = optionInputs[option.id];
              if (input) {
                input.focus();
              }
            }
          }, 100);
        } else if (currentIndex === totalCards - 1 && currentPage < totalPages - 1) {
          // Swipe izquierdo desde última card -> página siguiente
          currentPage += 1;
          activeAccordionIndex = 0;
          touchStartX = touch.clientX; // Reset para siguiente detección
        } else if (currentIndex === totalCards - 1 && currentPage === totalPages - 1) {
          // Swipe izquierdo desde la última card de la última página -> crear nueva opción
          if (options.length < 10) {
            touchStartX = touch.clientX; // Reset para siguiente detección
            addOption();
            // Dar tiempo para que se cree la opción antes de activarla
            setTimeout(() => {
              // Calcular si la nueva opción estará en una nueva página
              const newTotalOptions = options.length;
              const newTotalPages = Math.ceil(newTotalOptions / ITEMS_PER_PAGE);
              const newOptionPage = Math.floor((newTotalOptions - 1) / ITEMS_PER_PAGE);
              const newOptionIndexInPage = (newTotalOptions - 1) % ITEMS_PER_PAGE;
              
              currentPage = newOptionPage;
              activeAccordionIndex = newOptionIndexInPage;
              
              // Enfocar el input de la nueva opción
              setTimeout(() => {
                const newOption = options[options.length - 1];
                if (newOption) {
                  const input = optionInputs[newOption.id];
                  if (input) {
                    input.focus();
                  }
                }
              }, 100);
            }, 50);
          }
        }
      }
    }
    // Si es más vertical o ambiguo, dejar que el scroll funcione normalmente
  }
  
  function handleTouchEnd() {
    isDragging = false;
  }
  
  // Swipe handlers para cerrar modales secundarios
  let modalTouchStartY = 0;
  
  function handleModalSwipeStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }
  
  function handleModalSwipeMove(e: TouchEvent, closeCallback: () => void) {
    const deltaY = e.touches[0].clientY - modalTouchStartY;
    
    // Swipe hacia abajo > 100px para cerrar
    if (deltaY > 100) {
      closeCallback();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- Overlay -->
  <div 
    class="modal-overlay"
    transition:fade={{ duration: 200 }}
    onclick={close}
    role="presentation"
  ></div>
  
  <!-- Modal Container -->
  <div 
    class="modal-container"
    transition:fly={{ y: '100%', duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={(e) => handleModalSwipeMove(e, close)}
  >
    <!-- Header -->
    <div class="modal-header">
      <button
        class="close-btn"
        onclick={close}
        disabled={isSubmitting}
        aria-label="Cerrar"
      >
        <X class="w-5 h-5" />
      </button>
      <h2 id="modal-title">Nueva encuesta</h2>
      <button
        class="publish-btn"
        onclick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Publicando...' : 'Publicar'}
      </button>
    </div>
    
    <!-- Errores generales -->
    {#if errors.title || errors.options || errors.submit}
      <div class="error-banner">
        {#if errors.title}
          <p>❌ {errors.title}</p>
        {/if}
        {#if errors.options}
          <p>❌ {errors.options}</p>
        {/if}
        {#if errors.submit}
          <p>❌ {errors.submit}</p>
        {/if}
      </div>
    {/if}
    
    <!-- Content -->
    <div class="modal-content">
      <!-- Card principal -->
      <div class="main-card">
        <!-- Título de la encuesta -->
        <div class="poll-title-section">
          <textarea
            class="poll-title-input"
            class:error={errors.title}
            placeholder="¿Cuál es tu pregunta?"
            bind:value={title}
            rows="2"
            maxlength="200"
          ></textarea>
        </div>
        
        <!-- Grid de opciones con botón añadir integrado -->
        <div class="vote-cards-container">
          <div 
            class="vote-cards-grid accordion fullwidth {activeAccordionIndex != null ? 'open' : ''}"
            style="--items: {paginatedOptions.items.length}"
            bind:this={gridRef}
            ontouchstart={handleTouchStart}
            ontouchmove={handleTouchMove}
            ontouchend={handleTouchEnd}
          >
            {#each paginatedOptions.items as option, index (option.id)}
              {@const globalIndex = currentPage * ITEMS_PER_PAGE + index}
              {@const pct = Math.round(100 / options.length)}
              <div 
                class="vote-card {activeAccordionIndex === index ? 'is-active' : ''} {activeAccordionIndex !== index ? 'collapsed' : ''}" 
                style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, pct))}%; --fill-pct-val: {Math.max(0, Math.min(100, pct))}; --flex: {Math.max(0.5, pct / 10)};" 
                onclick={() => setActive(index)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(index); }}}
              >
                <div class="card-header">
                  {#if activeAccordionIndex === index}
                    <div class="char-counter">{option.label.length}/200</div>
                  {/if}
                  <textarea
                    class="question-title editable"
                    class:rating-emoji={pollType === 'rating' && /^[\p{Emoji}\s]+$/u.test(option.label || '')}
                    placeholder="Opción {globalIndex + 1}"
                    bind:value={option.label}
                    bind:this={optionInputs[option.id]}
                    maxlength="200"
                    onclick={(e) => e.stopPropagation()}
                  ></textarea>
                </div>
                <div class="card-content">
                  <div class="percentage-display {activeAccordionIndex === index ? 'is-active' : ''}">
                    <span
                      class="percentage-large"
                      style="font-size: {(activeAccordionIndex === index
                        ? fontSizeForPct(pct)
                        : Math.min(fontSizeForPct(pct), 21))}px"
                    >
                      {Math.round(pct)}
                    </span>
                  </div>
                </div>
                {#if globalIndex > 0}
                  <button
                    class="remove-option-badge"
                    onclick={(e) => {
                      e.stopPropagation();
                      removeOption(option.id);
                    }}
                    title="Eliminar"
                    type="button"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                {/if}
                <button
                  class="color-picker-badge-absolute"
                  style="background-color: {option.color}"
                  onclick={(e) => {
                    e.stopPropagation();
                    colorPickerOpenFor = option.id;
                  }}
                  title="Cambiar color"
                  aria-label="Cambiar color"
                  type="button"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </button>
              </div>
            {/each}
          </div>
          
          <!-- Botón añadir opción a la derecha -->
          {#if options.length < 10}
            <button
              type="button"
              class="add-option-button-inline"
              onclick={addOption}
              title="Añadir opción"
            >
              <Plus class="w-5 h-5" />
            </button>
          {/if}
        </div>
        
        <!-- Indicadores de paginación -->
        {#if totalPages > 1}
          <div class="pagination-dots">
            {#each Array(totalPages) as _, pageIndex}
              <button 
                class="pagination-dot {pageIndex === currentPage ? 'active' : ''}"
                onclick={() => {
                  currentPage = pageIndex;
                  activeAccordionIndex = 0;
                }}
                type="button"
                aria-label="Página {pageIndex + 1}"
              ></button>
            {/each}
          </div>
        {/if}
        
        <!-- Info adicional -->
        {#if title.length > 0 || options.some(o => o.label.trim())}
          <div class="poll-info">
            <div class="info-item">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{options.filter(o => o.label.trim()).length} opciones</span>
            </div>
            <div class="info-item">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <select class="duration-select-inline" bind:value={duration}>
                {#each DURATIONS as dur}
                  <option value={dur.value}>{dur.label}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}
        
        
        <!-- Footer con tipos de encuesta -->
        <div class="modal-footer">
          <div class="footer-header">
            <span class="footer-label">Tipo de votación:</span>
            <span class="footer-selected">{POLL_TYPES.find(t => t.id === pollType)?.label}</span>
          </div>
          <div class="poll-types-grid">
            {#each POLL_TYPES as type}
              <button
                type="button"
                class="poll-type-btn"
                class:active={pollType === type.id}
                onclick={() => {
                  pollType = type.id;
                  showTypeOptionsModal = true;
                }}
                aria-label="Seleccionar tipo de encuesta: {type.label}"
                aria-pressed={pollType === type.id}
              >
                {#if type.icon === 'circle'}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                  </svg>
                {:else if type.icon === 'check-square'}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"/>
                  </svg>
                {:else if type.icon === 'star'}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                {:else if type.icon === 'smile'}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                {:else if type.icon === 'users'}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                {/if}
                {#if pollType === type.id}
                  <div class="active-indicator" transition:fade={{ duration: 150 }}></div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Error general -->
      {#if errors.submit}
        <div class="error-banner">
          {errors.submit}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Modal del selector de color -->
{#if colorPickerOpenFor}
  <div 
    class="color-picker-overlay" 
    onclick={() => colorPickerOpenFor = null}
    onkeydown={(e) => { if (e.key === 'Escape') colorPickerOpenFor = null; }}
    ontouchstart={handleModalSwipeStart}
    ontouchmove={(e) => handleModalSwipeMove(e, () => colorPickerOpenFor = null)}
    role="button"
    tabindex="0"
    aria-label="Cerrar selector de color"
    style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 150000; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px);"
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
          <X class="w-5 h-5" />
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
            const optionIndex = options.findIndex(o => o.id === colorPickerOpenFor);
            if (optionIndex !== -1) {
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
              
              options[optionIndex].color = hexColor;
              options = [...options];
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

<!-- Bottom Sheet para opciones de tipo de encuesta -->
{#if showTypeOptionsModal}
  <div 
    class="type-options-overlay" 
    onclick={() => showTypeOptionsModal = false}
    role="presentation"
    transition:fade={{ duration: 200 }}
  ></div>
  <div 
    class="type-options-sheet"
    transition:fly={{ y: '100%', duration: 300 }}
    role="dialog"
    aria-modal="true"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={(e) => handleModalSwipeMove(e, () => showTypeOptionsModal = false)}
  >
    <div class="sheet-handle"></div>
    
    <div class="sheet-header">
      <h3>Opciones de {POLL_TYPES.find(t => t.id === pollType)?.label}</h3>
      <button 
        class="sheet-close-btn" 
        onclick={() => showTypeOptionsModal = false}
        aria-label="Cerrar"
      >
        <X class="w-5 h-5" />
      </button>
    </div>
    
    <div class="sheet-content">
      {#if pollType === 'single'}
        <div class="sheet-info-card">
          <div class="info-icon">⭕</div>
          <h4>Votación Única</h4>
          <p>Los usuarios solo podrán seleccionar una opción de las disponibles. Es el tipo de encuesta más común y sencillo.</p>
        </div>
      {:else if pollType === 'multiple'}
        <div class="sheet-info-card">
          <div class="info-icon">☑️</div>
          <h4>Votación Múltiple</h4>
          <p>Los usuarios podrán seleccionar varias opciones a la vez. Ideal para preguntas donde se pueden elegir múltiples respuestas.</p>
        </div>
      {:else if pollType === 'rating'}
        <div class="sheet-config-section">
          <h4>Configuración del Rating</h4>
          <p class="section-description">Selecciona el icono y la cantidad de niveles para tu sistema de calificación.</p>
          
          <div class="config-row">
            <label class="config-label" for="rating-count-select">Cantidad de niveles</label>
            <select id="rating-count-select" class="sheet-option-select" bind:value={ratingCount}>
              <option value={3}>3 niveles</option>
              <option value={5}>5 niveles</option>
              <option value={7}>7 niveles</option>
              <option value={10}>10 niveles</option>
            </select>
          </div>
          
          <div class="config-row">
            <span class="config-label" role="heading" aria-level="4">Icono</span>
            <div class="icon-grid">
              {#each RATING_ICONS as iconOption}
                <button 
                  type="button"
                  class="icon-option"
                  class:active={ratingIcon === iconOption.icon}
                  onclick={() => ratingIcon = iconOption.icon}
                  title={iconOption.label}
                >
                  <span class="icon-emoji">{iconOption.icon}</span>
                  <span class="icon-label">{iconOption.label}</span>
                </button>
              {/each}
            </div>
          </div>
          
          <div class="preview-section">
            <span class="config-label" role="heading" aria-level="4">Vista previa</span>
            <div class="rating-preview">
              {#each Array(ratingCount) as _, i}
                <span class="preview-level">{ratingIcon.repeat(i + 1)}</span>
              {/each}
            </div>
          </div>
        </div>
      {:else if pollType === 'reactions'}
        <div class="sheet-info-card">
          <div class="info-icon">😊</div>
          <h4>Reacciones</h4>
          <p>Los usuarios podrán reaccionar con cualquier emoji a cada opción. Perfecto para obtener feedback emocional rápido.</p>
        </div>
      {:else if pollType === 'collaborative'}
        <div class="sheet-config-section">
          <h4>Configuración Colaborativa</h4>
          <p class="section-description">Los usuarios podrán añadir nuevas opciones a tu encuesta.</p>
          
          <div class="config-row">
            <span class="config-label" role="heading" aria-level="4">¿Quién puede añadir opciones?</span>
            <div class="permission-options" role="radiogroup">
              <label class="permission-option">
                <input type="radio" name="permission" value="anyone" bind:group={collaborativePermission} />
                <div class="permission-content">
                  <span class="permission-title">🌍 Cualquiera</span>
                  <span class="permission-desc">Todos los usuarios pueden añadir opciones</span>
                </div>
              </label>
              
              <label class="permission-option">
                <input type="radio" name="permission" value="friends" bind:group={collaborativePermission} />
                <div class="permission-content">
                  <span class="permission-title">👥 Solo amigos</span>
                  <span class="permission-desc">Solo tus amigos pueden añadir opciones</span>
                </div>
              </label>
              
              <label class="permission-option">
                <input type="radio" name="permission" value="specific" bind:group={collaborativePermission} />
                <div class="permission-content">
                  <span class="permission-title">👤 Amigo específico</span>
                  <span class="permission-desc">Solo un amigo elegido puede añadir opciones</span>
                </div>
              </label>
            </div>
          </div>
          
          {#if collaborativePermission === 'specific'}
            <div class="config-row">
              <label class="config-label" for="specific-friend-input">Nombre del amigo</label>
              <input 
                id="specific-friend-input"
                type="text" 
                class="sheet-text-input" 
                placeholder="Escribe el nombre de tu amigo"
                bind:value={specificFriend}
              />
            </div>
          {/if}
        </div>
      {/if}
      
      <button 
        class="sheet-confirm-btn" 
        onclick={applyTypeConfiguration}
      >
        {pollType === 'rating' ? 'Generar Opciones' : 'Confirmar'}
      </button>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 30000;
    backdrop-filter: blur(8px);
  }
  
  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #0a0a0a;
    z-index: 30001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: #0a0a0a;
    flex-shrink: 0;
  }
  
  .modal-header h2 {
    font-size: 1rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.02em;
  }
  
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-left: 4px solid #ef4444;
    padding: 12px 16px;
    margin: 0;
    animation: slideDown 0.3s ease-out;
  }
  
  .error-banner p {
    margin: 4px 0;
    color: #fca5a5;
    font-size: 14px;
    font-weight: 500;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .close-btn {
    padding: 0.5rem;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #ffffff;
  }
  
  .close-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .publish-btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    background: #ffffff;
    border: none;
    color: #000000;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    letter-spacing: -0.01em;
  }
  
  .publish-btn:hover:not(:disabled) {
    background: #e5e5e5;
  }
  
  .publish-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .modal-content {
    flex: 1;
    overflow-y: scroll;
    overflow-x: hidden;
    padding: 0;
    padding-bottom: 2rem;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    position: relative;
  }
  
  .modal-content::-webkit-scrollbar {
    width: 4px;
  }
  
  .modal-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .modal-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
  
  .main-card {
    padding: 1.5rem;
    margin: 0 auto;
    max-width: 640px;
    width: 100%;
    min-height: 100%;
  }
  
  /* Sección de título */
  .poll-title-section {
    margin-bottom: 0;
    margin-left: -1.5rem;
    margin-right: -1.5rem;
    padding-left: 1.5rem;
    padding-right: 1.5rem;
    padding-bottom: 0.75rem;
    position: relative;
    z-index: 1;
  }
  
  .question-title {
    font-size: 18px;
    font-weight: 600;
    color: white;
    margin: 0;
    line-height: 1.3;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    width: 100%;
    padding: 0;
    box-sizing: border-box;
    min-height: 24px;
    max-height: 120px;
    overflow-y: auto;
  }
  
  .question-title.rating-emoji {
    font-size: 28px;
    line-height: 1.3;
  }
  
  .poll-title-input {
    font-size: 1.5rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    line-height: 1.4;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    width: 100%;
    padding: 0;
    font-family: inherit;
    letter-spacing: -0.02em;
    min-height: 42px;
    max-height: 200px;
    overflow-y: auto;
    overflow-wrap: break-word;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: contain;
    position: relative;
    field-sizing: content;
  }
  
  .poll-title-input::-webkit-scrollbar {
    width: 4px;
  }
  
  .poll-title-input::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .poll-title-input::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  
  .poll-title-input::placeholder {
    color: #52525b;
    font-weight: 600;
  }
  
  .poll-title-input:focus {
    color: #ffffff;
  }
  
  .duration-select-inline {
    background: transparent;
    border: none;
    color: #71717a;
    font-size: 0.8125rem;
    cursor: pointer;
    outline: none;
    padding: 0;
    font-weight: 500;
  }
  
  .duration-select-inline:hover {
    color: #a1a1aa;
  }
  
  .duration-select-inline option {
    background: #18181b;
    color: white;
  }
  
  /* Contenedor de tarjetas con botón añadir */
  .vote-cards-container {
    display: flex;
    align-items: center;
    gap: 0;
    margin: 0 -1rem;
    padding: 0.75rem 0;
  }
  
  /* Grid de opciones - Estilo BottomSheet */
  .vote-cards-grid {
    flex: 0 1 auto;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(min(180px, 45vw), 1fr);
    gap: 12px;
    padding-left: 1rem;
    padding-right: 8px;
    overflow-x: auto;
    overflow-y: visible;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
  }
  
  .vote-cards-grid::-webkit-scrollbar {
    height: 4px;
  }
  
  .vote-cards-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  
  .vote-cards-grid.accordion.fullwidth {
    grid-template-columns: repeat(var(--items), 1fr);
    transition: grid-template-columns 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .vote-cards-grid.accordion.fullwidth.open {
    grid-template-columns: var(--flex, 1) repeat(calc(var(--items) - 1), 0.3fr);
  }
  
  .vote-card {
    border-radius: 16px;
    cursor: pointer;
    transform: translateZ(0);
    will-change: transform, box-shadow;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    border: none;
    text-align: left;
    padding: 0;
    background: #2a2a2a;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    position: relative;
    z-index: 2;
    min-height: 240px;
    --fill-window: 120px;
  }
  
  .vote-card.collapsed {
    background: #252525;
  }
  
  .vote-card:hover { 
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  }
  
  .vote-card .card-header,
  .vote-card .card-content {
    position: relative;
    z-index: 0;
    background: transparent;
  }
  
  .card-header {
    padding: 32px 16px 0 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    position: relative;
    flex: 1;
    background: transparent;
    z-index: 1;
    pointer-events: none;
  }
  
  .vote-card.collapsed .card-header {
    padding: 25px 16px 0 16px;
  }
  
  .vote-card.is-active .card-header {
    flex: 1;
    padding-bottom: 0;
    padding-top: 37px;
  }
  
  .question-title {
    font-size: 14px;
    font-weight: 500;
    color: white;
    margin: 0;
    line-height: 1.3;
    text-align: left;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    word-break: break-word;
    min-height: 56px;
    background: transparent;
    position: relative;
    z-index: 0;
    pointer-events: none;
  }
  
  .vote-card.is-active .question-title {
    -webkit-line-clamp: unset;
    line-clamp: unset;
    max-height: none;
    overflow: visible;
    display: block;
    min-height: auto;
  }
  
  .question-title.editable {
    background: transparent;
    border: none;
    outline: none;
    padding: 0 0 12px 0;
    width: 100%;
    resize: none;
    overflow: hidden;
    vertical-align: top;
    word-wrap: break-word;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    flex: 1;
    min-height: 0;
  }
  
  .vote-card.collapsed .question-title.editable {
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
  }
  
  .vote-card.is-active .question-title.editable {
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    white-space: pre-wrap;
  }
  
  .question-title.editable::placeholder {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 500;
  }
  
  .char-counter {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-align: right;
    padding: 4px 8px;
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 3;
  }
  
  .remove-option-badge {
    position: absolute;
    top: 7px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .vote-card.is-active .remove-option-badge {
    left: 12px;
    transform: translateX(0);
  }
  
  .remove-option-badge:hover:not(.disabled) {
    background: rgba(239, 68, 68, 0.9);
    color: #ffffff;
    transform: translateX(-50%) scale(1.1);
  }
  
  .vote-card.is-active .remove-option-badge:hover {
    transform: scale(1.1);
  }
  
  .card-content {
    flex: 0 0 auto;
    padding: 0 16px 16px 16px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    min-height: 60px;
    position: relative;
  }
  
  .vote-card.collapsed .card-content {
    justify-content: center;
    flex: 1;
  }
  
  .card-content::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: min(100%, var(--fill-window, 120px));
    background: linear-gradient(0deg,
        var(--card-color, rgba(0, 0, 0, 0.4)) calc(var(--fill-window, 120px) * (clamp(var(--fill-pct-val, 0), 0, 100) / 100)),
        transparent calc(var(--fill-window, 120px) * (clamp(var(--fill-pct-val, 0), 0, 100) / 100))
      );
    pointer-events: none;
    z-index: 0;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .vote-card.collapsed .card-content::before {
    opacity: 1;
  }
  
  .vote-card.is-active .card-content::before {
    opacity: 1;
  }
  
  .percentage-display {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 0;
    background: transparent;
    pointer-events: none;
  }
  
  .percentage-display.is-active {
    justify-content: flex-start;
    align-items: flex-end;
    padding-left: 0;
  }
  
  .percentage-large {
    font-weight: 700;
    color: white;
    line-height: 1;
    background: transparent;
    pointer-events: none;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    transition: font-size 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .color-picker-badge-absolute {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }
  
  .vote-card.is-active .color-picker-badge-absolute {
    left: auto;
    right: 16px;
    transform: translateX(0);
  }
  
  .color-picker-badge-absolute:hover {
    border-color: rgba(255, 255, 255, 0.8);
    transform: translateX(-50%) scale(1.15);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  }
  
  .vote-card.is-active .color-picker-badge-absolute:hover {
    transform: translateX(0) scale(1.15);
  }
  
  .color-picker-badge-absolute svg {
    width: 0.75rem;
    height: 0.75rem;
    color: rgba(255, 255, 255, 0.9);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
  
  :global(.color-picker-overlay) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 150000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  
  :global(.color-picker-modal) {
    background: rgba(30, 30, 30, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 24px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  }
  
  :global(.color-picker-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  :global(.color-picker-title) {
    font-size: 18px;
    font-weight: 600;
    color: white;
    margin: 0;
  }
  
  :global(.color-picker-close) {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    padding: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  :global(.color-picker-close:hover) {
    background: rgba(255, 255, 255, 0.2);
  }
  
  :global(.color-palette) {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 10px;
  }
  
  :global(.color-swatch) {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }
  
  :global(.color-swatch:hover) {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.8);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }
  
  @media (max-width: 640px) {
    :global(.color-palette) {
      grid-template-columns: repeat(6, 1fr);
    }
  }
  
  .add-option-button-inline {
    flex-shrink: 0;
    min-width: 50px;
    width: 50px;
    height: 240px;
    background: rgba(255, 255, 255, 0.03);
    border: none;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0 16px 16px 0;
    color: rgba(255, 255, 255, 0.4);
    font-size: 1.25rem;
    font-weight: 300;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -24px;
    margin-right: 16px;
    z-index: 0;
  }
  
  .add-option-button-inline:hover {
    background: rgba(255, 255, 255, 0.06);
    border-left-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }
  
  /* Paginación - Exacto como BottomSheet */
  .pagination-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
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
  
  .poll-info {
    display: flex;
    gap: 1.5rem;
    padding: 0.5rem 0;
    margin: 0;
  }
  
  .info-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .info-item svg {
    flex-shrink: 0;
  }
  
  .error-banner {
    margin: 0 auto 1rem;
    max-width: 600px;
    width: 100%;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 0.5rem;
    color: #ef4444;
    font-size: 0.875rem;
  }
  
  .modal-footer {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    overflow: visible;
    touch-action: pan-x pan-y;
  }
  
  .footer-header {
    margin-bottom: 1rem;
  }
  
  .footer-label {
    font-size: 0.8125rem;
    color: #a1a1aa;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  
  .footer-selected {
    display: none;
  }
  
  .poll-types-grid {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }
  
  .poll-type-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.875rem;
    background: transparent;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    color: #a1a1aa;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 10px;
    width: 48px;
    height: 48px;
  }
  
  .poll-type-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .poll-type-btn:hover:not(.active) {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.02);
    color: #d4d4d8;
    transform: translateY(-1px);
  }
  
  .poll-type-btn.active {
    color: #ffffff;
    background: #ffffff;
    border-color: #ffffff;
  }
  
  .poll-type-btn svg {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    transition: all 0.2s ease;
  }
  
  .poll-type-btn.active svg {
    opacity: 1;
    color: #000000;
  }
  
  .active-indicator {
    display: none;
  }
  
  /* Bottom Sheet para opciones de tipo */
  .type-options-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 70000;
    backdrop-filter: blur(8px);
  }
  
  .type-options-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #0a0a0a;
    border-radius: 16px 16px 0 0;
    z-index: 70001;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.06);
  }
  
  .sheet-handle {
    width: 32px;
    height: 3px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    margin: 10px auto 8px;
  }
  
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .sheet-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
    letter-spacing: -0.02em;
  }
  
  .sheet-close-btn {
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .sheet-close-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: white;
  }
  
  .sheet-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  /* Tarjetas de información */
  .sheet-info-card {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
  }
  
  .sheet-info-card .info-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .sheet-info-card h4 {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
    margin: 0 0 0.75rem 0;
  }
  
  .sheet-info-card p {
    font-size: 0.9375rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    line-height: 1.6;
  }
  
  /* Secciones de configuración */
  .sheet-config-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .sheet-config-section h4 {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }
  
  .section-description {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    margin: -0.75rem 0 0 0;
    line-height: 1.5;
  }
  
  .config-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .config-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }
  
  /* Grid de iconos */
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }
  
  .icon-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .icon-option:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .icon-option.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
  }
  
  .icon-emoji {
    font-size: 1.75rem;
  }
  
  .icon-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  }
  
  .icon-option.active .icon-label {
    color: white;
    font-weight: 600;
  }
  
  /* Vista previa del rating */
  .preview-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 1rem;
  }
  
  .rating-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 0.5rem;
  }
  
  .preview-level {
    font-size: 1.25rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  
  /* Opciones de permisos */
  .permission-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .permission-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .permission-option:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .permission-option:has(input:checked) {
    background: rgba(59, 130, 246, 0.15);
    border-color: #3b82f6;
  }
  
  .permission-option input[type="radio"] {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    cursor: pointer;
    accent-color: #3b82f6;
    flex-shrink: 0;
  }
  
  .permission-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .permission-title {
    font-size: 1rem;
    font-weight: 600;
    color: white;
  }
  
  .permission-desc {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
  }
  
  /* Input de texto */
  .sheet-text-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    outline: none;
    transition: all 0.2s;
  }
  
  .sheet-text-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .sheet-text-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .sheet-option-select {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    outline: none;
    transition: all 0.2s;
    font-weight: 500;
  }
  
  .sheet-option-select:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }
  
  .sheet-option-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .sheet-option-select option {
    background: #1a1a1a;
    color: white;
  }
  
  .sheet-confirm-btn {
    width: 100%;
    padding: 1rem;
    background: #3b82f6;
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
  }
  
  .sheet-confirm-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }
  
  .sheet-confirm-btn:active {
    transform: translateY(0);
  }
  
  /* Responsive */
  @media (min-width: 768px) {
    .modal-container {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      width: 100%;
      max-width: 540px;
      border-radius: 1.25rem 1.25rem 0 0;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    }
    
    .modal-content {
      padding: 3rem 2.5rem;
      padding-bottom: 3rem;
    }
  }
</style>
