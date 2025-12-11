<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { onMount, tick } from 'svelte';
  
  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
  }
  
  let { isOpen = $bindable(false), onClose }: Props = $props();
  
  // Estado principal
  let message = $state('');
  let subMessage = $state('');
  let isRunning = $state(false);
  let canAdvance = $state(true);
  let canGoBack = $state(false);
  let showSkip = $state(true);
  let showFinalOptions = $state(false);
  let currentStepIndex = $state(0);
  
  // Síntesis de voz
  let speechEnabled = $state(true);
  let isSpeaking = $state(false);
  let speechSynth: SpeechSynthesis | null = null;
  let spanishVoice: SpeechSynthesisVoice | null = null;
  
  // Posición del mensaje flotante
  let messagePos = $state<'top' | 'bottom' | 'center'>('center');
  
  // Dedo animado
  let finger = $state({ x: 0, y: 0, visible: false, tapping: false });
  
  // Spotlight para resaltar elemento
  let spotlight = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  let showDimOverlay = $state(false);
  
  // Control de la demo
  let demoAborted = false;
  
  // === UTILIDADES ===
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  
  function hideFinger() {
    finger = { ...finger, visible: false, tapping: false };
    spotlight = null;
    showDimOverlay = false;
  }
  
  // Inicializar síntesis de voz
  function initSpeech() {
    if (typeof window === 'undefined') return;
    
    speechSynth = window.speechSynthesis;
    
    // Buscar voz en español
    const loadVoices = () => {
      const voices = speechSynth?.getVoices() || [];
      // Prioridad: español de España, luego cualquier español
      spanishVoice = voices.find(v => v.lang === 'es-ES') 
        || voices.find(v => v.lang.startsWith('es'))
        || voices.find(v => v.lang === 'es-MX')
        || null;
      
      if (spanishVoice) {
        console.log('[Tutorial] Voz seleccionada:', spanishVoice.name, spanishVoice.lang);
      }
    };
    
    // Las voces pueden tardar en cargar
    if (speechSynth?.getVoices().length > 0) {
      loadVoices();
    } else {
      speechSynth?.addEventListener('voiceschanged', loadVoices);
    }
  }
  
  // Hablar texto
  function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!speechEnabled || !speechSynth || demoAborted) {
        resolve();
        return;
      }
      
      // Cancelar cualquier discurso anterior
      speechSynth.cancel();
      
      // Limpiar emojis y caracteres especiales para mejor pronunciación
      const cleanText = text
        .replace(/[📝🎨🎬🖼️🔗✓🗑️➕⏱️🚀🎉👋👆🛠️📋✅]/g, '')
        .replace(/➜/g, 'siguiente')
        .trim();
      
      if (!cleanText) {
        resolve();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0; // Velocidad normal
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }
      
      isSpeaking = true;
      
      utterance.onend = () => {
        isSpeaking = false;
        resolve();
      };
      
      utterance.onerror = () => {
        isSpeaking = false;
        resolve();
      };
      
      speechSynth.speak(utterance);
    });
  }
  
  // Detener voz
  function stopSpeech() {
    if (speechSynth) {
      speechSynth.cancel();
      isSpeaking = false;
    }
  }
  
  // Toggle voz on/off
  function toggleSpeech() {
    speechEnabled = !speechEnabled;
    if (!speechEnabled) {
      stopSpeech();
    }
  }
  
  // showMessage con control de voz
  async function showMessage(text: string, sub = '', pos: 'top' | 'bottom' | 'center' = 'bottom', shouldSpeak = true) {
    message = text;
    subMessage = sub;
    messagePos = pos;
    
    // Solo hablar si shouldSpeak es true
    if (speechEnabled && shouldSpeak) {
      const fullText = sub ? `${text}. ${sub}` : text;
      speak(fullText);
    }
    
    await wait(100);
  }
  
  // Esperar a que el usuario pulse un elemento específico
  let waitingForElement: Element | null = null;
  let elementClickResolver: (() => void) | null = null;
  
  function waitForElementClick(el: Element): Promise<void> {
    return new Promise(resolve => {
      waitingForElement = el;
      elementClickResolver = resolve;
      
      // Añadir listener temporal al elemento
      const handleClick = () => {
        el.removeEventListener('click', handleClick);
        waitingForElement = null;
        elementClickResolver = null;
        resolve();
      };
      
      el.addEventListener('click', handleClick);
    });
  }
  
  // Escribir texto SIN hacer focus (evita teclado móvil)
  async function writeTextNoFocus(input: HTMLInputElement | HTMLTextAreaElement | null, text: string, speed = 60) {
    if (!input || demoAborted) return;
    
    const rect = input.getBoundingClientRect();
    spotlight = {
      x: rect.left - 8,
      y: rect.top - 8,
      width: rect.width + 16,
      height: rect.height + 16
    };
    showDimOverlay = true;
    
    for (let i = 0; i < text.length && !demoAborted; i++) {
      input.value = text.substring(0, i + 1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(speed);
    }
  }
  
  async function fingerTo(el: Element | null, tap = false) {
    if (!el || demoAborted) return;
    const rect = el.getBoundingClientRect();
    
    // Activar overlay oscuro y spotlight
    showDimOverlay = true;
    spotlight = {
      x: rect.left - 8,
      y: rect.top - 8,
      width: rect.width + 16,
      height: rect.height + 16
    };
    
    finger = { 
      x: rect.left + rect.width / 2, 
      y: rect.top + rect.height / 2, 
      visible: true, 
      tapping: false 
    };
    await wait(500); // Más lento
    
    if (tap && !demoAborted) {
      finger = { ...finger, tapping: true };
      await wait(200); // Más lento
      (el as HTMLElement).click();
      await wait(150); // Más lento
      finger = { ...finger, tapping: false };
    }
  }
  
  async function fingerSwipe(startX: number, endX: number, y: number) {
    if (demoAborted) return;
    showDimOverlay = true;
    const steps = 15; // Más pasos = más suave
    const delta = (endX - startX) / steps;
    
    for (let i = 0; i <= steps && !demoAborted; i++) {
      finger = { x: startX + delta * i, y, visible: true, tapping: false };
      await wait(70); // Más lento
    }
    await wait(200);
  }
  
  // Apuntar a un elemento (sin pulsar)
  async function pointTo(el: Element | null) {
    if (!el || demoAborted) return;
    const rect = el.getBoundingClientRect();
    
    showDimOverlay = true;
    spotlight = {
      x: rect.left - 8,
      y: rect.top - 8,
      width: rect.width + 16,
      height: rect.height + 16
    };
    
    finger = { 
      x: rect.left + rect.width / 2, 
      y: rect.top + rect.height / 2, 
      visible: true, 
      tapping: false 
    };
    await wait(300);
  }
  
  async function writeText(input: HTMLInputElement | HTMLTextAreaElement | null, text: string, speed = 60) {
    if (!input || demoAborted) return;
    // Resaltar el input mientras se escribe
    const rect = input.getBoundingClientRect();
    spotlight = {
      x: rect.left - 8,
      y: rect.top - 8,
      width: rect.width + 16,
      height: rect.height + 16
    };
    showDimOverlay = true;
    
    for (let i = 0; i < text.length && !demoAborted; i++) {
      input.value = text.substring(0, i + 1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(speed);
    }
  }
  
  function getInput(selector: string): HTMLInputElement | HTMLTextAreaElement | null {
    return document.querySelector(selector);
  }
  
  function getEl(selector: string): Element | null {
    return document.querySelector(selector);
  }
  
  function getEls(selector: string): NodeListOf<Element> {
    return document.querySelectorAll(selector);
  }
  
  // === TUTORIAL INTERACTIVO CON GUION AMIGABLE ===
  async function runDemo() {
    if (isRunning) return;
    isRunning = true;
    demoAborted = false;
    canAdvance = false;
    
    try {
      // ========== INTRO ==========
      await showMessage('¡Hola, creador!', 'Vamos a hacer tu primera encuesta juntos. ¡Será muy fácil y divertido!', 'center');
      canAdvance = true;
      canGoBack = false;
      currentStepIndex = 0;
      await waitForTap();
      if (demoAborted) return;
      
      canGoBack = true;
      currentStepIndex = 1;
      
      // ========== PASO 1: EL TÍTULO ==========
      const titleInput = getInput('.poll-title-input');
      if (titleInput) {
        await pointTo(titleInput);
        await showMessage('Primero, la pregunta', 'Aquí escribes lo que quieres preguntar. ¡Toca para empezar!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        await showMessage('...', '', 'top', false);
        canAdvance = false;
        await writeTextNoFocus(titleInput, '¿Cuál es tu red social favorita?', 35);
        await wait(300);
        await showMessage('¡Genial! Ya tenemos la pregunta', '', 'top');
        await wait(1000);
      }
      hideFinger();
      
      // ========== PASO 2: NÚMERO DE OPCIONES ==========
      await wait(300); // Esperar a que los elementos estén listos
      const optionsCountBtn = getEl('.meta-item-compact.options-btn, .options-btn');
      if (optionsCountBtn) {
        await pointTo(optionsCountBtn);
        await showMessage('Número de opciones', 'Aquí eliges cuántas opciones tendrá tu encuesta. ¡Toca!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (optionsCountBtn as HTMLElement).click();
        await wait(500);
        await showMessage('Puedes tener desde 2 hasta 10 opciones', '', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        const backdrop = getEl('.dropdown-backdrop');
        if (backdrop) (backdrop as HTMLElement).click();
        await wait(200);
      } else {
        console.warn('[Tutorial] No se encontró el botón de opciones');
      }
      hideFinger();
      
      // ========== PASO 3: DURACIÓN ==========
      const durationBtn = getEl('.duration-btn');
      if (durationBtn) {
        await pointTo(durationBtn);
        await showMessage('Tiempo de la encuesta', 'Define cuánto tiempo estará activa. ¡Toca!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (durationBtn as HTMLElement).click();
        await wait(500);
        await showMessage('1 hora, 1 día, 1 semana... ¡tú decides!', '', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        const backdrop = getEl('.dropdown-backdrop');
        if (backdrop) (backdrop as HTMLElement).click();
        await wait(200);
      }
      hideFinger();
      
      // ========== PASO 4: OPCIÓN 1 - COLOR ==========
      await goToSlide(0);
      await wait(300);
      
      await showMessage('¡Vamos con las opciones!', 'Cada tarjeta es una respuesta diferente', 'top');
      canAdvance = true;
      await waitForTap();
      if (demoAborted) return;
      
      // Escribir opción 1
      let optInput = getInput('.option-slide.is-active .option-label-edit');
      if (optInput) {
        await pointTo(optInput);
        await showMessage('Primera opción', 'Toca para escribir', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        await showMessage('...', '', 'top', false);
        canAdvance = false;
        await wait(200);
        await writeTextNoFocus(optInput, 'VouTop', 50);
        await wait(400);
      }
      hideFinger();
      
      // Explicar botón COLOR
      const colorBtn = getEl('.color-btn');
      if (colorBtn) {
        await pointTo(colorBtn);
        await showMessage('Botón de COLOR', 'Dale vida con un color llamativo. ¡Toca!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (colorBtn as HTMLElement).click();
        await wait(400);
        await showMessage('¡Elige el que más te guste!', '', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        const backdrop = getEl('.color-picker-backdrop, .dropdown-backdrop');
        if (backdrop) (backdrop as HTMLElement).click();
        await wait(200);
      }
      hideFinger();
      
      // ========== DESLIZAR A OPCIÓN 2 ==========
      hideFinger();
      spotlight = null;
      showDimOverlay = false;
      await wait(200);
      await showMessage('Vamos a la siguiente', '', 'top');
      await swipeToSlide(1);
      await wait(200);
      
      // ========== PASO 5: OPCIÓN 2 - GIF ==========
      await wait(300); // Esperar a que el slide esté listo
      const opt2Input = getInput('.option-slide.is-active .option-label-edit');
      if (opt2Input) {
        await pointTo(opt2Input);
        await showMessage('Segunda opción', 'Toca para escribir', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        await showMessage('...', '', 'top', false);
        canAdvance = false;
        await wait(200);
        await writeTextNoFocus(opt2Input, 'Instagram', 50);
        await wait(400);
      }
      hideFinger();
      
      // Explicar botón GIF
      const gifBtn = getEl('.option-slide.is-active .giphy-btn');
      if (gifBtn) {
        await pointTo(gifBtn);
        await showMessage('Botón de GIF', '¡Añade un GIF animado! Toca.', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (gifBtn as HTMLElement).click();
        await wait(500);
        await showMessage('¡Busca uno que te encante!', '', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await wait(300);
      }
      hideFinger();
      
      // ========== CREAR OPCIÓN 3 ==========
      hideFinger();
      spotlight = null;
      showDimOverlay = false;
      await wait(200);
      
      // Crear opción 3 (se muestra automáticamente)
      const addBtn3 = getEl('.add-option-floating-bottom');
      if (addBtn3) {
        await pointTo(addBtn3);
        await showMessage('Añadimos otra opción', 'Toca para crear la tercera', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        (addBtn3 as HTMLElement).click();
        await wait(800); // Esperar a que la nueva opción se renderice completamente
      }
      hideFinger();
      
      // ========== PASO 6: OPCIÓN 3 - SÍ/NO ==========
      await wait(300); // Esperar a que el slide esté listo
      const opt3Input = getInput('.option-slide.is-active .option-label-edit');
      if (opt3Input) {
        await pointTo(opt3Input);
        await showMessage('Tercera opción', 'Toca para escribir', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        await showMessage('...', '', 'top', false);
        canAdvance = false;
        await wait(200); // Esperar antes de escribir
        await writeTextNoFocus(opt3Input, 'TikTok', 50);
        await wait(400);
      }
      hideFinger();
      
      // Explicar botón SÍ/NO
      const yesnoBtn = getEl('.option-slide.is-active .yesno-btn');
      if (yesnoBtn) {
        await pointTo(yesnoBtn);
        await showMessage('Botón Sí/No', 'Actívalo para que los usuarios voten SÍ o NO en esta opción', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (yesnoBtn as HTMLElement).click();
        await wait(400);
        await showMessage('¡Activado!', 'Ahora los usuarios verán botones de SÍ y NO para votar. Puedes personalizar los textos.', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        await showMessage('Perfecto para preguntas como:', '"¿Te gusta esta opción?" o "¿Estás de acuerdo?"', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        (yesnoBtn as HTMLElement).click();
        await wait(200);
      }
      hideFinger();
      
      // ========== CREAR OPCIÓN 4 ==========
      hideFinger();
      spotlight = null;
      showDimOverlay = false;
      await wait(200);
      
      // Crear opción 4 (se muestra automáticamente)
      const addBtn4 = getEl('.add-option-floating-bottom');
      if (addBtn4) {
        await pointTo(addBtn4);
        await showMessage('¡Una más!', 'Toca para crear la última opción', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        (addBtn4 as HTMLElement).click();
        await wait(800); // Esperar a que la nueva opción se renderice completamente
      }
      hideFinger();
      
      // ========== PASO 7: OPCIÓN 4 - CORRECTA ==========
      await wait(300); // Esperar a que el slide esté listo
      const opt4Input = getInput('.option-slide.is-active .option-label-edit');
      if (opt4Input) {
        await pointTo(opt4Input);
        await showMessage('Cuarta opción', 'Toca para escribir', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        await showMessage('...', '', 'top', false);
        canAdvance = false;
        await wait(200); // Esperar antes de escribir
        await writeTextNoFocus(opt4Input, 'YouTube', 50);
        await wait(400);
      }
      hideFinger();
      
      // Explicar botón CORRECTA
      const correctBtn = getEl('.option-slide.is-active .correct-btn');
      if (correctBtn) {
        await pointTo(correctBtn);
        await showMessage('Botón Correcta', 'Convierte tu encuesta en un QUIZ marcando la respuesta correcta', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (correctBtn as HTMLElement).click();
        await wait(400);
        await showMessage('¡Marcada como correcta!', 'Cuando los usuarios voten, verán si acertaron o no', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        await showMessage('Ideal para trivia:', '"¿Cuál es la capital de Francia?" - Los usuarios descubrirán la respuesta al votar', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
      }
      hideFinger();
      
      // ========== PASO 8: BOTÓN ELIMINAR ==========
      const deleteBtn = getEl('.option-slide.is-active .delete-btn');
      if (deleteBtn) {
        await pointTo(deleteBtn);
        await showMessage('Botón Eliminar', 'Borra la opción si te equivocas. ¡Cuidado!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
      }
      hideFinger();
      
      // ========== PASO 9: TIPOS DE VOTACIÓN ==========
      // Explicar los 3 tipos principales abriendo el modal
      const pollTypeBtns = getEls('.poll-type-btn-inline');
      if (pollTypeBtns.length > 0) {
        // Tipo 1: Única
        const singleBtn = pollTypeBtns[0];
        if (singleBtn) {
          await pointTo(singleBtn);
          await showMessage('Votación Única', 'Solo pueden elegir UNA opción. Perfecta para "¿Cuál prefieres?"', 'top');
          canAdvance = true;
          await waitForTap();
          if (demoAborted) return;
          
          hideFinger();
          (singleBtn as HTMLElement).click();
          await wait(400);
          await showMessage('Mira las opciones disponibles', 'Cada tipo tiene configuraciones diferentes', 'top');
          canAdvance = true;
          await waitForTap();
          if (demoAborted) return;
          
          // Cerrar modal
          const closeModal = getEl('.type-options-modal .close-btn, .modal-backdrop');
          if (closeModal) (closeModal as HTMLElement).click();
          await wait(300);
        }
        hideFinger();
        
        // Tipo 2: Múltiple
        if (pollTypeBtns.length > 1) {
          const multiBtn = pollTypeBtns[1];
          await pointTo(multiBtn);
          await showMessage('Votación Múltiple', 'Pueden elegir VARIAS opciones. Ideal para "¿Qué te gusta?"', 'top');
          canAdvance = true;
          await waitForTap();
          if (demoAborted) return;
          
          hideFinger();
          (multiBtn as HTMLElement).click();
          await wait(400);
          await showMessage('Aquí puedes limitar cuántas opciones pueden elegir', '', 'top');
          canAdvance = true;
          await waitForTap();
          if (demoAborted) return;
          
          const closeModal2 = getEl('.type-options-modal .close-btn, .modal-backdrop');
          if (closeModal2) (closeModal2 as HTMLElement).click();
          await wait(300);
        }
        hideFinger();
        
        // Tipo 3: Colaborativa
        if (pollTypeBtns.length > 2) {
          const collabBtn = pollTypeBtns[2];
          await pointTo(collabBtn);
          await showMessage('Votación Colaborativa', '¡Los usuarios pueden AÑADIR sus propias opciones!', 'top');
          canAdvance = true;
          await waitForTap();
          if (demoAborted) return;
          
          hideFinger();
          (collabBtn as HTMLElement).click();
          await wait(400);
          await showMessage('Perfecta para lluvia de ideas o sugerencias', '', 'top');
          canAdvance = true;
          await waitForTap();
          if (demoAborted) return;
          
          const closeModal3 = getEl('.type-options-modal .close-btn, .modal-backdrop');
          if (closeModal3) (closeModal3 as HTMLElement).click();
          await wait(300);
        }
      }
      hideFinger();
      
      // Botón de IA/Animar con GIFs
      const animateBtn = getEl('.animate-cards-button');
      if (animateBtn) {
        await pointTo(animateBtn);
        await showMessage('Botón Mágico ✨', 'Busca GIFs automáticamente para todas tus opciones. ¡Toca!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        hideFinger();
        (animateBtn as HTMLElement).click();
        await showMessage('Buscando GIFs...', 'Espera un momento mientras la IA trabaja', 'top');
        await wait(3000); // Esperar a que se carguen los GIFs
        
        await showMessage('¡Listo!', 'Veamos qué GIFs encontró para cada opción', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        // Recorrer cada opción para mostrar los GIFs añadidos
        hideFinger();
        spotlight = null;
        showDimOverlay = false;
        await wait(200);
        
        // Ir a opción 1
        await goToSlide(0);
        await wait(400);
        await showMessage('Opción 1: VouTop', 'Mira el GIF que encontró', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        // Deslizar a opción 2
        await swipeToSlide(1);
        await wait(300);
        await showMessage('Opción 2: Instagram', 'Cada GIF combina con el texto', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        // Deslizar a opción 3
        await swipeToSlide(2);
        await wait(300);
        await showMessage('Opción 3: TikTok', '¡La IA entiende el contexto!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
        
        // Deslizar a opción 4
        await swipeToSlide(3);
        await wait(300);
        await showMessage('Opción 4: YouTube', '¡Todas las opciones animadas!', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
      }
      hideFinger();
      
      // Maximizar
      const maximizeBtn = getEl('.maximize-button');
      if (maximizeBtn) {
        await pointTo(maximizeBtn);
        await showMessage('Botón Maximizar', 'Agranda la tarjeta para editar con más detalle', 'top');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
      }
      hideFinger();
      
      await showMessage('¡Todas las opciones listas!', 'Tu encuesta está casi terminada', 'top');
      canAdvance = true;
      await waitForTap();
      if (demoAborted) return;
      
      // ========== PASO 11: PUBLICAR ==========
      const publishBtn = getEl('.publish-btn, [class*="publish"], button[type="submit"]');
      if (publishBtn) {
        await pointTo(publishBtn);
        await showMessage('¡El botón mágico!', 'Cuando todo esté perfecto, pulsa PUBLICAR y comparte tu encuesta con el mundo', 'center');
        canAdvance = true;
        await waitForTap();
        if (demoAborted) return;
      }
      hideFinger();
      
      // ========== FINAL ==========
      await showMessage('¡Felicidades, ya eres un experto!', 'Ahora puedes crear encuestas increíbles. ¡Diviértete!', 'center');
      showSkip = false;
      showFinalOptions = true;
      
    } catch (e) {
      console.error('[Tutorial] Error:', e);
    } finally {
      isRunning = false;
      hideFinger();
    }
  }
  
  async function goToSlide(index: number) {
    const dots = getEls('.options-indicators-top button, .pagination-dots button');
    if (dots[index]) {
      (dots[index] as HTMLElement).click();
      await wait(350);
    }
  }
  
  async function goToLastSlide() {
    const dots = getEls('.options-indicators-top button, .pagination-dots button');
    if (dots.length > 0) {
      (dots[dots.length - 1] as HTMLElement).click();
      await wait(350);
    }
  }
  
  // Deslizar a slide con animación del dedo
  async function swipeToSlide(index: number) {
    const slider = getEl('.options-horizontal-scroll, .options-slides-wrapper');
    if (slider) {
      const rect = slider.getBoundingClientRect();
      // Mostrar dedo y hacer swipe
      finger = { x: rect.right - 60, y: rect.top + rect.height / 2, visible: true, tapping: false };
      showDimOverlay = true;
      await wait(300);
      await fingerSwipe(rect.right - 60, rect.left + 60, rect.top + rect.height / 2);
      hideFinger();
    }
    // Navegar al slide
    await goToSlide(index);
  }
  
  // Esperar tap del usuario
  let tapResolver: (() => void) | null = null;
  
  function waitForTap(): Promise<void> {
    return new Promise(resolve => {
      tapResolver = resolve;
    });
  }
  
  function handleTap() {
    if (canAdvance && tapResolver) {
      tapResolver();
      tapResolver = null;
    }
  }
  
  function goToNextStep() {
    // Avanza al siguiente paso (igual que tap)
    if (canAdvance && tapResolver) {
      tapResolver();
      tapResolver = null;
    }
  }
  
  function goToPrevStep() {
    // Reiniciar el tutorial desde el principio
    if (canGoBack) {
      restartTutorial();
    }
  }
  
  function closeTutorial(clearPoll = false) {
    demoAborted = true;
    stopSpeech();
    isOpen = false;
    message = '';
    subMessage = '';
    showFinalOptions = false;
    hideFinger();
    if (tapResolver) {
      tapResolver();
      tapResolver = null;
    }
    
    if (clearPoll) {
      // Limpiar la encuesta
      resetPoll();
    }
    
    onClose?.();
  }
  
  function resetPoll() {
    // Limpiar título
    const titleInput = getInput('.poll-title-input');
    if (titleInput) {
      titleInput.value = '';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Limpiar todas las opciones
    const optionInputs = document.querySelectorAll('.option-text-input, .option-slide textarea');
    optionInputs.forEach((input) => {
      (input as HTMLInputElement | HTMLTextAreaElement).value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    // Eliminar GIFs/imágenes de las opciones
    const removeMediaBtns = document.querySelectorAll('[aria-label*="quitar"], [aria-label*="remove"], .remove-media-btn');
    removeMediaBtns.forEach((btn) => {
      (btn as HTMLElement).click();
    });
    
    // Volver a la primera opción
    const firstDot = document.querySelector('.options-indicators-top button, .pagination-dots button');
    if (firstDot) (firstDot as HTMLElement).click();
    
    console.log('[Tutorial] Encuesta limpiada');
  }
  
  function restartTutorial() {
    showFinalOptions = false;
    resetPoll();
    demoAborted = false;
    showSkip = true;
    canGoBack = false;
    currentStepIndex = 0;
    message = '';
    subMessage = '';
    setTimeout(() => runDemo(), 400);
  }
  
  function exitTutorial(clearPoll: boolean) {
    closeTutorial(clearPoll);
  }
  
  function skipTutorial() {
    closeTutorial(false);
  }
  
  // Iniciar cuando se abre
  $effect(() => {
    if (isOpen) {
      demoAborted = false;
      showSkip = true;
      initSpeech();
      setTimeout(() => runDemo(), 600);
    } else {
      stopSpeech();
    }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if isOpen}
  <!-- Overlay oscuro cuando hay animación -->
  {#if showDimOverlay}
    <div class="dim-overlay" transition:fade={{ duration: 200 }}></div>
  {/if}
  
  <!-- Spotlight para resaltar elemento -->
  {#if spotlight}
    <div 
      class="spotlight-ring"
      style="left: {spotlight.x}px; top: {spotlight.y}px; width: {spotlight.width}px; height: {spotlight.height}px;"
      transition:fade={{ duration: 150 }}
    ></div>
  {/if}
  
  <!-- Capa invisible para capturar clicks -->
  <div class="tutorial-overlay" onclick={handleTap} transition:fade={{ duration: 200 }}>
    
    <!-- Mensaje flotante -->
    {#if message}
      <div 
        class="floating-message {messagePos}"
        transition:fly={{ y: messagePos === 'top' ? -20 : 20, duration: 250 }}
      >
        <div class="message-content">
          <p class="main-text">{message}</p>
          {#if subMessage}
            <p class="sub-text">{subMessage}</p>
          {/if}
        </div>
        
        {#if canAdvance}
          <div class="tap-indicator">
            <span class="tap-dot"></span>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Barra de navegación inferior con controles centrales -->
    {#if !showFinalOptions && isRunning}
      <div class="bottom-nav-bar" transition:fade>
        <button class="nav-arrow prev" onclick={goToPrevStep} disabled={!canGoBack} aria-label="Anterior">
          <span>‹</span>
        </button>
        
        <!-- Controles centrales -->
        <div class="center-controls">
          <button 
            class="control-btn sound-btn" 
            class:muted={!speechEnabled}
            onclick={toggleSpeech} 
            aria-label={speechEnabled ? 'Silenciar voz' : 'Activar voz'}
          >
            {#if speechEnabled}
              🔊
            {:else}
              🔇
            {/if}
          </button>
          
          {#if showSkip}
            <button class="control-btn skip-btn" onclick={skipTutorial}>
              Saltar
            </button>
          {/if}
        </div>
        
        <button class="nav-arrow next" onclick={goToNextStep} disabled={!canAdvance} aria-label="Siguiente">
          <span>›</span>
        </button>
      </div>
    {/if}
    
    <!-- Opciones finales -->
    {#if showFinalOptions}
      <div class="final-options" transition:fly={{ y: 30, duration: 300 }}>
        <p class="final-question">¿Qué deseas hacer?</p>
        <div class="final-buttons">
          <button class="final-btn restart-btn" onclick={restartTutorial}>
            🔄 Repetir tutorial
          </button>
          <button class="final-btn exit-keep-btn" onclick={() => exitTutorial(false)}>
            ✅ Salir y mantener
          </button>
          <button class="final-btn exit-clear-btn" onclick={() => exitTutorial(true)}>
            🗑️ Salir y limpiar
          </button>
        </div>
      </div>
    {/if}
    
    <!-- Dedo animado -->
    {#if finger.visible}
      <div 
        class="demo-finger"
        class:tapping={finger.tapping}
        style="left: {finger.x}px; top: {finger.y + 25}px;"
      >
        <span class="finger-icon">👆</span>
        {#if finger.tapping}
          <div class="tap-ripple"></div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Overlay oscuro para resaltar acciones */
  .dim-overlay {
    position: fixed;
    inset: 0;
    z-index: 99998;
    background: rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  
  /* Spotlight ring para resaltar elemento */
  .spotlight-ring {
    position: fixed;
    z-index: 99999;
    border: 3px solid rgba(139, 92, 246, 0.8);
    border-radius: 12px;
    box-shadow: 
      0 0 0 4px rgba(139, 92, 246, 0.3),
      0 0 20px rgba(139, 92, 246, 0.5),
      0 0 40px rgba(139, 92, 246, 0.3),
      inset 0 0 20px rgba(139, 92, 246, 0.1);
    pointer-events: none;
    animation: spotlight-pulse 2s ease-in-out infinite;
  }
  
  @keyframes spotlight-pulse {
    0%, 100% {
      box-shadow: 
        0 0 0 4px rgba(139, 92, 246, 0.3),
        0 0 20px rgba(139, 92, 246, 0.5),
        0 0 40px rgba(139, 92, 246, 0.3),
        inset 0 0 20px rgba(139, 92, 246, 0.1);
    }
    50% {
      box-shadow: 
        0 0 0 6px rgba(139, 92, 246, 0.4),
        0 0 30px rgba(139, 92, 246, 0.6),
        0 0 60px rgba(139, 92, 246, 0.4),
        inset 0 0 30px rgba(139, 92, 246, 0.15);
    }
  }
  
  .tutorial-overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    pointer-events: auto;
    cursor: pointer;
  }
  
  /* Barra de navegación inferior */
  .bottom-nav-bar {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100001;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 28px;
  }
  
  .nav-arrow {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.3);
    border: 1px solid rgba(139, 92, 246, 0.5);
    color: white;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .nav-arrow:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.5);
  }
  
  .nav-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  /* Controles centrales */
  .center-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .control-btn {
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
  
  .sound-btn {
    font-size: 18px;
    padding: 6px 10px;
    min-width: 40px;
  }
  
  .sound-btn.muted {
    opacity: 0.5;
  }
  
  .skip-btn {
    font-size: 12px;
    padding: 6px 12px;
  }
  
  /* Mensaje flotante */
  .floating-message {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100002;
    max-width: 340px;
    width: calc(100% - 32px);
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(15, 15, 25, 0.98), rgba(25, 25, 40, 0.98));
    backdrop-filter: blur(20px);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 16px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(139, 92, 246, 0.15) inset,
      0 0 60px rgba(139, 92, 246, 0.15);
  }
  
  .floating-message.top {
    top: 16px;
  }
  
  .floating-message.bottom {
    bottom: 100px;
  }
  
  .floating-message.center {
    top: 50%;
    transform: translate(-50%, -50%);
  }
  
  .message-content {
    text-align: center;
  }
  
  .main-text {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: white;
    line-height: 1.4;
  }
  
  .sub-text {
    margin: 8px 0 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }
  
  /* Indicador de tap */
  .tap-indicator {
    display: flex;
    justify-content: center;
    margin-top: 12px;
  }
  
  .tap-dot {
    width: 8px;
    height: 8px;
    background: rgba(139, 92, 246, 0.8);
    border-radius: 50%;
    animation: pulse-tap 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse-tap {
    0%, 100% { 
      transform: scale(1); 
      opacity: 1;
      box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4);
    }
    50% { 
      transform: scale(1.2); 
      opacity: 0.8;
      box-shadow: 0 0 0 8px rgba(139, 92, 246, 0);
    }
  }
  
  /* Dedo animado */
  .demo-finger {
    position: fixed;
    z-index: 100002;
    pointer-events: none;
    transform: translateX(-50%);
    transition: left 0.2s ease-out, top 0.2s ease-out;
  }
  
  .finger-icon {
    font-size: 32px;
    display: block;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
    transition: transform 0.1s ease;
  }
  
  .demo-finger.tapping .finger-icon {
    transform: scale(0.85) translateY(-4px);
  }
  
  .tap-ripple {
    position: absolute;
    top: 0;
    left: 50%;
    width: 20px;
    height: 20px;
    background: rgba(139, 92, 246, 0.6);
    border-radius: 50%;
    transform: translateX(-50%) scale(0);
    animation: ripple-expand 0.4s ease-out forwards;
  }
  
  @keyframes ripple-expand {
    0% { 
      transform: translateX(-50%) scale(0); 
      opacity: 1; 
    }
    100% { 
      transform: translateX(-50%) scale(3); 
      opacity: 0; 
    }
  }
  
  /* Opciones finales */
  .final-options {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100003;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
    background: linear-gradient(135deg, rgba(15, 15, 25, 0.98), rgba(25, 25, 40, 0.98));
    backdrop-filter: blur(20px);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 20px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 60px rgba(139, 92, 246, 0.2);
  }
  
  .final-question {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: white;
    text-align: center;
  }
  
  .final-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  
  .final-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 24px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 200px;
  }
  
  .restart-btn {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
  }
  
  .restart-btn:hover {
    background: linear-gradient(135deg, #9d6eff, #8b5cf6);
    transform: scale(1.02);
  }
  
  .exit-keep-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }
  
  .exit-keep-btn:hover {
    background: linear-gradient(135deg, #34d399, #10b981);
    transform: scale(1.02);
  }
  
  .exit-clear-btn {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .exit-clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    transform: scale(1.02);
  }
  
  /* Responsive */
  @media (max-width: 480px) {
    .floating-message {
      max-width: calc(100% - 24px);
      padding: 14px 16px;
    }
    
    .main-text {
      font-size: 15px;
    }
    
    .sub-text {
      font-size: 12px;
    }
    
    .top-controls {
      top: 12px;
      right: 12px;
      gap: 6px;
    }
    
    .control-btn {
      padding: 6px 12px;
      font-size: 12px;
    }
    
    .sound-btn {
      font-size: 16px;
      padding: 5px 8px;
      min-width: 36px;
    }
    
    .nav-arrows {
      bottom: 16px;
      gap: 60px;
    }
    
    .nav-arrow {
      width: 44px;
      height: 44px;
      font-size: 24px;
    }
    
    .floating-message.top {
      top: 12px;
    }
    
    .floating-message.bottom {
      bottom: 80px;
    }
    
    .spotlight-ring {
      border-width: 2px;
    }
    
    .final-options {
      bottom: 60px;
      left: 12px;
      right: 12px;
      transform: none;
      padding: 20px 16px;
    }
    
    .final-btn {
      padding: 12px 20px;
      font-size: 14px;
      min-width: unset;
    }
  }
</style>
