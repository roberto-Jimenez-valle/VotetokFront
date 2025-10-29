<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X, Plus, Trash2, Image as ImageIcon, Hash, Palette, Code, Eye, Loader2 } from 'lucide-svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser } from '$lib/stores';
  import { apiPost } from '$lib/api/client';
  import AuthModal from '$lib/AuthModal.svelte';
  import MediaEmbed from '$lib/components/MediaEmbed.svelte';
  import LinkPreview from '$lib/components/LinkPreview.svelte';
  import { giphyGifUrl } from '$lib/services/giphy';
  import { 
    extractUrls, 
    fetchLinkPreviewCached, 
    isDirectImage, 
    isEmbeddableVideo,
    getDomainName,
    type LinkPreviewData
  } from '$lib/services/linkPreview';
  
  const dispatch = createEventDispatcher();
  
  interface Props {
    isOpen?: boolean;
    buttonColors?: string[];
  }
  
  let { isOpen = $bindable(false), buttonColors = [] }: Props = $props();
  
  // Form state
  let title = $state('');
  let description = $state('');
  let category = $state('');
  let imageUrl = $state('');
  let imageFile = $state<File | null>(null);
  let imagePreview = $state<string | null>(null);
  
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
    imageUrl?: string;
  };
  
  type PollType = 'single' | 'multiple' | 'rating' | 'reactions' | 'collaborative';
  
  let options: PollOption[] = $state([
    { id: '1', label: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], imageUrl: '' },
    { id: '2', label: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], imageUrl: '' }
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
  
  let pollType = $state<PollType>('single');
  let hashtags = $state('');
  let location = $state('');
  let duration = $state('7d'); // 1d, 3d, 7d, 30d, never
  let editors = $state(''); // @usuario1, @usuario2...
  
  // Estado del modal de autenticación
  let showAuthModal = $state(false);
  
  // Estado del tooltip de formato
  let showFormatTooltip = $state(false);
  
  // DEBUG: Monitorear el estado de currentUser
  $effect(() => {
    console.log('[CreatePollModal] currentUser cambió:', $currentUser);
    console.log('[CreatePollModal] showAuthModal:', showAuthModal);
  });
  
  // Opciones específicas por tipo
  let ratingCount = $state(5); // Para tipo 'rating'
  let ratingIcon = $state('🔥'); // Icono para rating (fuego por defecto)
  let collaborativePermission = $state('anyone'); // 'anyone', 'friends', 'specific'
  let specificFriend = $state(''); // Para cuando se selecciona 'specific'
  
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
  
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);
  let showTypeOptionsModal = $state(false);
  let activeAccordionIndex = $state<number | null>(0);
  let currentPage = $state(0);
  
  // Variables para swipe táctil
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let isDragging = $state(false);
  let gridRef = $state<HTMLElement | null>(null);
  
  // Referencias a los inputs de texto de cada opción
  let optionInputs: Record<string, HTMLTextAreaElement> = {};
  
  // Estado del color picker
  let colorPickerOpenFor = $state<string | null>(null);
  let selectedHue = $state(0);
  let selectedSaturation = $state(85);
  let isDraggingColor = $state(false);
  
  let selectedColor = $derived(`hsl(${selectedHue}, ${selectedSaturation}%, 55%)`);
  
  // Estado para preview interactivo en opciones
  let activePreviewOption = $state<string | null>(null);
  
  // Detectar si es dispositivo táctil
  let isTouchDevice = $state(false);
  
  // Estado para previews que están cargando
  let loadingPreviews = $state<Set<string>>(new Set());
  
  // Estado para rastrear URLs que ya fallaron y se reemplazaron con Giphy
  let failedUrls = $state<Map<string, string>>(new Map());
  
  // Estado para link previews detectados
  let linkPreviews = $state<Map<string, LinkPreviewData>>(new Map());
  let detectedTitlePreview = $state<LinkPreviewData | null>(null);
  let optionPreviews = $state<Map<string, LinkPreviewData>>(new Map());
  
  // Variables derivadas para el título sin URL
  let detectedTitleUrl = $derived(extractUrlFromText(title));
  let titleWithoutUrl = $derived(detectedTitleUrl ? title.replace(detectedTitleUrl, ' ').replace(/\s+/g, ' ').trim() : title);
  
  // Función helper para obtener label sin URL (reactiva)
  function getLabelWithoutUrl(label: string): string {
    const url = extractUrlFromText(label);
    return url ? label.replace(url, ' ').replace(/\s+/g, ' ').trim() : label;
  }
  
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
    
    // Desactivar modo interactivo al cambiar de opción
    activePreviewOption = null;
    
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
      color: COLORS[randomColorIndex],
      imageUrl: ''
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
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        imageUrl: ''
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
  
  // Extraer URL de un texto
  function extractUrlFromText(text: string): string | null {
    if (!text) return null;
    
    // Regex para detectar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    
    return matches ? matches[0] : null;
  }
  
  // Validar URL y generar preview usando el nuevo sistema
  async function validateAndPreviewUrl(url: string): Promise<{ isValid: boolean; data?: any; error?: string }> {
    if (!url || url.trim() === '') {
      return { isValid: false, error: 'URL vacía' };
    }
    
    try {
      // Intentar obtener preview del enlace
      const preview = await fetchLinkPreviewCached(url.trim());
      
      if (preview) {
        // Guardar el preview en el mapa
        linkPreviews.set(url, preview);
        linkPreviews = linkPreviews;
        
        return { isValid: true, data: preview };
      }
      
      return { isValid: false, error: 'URL no válida o no accesible' };
      
    } catch (err) {
      console.error('[Validate URL] Error:', err);
      return { isValid: false, error: 'Error al validar la URL' };
    }
  }
  
  // Detectar y cargar preview automáticamente cuando se detecta URL en título
  async function detectAndLoadTitlePreview(text: string) {
    const urls = extractUrls(text);
    console.log('🔍 [CreatePollModal] URLs detectadas en título:', urls);
    
    if (urls.length > 0) {
      const url = urls[0];
      console.log('🎯 [CreatePollModal] Cargando preview para:', url);
      
      // Solo cargar si es una URL nueva
      if (detectedTitlePreview?.url !== url) {
        loadingPreviews.add('title');
        loadingPreviews = loadingPreviews;
        
        const preview = await fetchLinkPreviewCached(url);
        console.log('📦 [CreatePollModal] Preview recibido:', {
          hasPreview: !!preview,
          title: preview?.title,
          hasImage: !!preview?.image,
          image: preview?.image,
          type: preview?.type
        });
        
        if (preview) {
          detectedTitlePreview = preview;
          linkPreviews.set(url, preview);
          linkPreviews = linkPreviews;
          console.log('✅ [CreatePollModal] detectedTitlePreview seteado:', detectedTitlePreview);
        } else {
          console.warn('❌ [CreatePollModal] Preview es null');
        }
        
        loadingPreviews.delete('title');
        loadingPreviews = loadingPreviews;
      }
    } else {
      detectedTitlePreview = null;
    }
  }
  
  // Detectar y cargar preview para una opción
  async function detectAndLoadOptionPreview(optionId: string, text: string) {
    const urls = extractUrls(text);
    if (urls.length > 0) {
      const url = urls[0];
      
      // Solo cargar si es una URL nueva para esta opción
      const currentPreview = optionPreviews.get(optionId);
      if (currentPreview?.url !== url) {
        loadingPreviews.add(optionId);
        loadingPreviews = loadingPreviews;
        
        const preview = await fetchLinkPreviewCached(url);
        if (preview) {
          optionPreviews.set(optionId, preview);
          optionPreviews = optionPreviews;
          linkPreviews.set(url, preview);
          linkPreviews = linkPreviews;
        }
        
        loadingPreviews.delete(optionId);
        loadingPreviews = loadingPreviews;
      }
    } else {
      optionPreviews.delete(optionId);
      optionPreviews = optionPreviews;
    }
  }
  
  /**
   * Reemplazar automáticamente una URL de imagen rota con un GIF de Giphy
   * @param optionId - ID de la opción que falló
   * @param optionLabel - Texto de la opción para buscar en Giphy
   * @param failedUrl - URL que falló
   */
  async function replaceWithGiphyFallback(optionId: string, optionLabel: string, failedUrl: string) {
    // Evitar loops infinitos: si ya intentamos reemplazar esta URL, no hacerlo de nuevo
    if (failedUrls.has(failedUrl)) {
      console.log('[Giphy Fallback] Ya se intentó reemplazar:', failedUrl);
      return;
    }
    
    // Extraer texto limpio sin URL para usar como término de búsqueda
    const searchTerm = getLabelWithoutUrl(optionLabel).trim();
    
    if (!searchTerm) {
      console.warn('[Giphy Fallback] No hay texto para buscar GIF');
      return;
    }
    
    console.log(`[Giphy Fallback] 🎬 Buscando GIF para: "${searchTerm}"`);
    
    try {
      // Buscar GIF en Giphy usando el texto de la opción
      const gifUrl = await giphyGifUrl(searchTerm);
      
      if (gifUrl) {
        console.log(`[Giphy Fallback] ✅ GIF encontrado:`, gifUrl);
        
        // Marcar URL como fallida para evitar intentarlo de nuevo
        failedUrls.set(failedUrl, gifUrl);
        
        // Encontrar la opción y reemplazar la URL
        const option = options.find(opt => opt.id === optionId);
        if (option) {
          // Reemplazar la URL en el label si está ahí
          if (option.label.includes(failedUrl)) {
            option.label = option.label.replace(failedUrl, gifUrl);
            console.log(`[Giphy Fallback] ✅ URL reemplazada en label`);
          }
          
          // Reemplazar la URL en imageUrl si está ahí
          if (option.imageUrl === failedUrl) {
            option.imageUrl = gifUrl;
            console.log(`[Giphy Fallback] ✅ URL reemplazada en imageUrl`);
          }
          
          console.log(`[Giphy Fallback] ✅ Opción "${searchTerm}" actualizada con GIF de Giphy`);
        }
      } else {
        console.warn(`[Giphy Fallback] ❌ No se encontró GIF para: "${searchTerm}"`);
      }
    } catch (error) {
      console.error('[Giphy Fallback] Error buscando GIF:', error);
    }
  }
  
  /**
   * Handler para cuando una imagen de MediaEmbed falla en una opción
   * Se llama desde el evento onerror del MediaEmbed
   */
  function handleImageLoadError(optionId: string, optionLabel: string, failedImageUrl: string) {
    console.log(`[Image Error] 🚨 Imagen falló para opción: "${getLabelWithoutUrl(optionLabel)}"`);
    console.log(`[Image Error] URL fallida:`, failedImageUrl);
    
    // Reemplazar automáticamente con Giphy
    replaceWithGiphyFallback(optionId, optionLabel, failedImageUrl);
  }
  
  /**
   * Handler para cuando la imagen principal de la encuesta falla
   */
  async function handleMainImageLoadError(failedImageUrl: string) {
    console.log(`[Image Error] 🚨 Imagen principal falló:`, failedImageUrl);
    
    // Evitar loops infinitos
    if (failedUrls.has(failedImageUrl)) {
      console.log('[Giphy Fallback] Ya se intentó reemplazar la imagen principal');
      return;
    }
    
    // Usar el título sin URL como término de búsqueda
    const searchTerm = titleWithoutUrl.trim();
    
    if (!searchTerm) {
      console.warn('[Giphy Fallback] No hay título para buscar GIF de imagen principal');
      return;
    }
    
    console.log(`[Giphy Fallback] 🎬 Buscando GIF para imagen principal: "${searchTerm}"`);
    
    try {
      const gifUrl = await giphyGifUrl(searchTerm);
      
      if (gifUrl) {
        console.log(`[Giphy Fallback] ✅ GIF encontrado para imagen principal:`, gifUrl);
        
        // Marcar como fallida
        failedUrls.set(failedImageUrl, gifUrl);
        
        // Reemplazar la URL en el título si está ahí
        if (title.includes(failedImageUrl)) {
          title = title.replace(failedImageUrl, gifUrl);
          console.log(`[Giphy Fallback] ✅ URL reemplazada en título`);
        }
        
        // Reemplazar en imageUrl si está ahí
        if (imageUrl === failedImageUrl) {
          imageUrl = gifUrl;
          console.log(`[Giphy Fallback] ✅ URL reemplazada en imageUrl principal`);
        }
        
        console.log(`[Giphy Fallback] ✅ Imagen principal actualizada con GIF de Giphy`);
      } else {
        console.warn(`[Giphy Fallback] ❌ No se encontró GIF para imagen principal`);
      }
    } catch (error) {
      console.error('[Giphy Fallback] Error buscando GIF para imagen principal:', error);
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
  async function validate(): Promise<boolean> {
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
    
    // Validar URL principal si existe
    if (imageUrl) {
      const urlValidation = await validateAndPreviewUrl(imageUrl);
      if (!urlValidation.isValid) {
        errors.image = urlValidation.error || 'URL no válida';
      }
    }
    
    // Validar URL extraída del título
    const titleUrl = extractUrlFromText(title);
    if (titleUrl) {
      const urlValidation = await validateAndPreviewUrl(titleUrl);
      if (!urlValidation.isValid) {
        errors.title = 'La URL en el título no es válida: ' + (urlValidation.error || 'URL no accesible');
      }
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
    
    // Validar URLs de las opciones
    for (const opt of validOptions) {
      const optionUrl = extractUrlFromText(opt.label) || opt.imageUrl;
      if (optionUrl) {
        const urlValidation = await validateAndPreviewUrl(optionUrl);
        if (!urlValidation.isValid) {
          errors[`option_${opt.id}`] = 'URL no válida: ' + (urlValidation.error || 'URL no accesible');
        }
      }
    }
    
    return Object.keys(errors).length === 0;
  }
  
  // Submit del formulario
  async function handleSubmit() {
    console.log('🚀 Intentando crear encuesta...');
    console.log('Título:', title);
    console.log('Opciones:', options);
    console.log('👤 CurrentUser:', $currentUser);
    console.log('🔒 showAuthModal actual:', showAuthModal);
    
    // Verificar si el usuario está autenticado
    if (!$currentUser) {
      console.log('⚠️ Usuario no autenticado, mostrando modal de autenticación');
      showAuthModal = true;
      console.log('🔒 showAuthModal después de setear:', showAuthModal);
      return;
    }
    
    console.log('✅ Usuario autenticado, continuando con publicación');
    
    // Validar formulario (ahora es async)
    const isValid = await validate();
    if (!isValid) {
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
      
      const result = await apiPost('/api/polls', pollData);
      
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
  
  // Handler cuando el usuario se autentica
  function handleAuthComplete(event: CustomEvent) {
    const { provider } = event.detail;
    console.log('✅ Usuario autenticado con:', provider);
    showAuthModal = false;
    // Después de autenticar, intentar publicar nuevamente
    handleSubmit();
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
    editors = '';
    options = [
      { id: '1', label: '', color: COLORS[0], imageUrl: '' },
      { id: '2', label: '', color: COLORS[1], imageUrl: '' }
    ];
    errors = {};
    // Limpiar estados de modales secundarios
    colorPickerOpenFor = null;
    showTypeOptionsModal = false;
    // Limpiar previews
    linkPreviews = new Map();
    detectedTitlePreview = null;
    optionPreviews = new Map();
    loadingPreviews = new Set();
  }
  
  // Parser de prompt/markdown a datos de encuesta
  function parsePrompt(text: string) {
    const lines = text.trim().split('\n');
    
    // Reiniciar valores
    title = '';
    description = '';
    category = '';
    hashtags = '';
    imageUrl = '';
    editors = '';
    const parsedOptions: PollOption[] = [];
    
    let currentSection = 'title';
    let currentOption: PollOption | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      // Título: ❓ Pregunta: [título]
      if (!title) {
        const questionMatch = trimmed.match(/^[❓?]\s*Pregunta:\s*(.+)/i);
        if (questionMatch) {
          title = questionMatch[1].trim();
          currentSection = 'content';
          continue;
        }
        
        // Formato alternativo: # Título
        if (trimmed.startsWith('# ')) {
          title = trimmed.replace(/^#\s*/, '');
          currentSection = 'content';
          continue;
        }
      }
      
      // Imagen principal: 🖼️ Imagen o vídeo:
      const mainImageMatch = trimmed.match(/^🖼️\s*(?:Imagen|Vídeo|Video|Imagen o vídeo):\s*(.*)$/i);
      if (mainImageMatch) {
        const url = mainImageMatch[1].trim();
        if (url && url !== '[URL o vacío]') {
          imageUrl = url.trim();
        }
        continue;
      }
      
      // Detectar líneas con solo URLs (después de la imagen principal o como línea suelta)
      if (currentSection === 'content' && trimmed.match(/^https?:\/\/[^\s]+$/i)) {
        // Si aún no hay imagen principal, usar esta como imagen
        if (!imageUrl) {
          imageUrl = trimmed.trim();
        }
        continue;
      }
      
      // Encabezado de opciones: 🧩 Opciones:
      if (trimmed.match(/^🧩\s*Opciones:/i)) {
        currentSection = 'options';
        continue;
      }
      
      // Opciones: 1️⃣ [Texto] ([color])
      const optionMatch = trimmed.match(/^(?:[1-9]️⃣|\d+[.)\s]|[-*•])\s*(.+)/);
      if (optionMatch) {
        let optionText = optionMatch[1].trim();
        let optionColor = COLORS[parsedOptions.length % COLORS.length];
        let optionImageUrl = '';
        
        // Buscar color al final: ([color]) o (#hex)
        const colorMatch = optionText.match(/\(([#a-zA-Z0-9]+)\)\s*$/);
        if (colorMatch) {
          const extractedColor = colorMatch[1];
          if (extractedColor.startsWith('#')) {
            optionColor = extractedColor;
          } else {
            const foundColor = COLORS.find(c => c.toLowerCase().includes(extractedColor.toLowerCase()));
            if (foundColor) optionColor = foundColor;
          }
          optionText = optionText.replace(/\s*\([#a-zA-Z0-9]+\)\s*$/, '').trim();
        }
        
        currentOption = {
          id: String(Date.now() + parsedOptions.length),
          label: optionText,
          color: optionColor,
          imageUrl: optionImageUrl
        };
        parsedOptions.push(currentOption);
        continue;
      }
      
      // URL de la opción (línea siguiente a una opción)
      if (currentOption && currentSection === 'options') {
        // Detectar URLs de YouTube, imágenes, videos, o cualquier enlace
        const urlMatch = trimmed.match(/^(https?:\/\/[^\s]+|\[URL o vacío\])$/i);
        if (urlMatch && !trimmed.startsWith('🏷️') && !trimmed.startsWith('🗳️') && !trimmed.startsWith('👥') && !trimmed.startsWith('⏰')) {
          const url = urlMatch[1];
          if (url && url !== '[URL o vacío]') {
            // Limpiar la URL de posibles caracteres al final
            currentOption.imageUrl = url.trim();
          }
          currentOption = null;
          continue;
        }
      }
      
      // Etiquetas: 🏷️ Etiquetas: [temas]
      const tagsMatch = trimmed.match(/^🏷️\s*Etiquetas:\s*(.+)/i);
      if (tagsMatch) {
        const tagText = tagsMatch[1].trim();
        if (tagText && tagText !== '[temas]') {
          hashtags = tagText.split(/[,\s]+/)
            .filter(t => t)
            .map(t => t.startsWith('#') ? t : '#' + t)
            .join(' ');
        }
        continue;
      }
      
      // Tipo de encuesta: 🗳️ Tipo de encuesta: [tipo]
      const pollTypeMatch = trimmed.match(/^🗳️\s*Tipo de encuesta:\s*(.+)/i);
      if (pollTypeMatch) {
        const type = pollTypeMatch[1].trim().toLowerCase();
        if (type.includes('única') || type.includes('unica') || type.includes('single')) pollType = 'single';
        else if (type.includes('múltiple') || type.includes('multiple')) pollType = 'multiple';
        else if (type.includes('rating') || type.includes('valoración')) pollType = 'rating';
        else if (type.includes('reacciones') || type.includes('reactions')) pollType = 'reactions';
        else if (type.includes('colaborativa') || type.includes('collaborative')) pollType = 'collaborative';
        continue;
      }
      
      // Editores: 👥 Editores: [@usuario1, @usuario2]
      const editorsMatch = trimmed.match(/^👥\s*Editores:\s*(.+)/i);
      if (editorsMatch) {
        const editorText = editorsMatch[1].trim();
        if (editorText && !editorText.includes('[') && !editorText.includes('...')) {
          editors = editorText;
        }
        continue;
      }
      
      // Tiempo: ⏰ Tiempo: [duración]
      const timeMatch = trimmed.match(/^⏰\s*Tiempo:\s*(.+)/i);
      if (timeMatch) {
        const timeText = timeMatch[1].trim().toLowerCase();
        if (timeText.includes('1 día') || timeText.includes('1d')) duration = '1d';
        else if (timeText.includes('3 día') || timeText.includes('3d')) duration = '3d';
        else if (timeText.includes('7 día') || timeText.includes('7d')) duration = '7d';
        else if (timeText.includes('30 día') || timeText.includes('30d') || timeMatch[1].includes('mes')) duration = '30d';
        else if (timeText.includes('sin límite') || timeText.includes('never') || timeText.includes('ilimitado')) duration = 'never';
        else if (timeText.match(/hasta\s+\d{1,2}\/\d{1,2}\/\d{4}/)) duration = 'never'; // Fecha específica -> sin límite por ahora
        continue;
      }
      
      // Hashtags sueltos
      if (trimmed.startsWith('#')) {
        const tags = trimmed.split(/\s+/).filter(t => t.startsWith('#'));
        if (tags.length > 0) {
          if (hashtags) hashtags += ' ';
          hashtags += tags.join(' ');
        }
        continue;
      }
      
      // Descripción (líneas sin marcadores especiales después del título)
      if (title && currentSection === 'content' && !trimmed.match(/^[-*•\d]/)) {
        if (description) description += ' ';
        description += trimmed;
      }
    }
    
    // Aplicar opciones parseadas
    if (parsedOptions.length >= 2) {
      options = parsedOptions;
    }
    
    // Si no hay título, usar la primera línea
    if (!title && lines.length > 0) {
      title = lines[0].trim().substring(0, 200);
    }
    
    // Resetear estados de paginación
    currentPage = 0;
    activeAccordionIndex = 0;
  }
  
  // Generar formato de plantilla para copiar
  function getTemplateFormat(): string {
    const lines: string[] = [];
    
    lines.push('❓ Pregunta: [título de la encuesta]');
    lines.push('');
    lines.push('🖼️ Imagen o vídeo:');
    lines.push('[URL o vacío]');
    lines.push('');
    lines.push('🧩 Opciones:');
    lines.push('1️⃣ [Texto de opción 1] ([color])');
    lines.push('[URL o vacío]');
    lines.push('2️⃣ [Texto de opción 2] ([color])');
    lines.push('[URL o vacío]');
    lines.push('');
    lines.push('🏷️ Etiquetas: [temas]');
    lines.push('🗳️ Tipo de encuesta: [única / múltiple / rating / reacciones / colaborativa]');
    lines.push('👥 Editores: [@usuario1, @usuario2, ...]');
    lines.push('⏰ Tiempo: [ej. 3 días / hasta 30/10/2025]');
    
    return lines.join('\n');
  }
  
  // Copiar formato al portapapeles
  async function copyTemplateFormat() {
    const template = getTemplateFormat();
    try {
      await navigator.clipboard.writeText(template);
      // Mostrar feedback visual
      showFormatTooltip = false;
      setTimeout(() => {
        alert('✅ Formato copiado al portapapeles. Pégalo en cualquier IA para generar tu encuesta.');
      }, 100);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  }
  
  // Detectar y parsear automáticamente al pegar en el título
  function handleTitlePaste(e: ClipboardEvent) {
    const pastedText = e.clipboardData?.getData('text');
    if (!pastedText) return;
    
    // Detectar si el texto pegado tiene formato completo
    const hasFormatMarkers = pastedText.includes('❓ Pregunta:') || 
                            pastedText.includes('🧩 Opciones:') ||
                            pastedText.includes('🗳️ Tipo de encuesta:');
    
    if (hasFormatMarkers) {
      e.preventDefault();
      parsePrompt(pastedText);
    }
  }
  
  // Cerrar al presionar Escape
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isSubmitting) {
      close();
    }
  }
  
  // Detectar si es dispositivo táctil al montar el componente
  onMount(() => {
    isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });
  
  // Efecto reactivo: detectar URLs en título y cargar preview automáticamente
  $effect(() => {
    console.log('🔎 [$effect] EJECUTADO - Título:', title, 'isOpen:', isOpen);
    
    if (!title || !isOpen) {
      console.log('❌ [$effect] Condición no cumplida - title:', !!title, 'isOpen:', isOpen);
      return;
    }
    
    const urls = extractUrls(title);
    console.log('🔍 [$effect] URLs extraídas con extractUrls:', urls);
    
    // También probar con la función vieja
    const urlVieja = extractUrlFromText(title);
    console.log('🔍 [$effect] URL con extractUrlFromText:', urlVieja);
    
    if (urls.length > 0) {
      // Debounce: esperar 500ms después de que el usuario deje de escribir
      const timeoutId = setTimeout(() => {
        detectAndLoadTitlePreview(title);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      // Limpiar preview si ya no hay URL
      detectedTitlePreview = null;
    }
  });
  
  // Efecto reactivo: detectar URLs en opciones y cargar previews
  $effect(() => {
    if (isOpen && options.length > 0) {
      // Para cada opción con texto, detectar URLs
      for (const option of options) {
        if (option.label) {
          const urls = extractUrls(option.label);
          if (urls.length > 0) {
            // Debounce: esperar 500ms
            const timeoutId = setTimeout(() => {
              detectAndLoadOptionPreview(option.id, option.label);
            }, 500);
            
            // Cleanup
            return () => clearTimeout(timeoutId);
          }
        }
      }
    }
  });
  
  // Funciones para manejo de swipe con pointer events
  function handlePointerDown(e: PointerEvent) {
    // No procesar si empieza en un textarea, input o botón
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
      isDragging = false;
      return;
    }
    
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    isDragging = false;
  }
  
  function handlePointerMove(e: PointerEvent) {
    if (!gridRef || touchStartX === null) return;
    
    // No procesar si está en un textarea, input o botón
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    
    const deltaX = e.clientX - touchStartX;
    const deltaY = e.clientY - touchStartY;
    
    // Solo considerar drag si hay movimiento significativo
    const hasMoved = Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10;
    
    // Detectar si es movimiento horizontal (más horizontal que vertical)
    if (hasMoved && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      isDragging = true;
      e.preventDefault();
      
      const currentIndex = activeAccordionIndex;
      const totalCards = paginatedOptions.items.length;
      
      if (deltaX > 100) {
        if (currentIndex !== null && currentIndex > 0) {
          // Swipe derecha -> card anterior
          const newIndex = currentIndex - 1;
          activeAccordionIndex = newIndex;
          touchStartX = e.clientX; // Reset para siguiente detección
          
          // Enfocar el input si la opción está vacía
          setTimeout(() => {
            const option = paginatedOptions.items[newIndex];
            if (option && !option.label.trim()) {
              const input = optionInputs[option.id];
              if (input) {
                input.focus();
              }
            }
            isDragging = false;
          }, 100);
        } else if (currentIndex === 0 && currentPage > 0) {
          // Swipe derecho desde primera card -> página anterior
          currentPage -= 1;
          activeAccordionIndex = ITEMS_PER_PAGE - 1;
          touchStartX = e.clientX; // Reset para siguiente detección
          setTimeout(() => isDragging = false, 100);
        } else {
          isDragging = false;
        }
      } else if (deltaX < -80 && !isDragging) {
        isDragging = true;
        if (currentIndex !== null && currentIndex < totalCards - 1) {
          // Swipe izquierda -> card siguiente
          const newIndex = currentIndex + 1;
          activeAccordionIndex = newIndex;
          touchStartX = e.clientX; // Reset para siguiente detección
          
          // Enfocar el input si la opción está vacía
          setTimeout(() => {
            const option = paginatedOptions.items[newIndex];
            if (option && !option.label.trim()) {
              const input = optionInputs[option.id];
              if (input) {
                input.focus();
              }
            }
            isDragging = false;
          }, 100);
        } else if (currentIndex === totalCards - 1 && currentPage < totalPages - 1) {
          // Swipe izquierdo desde última card -> página siguiente
          currentPage += 1;
          activeAccordionIndex = 0;
          touchStartX = e.clientX; // Reset para siguiente detección
          setTimeout(() => isDragging = false, 100);
        } else if (currentIndex === totalCards - 1 && currentPage === totalPages - 1) {
          // Swipe izquierdo desde la última card de la última página -> crear nueva opción
          if (options.length < 10) {
            touchStartX = e.clientX; // Reset para siguiente detección
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
    {#if errors.title || errors.options || errors.submit || errors.image || errors.description}
      <div class="error-banner">
        {#if errors.title}
          <p>❌ {errors.title}</p>
        {/if}
        {#if errors.options}
          <p>❌ {errors.options}</p>
        {/if}
        {#if errors.image}
          <p>❌ {errors.image}</p>
        {/if}
        {#if errors.description}
          <p>❌ {errors.description}</p>
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
            <div class="title-input-wrapper">
              <textarea
                class="poll-title-input"
                class:error={errors.title}
                placeholder="¿Cuál es tu pregunta?"
                value={titleWithoutUrl}
                oninput={(e) => {
                  const newValue = (e.target as HTMLTextAreaElement).value;
                  const currentUrl = extractUrlFromText(title);
                  
                  // Si había URL, mantenerla al final; si no, solo el texto
                  if (currentUrl) {
                    title = newValue ? `${newValue} ${currentUrl}` : currentUrl;
                  } else {
                    title = newValue;
                  }
                  
                  // Sincronizar el value del textarea solo si detectamos URL nueva o cambio de URL
                  const textarea = e.target as HTMLTextAreaElement;
                  const updatedUrl = extractUrlFromText(title);
                  if (updatedUrl && updatedUrl !== currentUrl) {
                    const currentTitleWithoutUrl = title.replace(updatedUrl, '').trim();
                    const cursorPos = textarea.selectionStart;
                    textarea.value = currentTitleWithoutUrl;
                    textarea.setSelectionRange(cursorPos, cursorPos);
                  }
                }}
                rows="2"
                onpaste={(e) => {
                  handleTitlePaste(e);
                  // Después de pegar, sincronizar el textarea solo si hay URL
                  setTimeout(() => {
                    const textarea = e.target as HTMLTextAreaElement;
                    const updatedUrl = extractUrlFromText(title);
                    if (updatedUrl) {
                      const currentTitleWithoutUrl = title.replace(updatedUrl, '').trim();
                      const cursorPos = textarea.selectionStart;
                      textarea.value = currentTitleWithoutUrl;
                      textarea.setSelectionRange(cursorPos, cursorPos);
                    }
                  }, 10);
                }}
              ></textarea>
              <div class="info-tooltip-container">
                <button
                  class="info-btn"
                  onclick={() => showFormatTooltip = !showFormatTooltip}
                  title="Ver formato para IA"
                  aria-label="Información sobre formato"
                  type="button"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {#if showFormatTooltip}
                  <div class="format-tooltip" transition:fade={{ duration: 150 }}>
                    <div class="tooltip-header">
                      <span class="tooltip-title">🤖 Formato para IA</span>
                      <button 
                        class="tooltip-close"
                        onclick={() => showFormatTooltip = false}
                        type="button"
                        aria-label="Cerrar"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                    <p class="tooltip-description">
                      Copia este formato y úsalo en ChatGPT, Claude o cualquier IA para generar tu encuesta. Luego pega el resultado aquí.
                    </p>
                    <div class="tooltip-template">
                      <code>{getTemplateFormat()}</code>
                    </div>
                    <button 
                      class="copy-format-btn"
                      onclick={copyTemplateFormat}
                      type="button"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar formato
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Preview multimedia del título principal -->
          {#if detectedTitlePreview || extractUrlFromText(title) || imageUrl}
            {@const detectedMainUrl = extractUrlFromText(title)}
            {@const isLoading = loadingPreviews.has('title')}
            {#if typeof console !== 'undefined'}
              {console.log('🖼️ [Template] Preview conditions:', {
                hasDetectedPreview: !!detectedTitlePreview,
                detectedMainUrl,
                isDirectImage: isDirectImage(detectedMainUrl || ''),
                isLoading
              })}
            {/if}
            <div class="main-media-preview">
              {#if isLoading}
                <div class="preview-loading">
                  <Loader2 class="w-8 h-8 animate-spin" />
                  <p>Cargando preview...</p>
                </div>
              {:else if detectedTitlePreview && !isDirectImage(detectedMainUrl || '')}
                <!-- Link Preview con metadatos -->
                <LinkPreview 
                  preview={detectedTitlePreview}
                  onRemove={() => {
                    const urlInTitle = extractUrlFromText(title);
                    if (urlInTitle) {
                      title = title.replace(urlInTitle, ' ').replace(/\s+/g, ' ').trim();
                    }
                    detectedTitlePreview = null;
                    loadingPreviews.delete('title');
                    loadingPreviews = loadingPreviews;
                  }}
                />
              {:else}
                <!-- Fallback: MediaEmbed para imágenes directas -->
                <button
                  type="button"
                  class="remove-preview-btn"
                  onclick={() => {
                    const urlInTitle = extractUrlFromText(title);
                    if (urlInTitle) {
                      title = title.replace(urlInTitle, ' ').replace(/\s+/g, ' ').trim();
                    } else if (imageUrl) {
                      imageUrl = '';
                    }
                    loadingPreviews.delete('title');
                    loadingPreviews = loadingPreviews;
                  }}
                  title="Eliminar preview"
                  aria-label="Eliminar preview"
                >
                  <X class="w-5 h-5" />
                </button>
                <MediaEmbed 
                  url={detectedMainUrl || imageUrl || ''} 
                  mode="full" 
                  width="100%" 
                  height="100%"
                  on:imageerror={(e) => handleMainImageLoadError(e.detail.url)}
                />
              {/if}
            </div>
          {/if}
        
        <!-- Grid de opciones con botón añadir integrado -->
        <div class="vote-cards-container">
          <div 
            class="vote-cards-grid accordion fullwidth {activeAccordionIndex != null ? 'open' : ''}"
            style="--items: {paginatedOptions.items.length}"
            bind:this={gridRef}
          >
            {#each paginatedOptions.items as option, index (option.id)}
              {@const globalIndex = currentPage * ITEMS_PER_PAGE + index}
              {@const pct = Math.round(100 / options.length)}
              {@const detectedUrl = extractUrlFromText(option.label)}
              <button 
                type="button"
                class="vote-card {activeAccordionIndex === index ? 'is-active' : ''} {activeAccordionIndex !== index ? 'collapsed' : ''}" 
                style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, pct))}%; --fill-pct-val: {Math.max(0, Math.min(100, pct))}; --flex: {Math.max(0.5, pct / 10)};" 
                onclick={() => setActive(index)}
              >
                {#if activeAccordionIndex === index && (detectedUrl || option.imageUrl || optionPreviews.has(option.id))}
                  {@const isOptionLoading = loadingPreviews.has(option.id)}
                  {@const optionPreview = optionPreviews.get(option.id)}
                  <div 
                    role="button"
                    tabindex="-1"
                    class="option-media-background {activePreviewOption === option.id ? 'interactive-mode' : ''}" 
                    onmouseenter={() => {
                      // Solo hover en dispositivos no táctiles
                      if (!isTouchDevice) {
                        activePreviewOption = option.id;
                      }
                    }}
                    onmouseleave={() => {
                      // Solo hover en dispositivos no táctiles
                      if (!isTouchDevice) {
                        activePreviewOption = null;
                      }
                    }}
                    onclick={(e) => {
                      e.stopPropagation();
                      // En dispositivos táctiles, toggle con click
                      if (isTouchDevice) {
                        activePreviewOption = activePreviewOption === option.id ? null : option.id;
                      }
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                      }
                    }}
                  >
                    <div
                      role="button"
                      tabindex="0"
                      class="remove-option-preview-btn"
                      onclick={(e) => {
                        e.stopPropagation();
                        // Desactivar modo interactivo
                        activePreviewOption = null;
                        // Limpiar la URL de la opción, mantener el resto del texto
                        const urlInLabel = extractUrlFromText(option.label);
                        if (urlInLabel) {
                          // Reemplazar la URL y limpiar espacios múltiples
                          option.label = option.label.replace(urlInLabel, ' ').replace(/\s+/g, ' ').trim();
                        } else if (option.imageUrl) {
                          option.imageUrl = '';
                        }
                        // Limpiar estado de carga
                        loadingPreviews.delete(option.id);
                        loadingPreviews = loadingPreviews;
                        // Enfocar el textarea de esta opción después de que reaparezca
                        setTimeout(() => {
                          const input = optionInputs[option.id];
                          if (input) {
                            input.focus();
                          }
                        }, 50);
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          activePreviewOption = null;
                          const urlInLabel = extractUrlFromText(option.label);
                          if (urlInLabel) {
                            // Reemplazar la URL y limpiar espacios múltiples
                            option.label = option.label.replace(urlInLabel, ' ').replace(/\s+/g, ' ').trim();
                          } else if (option.imageUrl) {
                            option.imageUrl = '';
                          }
                          // Limpiar estado de carga
                          loadingPreviews.delete(option.id);
                          loadingPreviews = loadingPreviews;
                          // Enfocar el textarea de esta opción después de que reaparezca
                          setTimeout(() => {
                            const input = optionInputs[option.id];
                            if (input) {
                              input.focus();
                            }
                          }, 50);
                        }
                      }}
                      title="Eliminar preview"
                      aria-label="Eliminar preview"
                    >
                      <X class="w-4 h-4" />
                    </div>
                    {#if isOptionLoading}
                      <div class="preview-loading">
                        <Loader2 class="w-6 h-6 animate-spin" />
                        <p class="text-sm">Cargando...</p>
                      </div>
                    {:else if optionPreview && !isDirectImage(detectedUrl || '')}
                      <!-- Link Preview con metadatos -->
                      <div class="option-link-preview-wrapper">
                        <LinkPreview 
                          preview={optionPreview}
                          compact={true}
                          clickable={false}
                        />
                      </div>
                    {:else}
                      <!-- Fallback: MediaEmbed para imágenes directas -->
                      <MediaEmbed 
                        url={detectedUrl || option.imageUrl || ''} 
                        mode="full"
                        on:imageerror={(e) => handleImageLoadError(option.id, option.label, e.detail.url)}
                      />
                    {/if}
                    <div class="media-overlay {activePreviewOption === option.id ? 'hidden' : ''}"></div>
                  </div>
                {/if}
                <div class="card-header {activePreviewOption === option.id ? 'hidden-for-preview' : ''}">
                  {#if activeAccordionIndex === index}
                    {@const labelWithoutUrl = getLabelWithoutUrl(option.label)}
                    {@const currentUrl = extractUrlFromText(option.label)}
                    <div class="char-counter">{labelWithoutUrl.length}/200</div>
                    <textarea
                      class="question-title editable"
                      class:rating-emoji={pollType === 'rating' && /^[\p{Emoji}\s]+$/u.test(option.label || '')}
                      class:error={errors[`option_${option.id}`]}
                      placeholder="Opción {globalIndex + 1}"
                      value={labelWithoutUrl}
                      oninput={(e) => {
                        const newValue = (e.target as HTMLTextAreaElement).value;
                        const currentUrl = extractUrlFromText(option.label);
                        
                        // Si había URL, mantenerla al final; si no, solo el texto
                        if (currentUrl) {
                          option.label = newValue ? `${newValue} ${currentUrl}` : currentUrl;
                        } else {
                          option.label = newValue;
                        }
                        
                        // Sincronizar el value del textarea solo si detectamos URL nueva o cambio de URL
                        const textarea = e.target as HTMLTextAreaElement;
                        const updatedUrl = extractUrlFromText(option.label);
                        if (updatedUrl && updatedUrl !== currentUrl) {
                          const newLabelWithoutUrl = option.label.replace(updatedUrl, '').trim();
                          const cursorPos = textarea.selectionStart;
                          textarea.value = newLabelWithoutUrl;
                          textarea.setSelectionRange(cursorPos, cursorPos);
                        }
                      }}
                      onpaste={(e) => {
                        // Después de pegar, sincronizar el textarea solo si hay URL
                        setTimeout(() => {
                          const textarea = optionInputs[option.id];
                          if (textarea) {
                            const updatedUrl = extractUrlFromText(option.label);
                            if (updatedUrl) {
                              const newLabelWithoutUrl = option.label.replace(updatedUrl, '').trim();
                              const cursorPos = textarea.selectionStart;
                              textarea.value = newLabelWithoutUrl;
                              textarea.setSelectionRange(cursorPos, cursorPos);
                            }
                          }
                        }, 10);
                      }}
                      bind:this={optionInputs[option.id]}
                      maxlength="200"
                      onclick={(e) => e.stopPropagation()}
                    ></textarea>
                  {/if}
                  {#if errors[`option_${option.id}`] && activeAccordionIndex === index}
                    <div class="option-error">
                      <span class="error-icon">⚠️</span>
                      <span class="error-text">{errors[`option_${option.id}`]}</span>
                    </div>
                  {/if}
                </div>
                <div class="card-content {activePreviewOption === option.id ? 'hidden-for-preview' : ''}">
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
                  <div
                    role="button"
                    tabindex="0"
                    class="remove-option-badge"
                    onclick={(e) => {
                      e.stopPropagation();
                      removeOption(option.id);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        removeOption(option.id);
                      }
                    }}
                    title="Eliminar"
                  >
                    <X class="w-3.5 h-3.5" />
                  </div>
                {/if}
                <!-- Botón para toggle preview en móvil -->
                {#if isTouchDevice && (detectedUrl || option.imageUrl)}
                  <div
                    role="button"
                    tabindex="0"
                    class="toggle-preview-badge"
                    onclick={(e) => {
                      e.stopPropagation();
                      activePreviewOption = activePreviewOption === option.id ? null : option.id;
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        activePreviewOption = activePreviewOption === option.id ? null : option.id;
                      }
                    }}
                    title={activePreviewOption === option.id ? "Mostrar controles" : "Ocultar controles"}
                    aria-label={activePreviewOption === option.id ? "Mostrar controles" : "Ocultar controles"}
                  >
                    {#if activePreviewOption === option.id}
                      <Eye class="w-4 h-4" />
                    {:else}
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    {/if}
                  </div>
                {/if}
                <div
                  role="button"
                  tabindex="0"
                  class="color-picker-badge-absolute"
                  style="background-color: {option.color}"
                  onclick={(e) => {
                    e.stopPropagation();
                    colorPickerOpenFor = option.id;
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      colorPickerOpenFor = option.id;
                    }
                  }}
                  title="Cambiar color"
                  aria-label="Cambiar color"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
              </button>
            {/each}
          </div>
        </div>
        
        <!-- Contenedor para paginación y botón flotante -->
        <div class="pagination-container">
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
        </div>
        
        <!-- Botón flotante abajo a la derecha -->
        {#if options.length < 10}
          {@const nextColor = COLORS[options.length % COLORS.length]}
          <div class="add-option-wrapper">
            <button
              type="button"
              class="add-option-floating-bottom"
              style="border-color: {nextColor};"
              onclick={addOption}
              title="Añadir opción"
              aria-label="Añadir nueva opción"
            >
              <Plus class="w-6 h-6" />
            </button>
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

<!-- Modal de Autenticación -->
<AuthModal bind:isOpen={showAuthModal} on:login={handleAuthComplete} />

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
  
  @media (min-width: 768px) {
    .modal-overlay {
      right: auto;
      width: 700px;
    }
  }
  
  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #181a20;
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
    background: #181a20;
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
  
  .title-input-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
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
    flex: 1;
    padding: 0;
    padding-right: 0.5rem;
    font-family: inherit;
    letter-spacing: -0.02em;
    min-height: 42px;
    max-height: 300px;
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
    position: relative;
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
                box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                min-height 0.3s ease;
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
  
  .vote-card.is-active {
    min-height: 400px;
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
    z-index: 2;
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
    z-index: 2;
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
    pointer-events: none;
  }
  
  .vote-card.is-active .question-title.editable {
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    white-space: pre-wrap;
    pointer-events: auto;
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
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
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
    flex: 1;
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
  }
  
  .vote-card.is-active .card-content {
    justify-content: flex-start;
    padding-top: 8px;
    gap: 8px;
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
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    background: transparent;
    pointer-events: none;
    min-height: 60px;
  }
  
  .percentage-display.is-active {
    justify-content: flex-start;
    align-items: flex-start;
    padding-left: 8px;
    min-height: 40px;
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
  
  /* Botón para toggle preview en móvil */
  .toggle-preview-badge {
    position: absolute;
    bottom: 16px;
    right: 60px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    transition: all 0.2s ease;
    pointer-events: auto;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .vote-card.is-active .toggle-preview-badge {
    right: 60px;
  }
  
  .toggle-preview-badge:hover {
    background: rgba(59, 130, 246, 0.8);
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.15);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  }
  
  .color-picker-badge-absolute {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    transition: all 0.2s ease;
    pointer-events: auto;
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
  
  /* Indicador de carga del preview */
  .preview-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.9);
    z-index: 2;
  }
  
  .preview-loading p {
    font-size: 14px;
    margin: 0;
  }
  
  .preview-loading p.text-sm {
    font-size: 12px;
  }
  
  /* Preview multimedia del título principal */
  .main-media-preview {
    width: 100%;
    max-width: 100%;
    height: 140px;
    margin: 12px 0;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    background: #2c2c2e;
    position: relative;
    z-index: 1;
  }
  
  .remove-preview-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }
  
  .remove-preview-btn:hover {
    background: rgba(239, 68, 68, 0.9);
    transform: scale(1.1);
  }
  
  .remove-preview-btn:active {
    transform: scale(0.95);
  }
  
  /* Estilos para MediaEmbed de fondo en opciones */
  .option-media-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 16px;
    overflow: hidden;
    z-index: 0;
    transition: z-index 0.3s ease;
  }
  
  /* Modo interactivo - traer el preview al frente */
  .option-media-background.interactive-mode {
    z-index: 5;
    cursor: default;
  }
  
  .remove-option-preview-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 12;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .remove-option-preview-btn:hover {
    background: rgba(239, 68, 68, 0.9);
    transform: scale(1.1);
  }
  
  .remove-option-preview-btn:active {
    transform: scale(0.95);
  }
  
  /* Wrapper para LinkPreview en opciones */
  .option-link-preview-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    overflow: hidden;
  }
  
  .option-link-preview-wrapper :global(.link-preview) {
    max-width: 100%;
    width: 100%;
    height: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  /* LinkPreview en título principal */
  .main-media-preview :global(.link-preview) {
    width: 100%;
    max-width: 100%;
    margin: 0;
  }
  
  .media-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.6) 0%,
      rgba(0, 0, 0, 0.3) 40%,
      rgba(0, 0, 0, 0.6) 100%
    );
    pointer-events: none;
    z-index: 1;
    transition: opacity 0.3s ease;
  }
  
  .media-overlay.hidden {
    opacity: 0;
  }
  
  /* Ocultar elementos cuando el preview está en modo interactivo */
  .hidden-for-preview {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  
  /* Wrapper del botón flotante */
  .add-option-wrapper {
    position: relative;
    width: 100%;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 20px;
    margin-top: 8px;
  }
  
  /* Botón flotante abajo a la derecha */
  .add-option-floating-bottom {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: rgba(20, 20, 25, 0.98);
    border: none;
    border-bottom: 3px solid;
    color: rgba(255, 255, 255, 0.95);
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    z-index: 10;
  }
  
  .add-option-floating-bottom:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    background: rgba(30, 30, 35, 1);
  }
  
  .add-option-floating-bottom:active {
    transform: translateY(0);
  }
  
  /* Contenedor de paginación y botón */
  .pagination-container {
    position: relative;
    width: 100%;
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
  
  /* Tooltip de formato */
  .info-tooltip-container {
    position: relative;
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 0.25rem;
  }
  
  .info-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 0.5rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .info-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.95);
  }
  
  .format-tooltip {
    position: fixed;
    top: 80px;
    right: 20px;
    width: 380px;
    max-width: 90vw;
    background: rgba(20, 20, 25, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    z-index: 999999;
  }
  
  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .tooltip-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: white;
  }
  
  .tooltip-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .tooltip-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .tooltip-description {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.5;
    margin: 0 0 0.75rem 0;
  }
  
  .tooltip-template {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    max-height: 240px;
    overflow-y: auto;
  }
  
  .tooltip-template code {
    display: block;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  
  .copy-format-btn {
    width: 100%;
    padding: 0.625rem 1rem;
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .copy-format-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }
  
  .copy-format-btn:active {
    transform: translateY(0);
  }
  
  /* Option error styles */
  .option-error {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    padding: 6px 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    animation: slideDown 0.2s ease-out;
  }
  
  .option-error .error-icon {
    font-size: 12px;
    flex-shrink: 0;
  }
  
  .option-error .error-text {
    font-size: 11px;
    color: rgba(239, 68, 68, 0.9);
    line-height: 1.3;
    word-break: break-word;
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
  
  @media (max-width: 480px) {
    .format-tooltip {
      width: calc(100vw - 32px);
      right: -8px;
    }
  }
  
  /* Responsive */
  @media (min-width: 768px) {
    .modal-container {
      left: 0;
      right: auto;
      width: 100%;
      max-width: 700px;
      border-radius: 0 1.25rem 0 0;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    }
    
    .modal-content {
      padding: 3rem 2.5rem;
      padding-bottom: 3rem;
    }
  }
</style>
