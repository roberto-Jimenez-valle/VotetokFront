<script lang="ts">
  import { fade, fly, scale } from "svelte/transition";
  import {
    X,
    Plus,
    Trash2,
    Image as ImageIcon,
    Sparkles,
    BarChart2,
    Trophy,
    ListOrdered,
    Wand2,
    RefreshCw,
    Users,
    Wand,
    Loader2,
    ArrowLeftRight,
    Check,
    Clock,
    ChevronUp,
    ChevronDown,
    List,
    GripVertical,
    Calendar,
    Infinity,
    Zap,
    User,
    UserPlus,
    Globe,
    Lock,
    Search,
    ChevronLeft,
    ArrowLeft,
    Info,
    Search as SearchIcon,
    Palette,
    Eye,
    Save,
    AlertCircle,
    HelpCircle,
    Send,
  } from "lucide-svelte";
  import { createEventDispatcher, onMount, tick } from "svelte";
  import GiphyPicker from "$lib/components/GiphyPicker.svelte";
  import { searchGiphy, getBestGifUrl } from "$lib/services/giphy";
  import { searchTenor, getBestTenorUrl } from "$lib/services/tenor";
  import { currentUser, isAuthenticated } from "$lib/stores/auth";
  import { apiPost } from "$lib/api/client";
  import AuthModal from "$lib/AuthModal.svelte";

  const dispatch = createEventDispatcher<{
    created: any;
  }>();

  interface Props {
    isOpen?: boolean;
    buttonColors?: string[];
  }

  let { isOpen = $bindable(false), buttonColors = [] }: Props = $props();

  // --- CONFIGURACIÓN DE TIPOS ---
  const CREATOR_TYPES = [
    {
      id: "standard",
      label: "Votar",
      icon: BarChart2,
      color: "from-[#9ec264] to-[#7a994a]",
      textColor: "text-[#9ec264]",
      hex: "#9ec264",
      helpTitle: "Modo Votar",
      helpDesc:
        "La encuesta clásica de VouTop. Los usuarios eligen su opción favorita entre todas las disponibles. Ideal para conocer la opinión general sobre un tema específico.",
    },
    {
      id: "quiz",
      label: "Trivial",
      icon: Trophy,
      color: "from-[#f0b100] to-[#c79200]",
      textColor: "text-[#f0b100]",
      hex: "#f0b100",
      helpTitle: "Modo Trivial",
      helpDesc:
        'Pon a prueba a tu audiencia. Debes marcar una de las opciones como "correcta". Los usuarios verán si han acertado o fallado inmediatamente después de votar.',
    },
    {
      id: "tierlist",
      label: "Ranking",
      icon: ListOrdered,
      color: "from-[#4f39f6] to-[#3a29b8]",
      textColor: "text-[#4f39f6]",
      hex: "#4f39f6",
      helpTitle: "Modo Ranking",
      helpDesc:
        "Los usuarios elegirán su tier list. Permite que cada usuario organice las opciones a su gusto para generar un orden de preferencia promedio.",
    },
    {
      id: "swipe",
      label: "Swipe",
      icon: ArrowLeftRight,
      color: "from-[#e7000b] to-[#b00008]",
      textColor: "text-[#e7000b]",
      hex: "#e7000b",
      helpTitle: "Modo Swipe",
      helpDesc:
        "Votación rápida estilo carrusel. Los usuarios deslizan cada opción individualmente para dar su aprobación o rechazo.",
    },
  ];

  const COLLAB_MODES = [
    {
      id: "me",
      label: "Solo yo",
      desc: "Nadie más puede añadir opciones",
      icon: Lock,
    },
    {
      id: "friends",
      label: "Solo mis amigos",
      desc: "Solo tus amigos pueden colaborar",
      icon: UserPlus,
    },
    {
      id: "selected",
      label: "Solo los elegidos",
      desc: "Selecciona cuentas específicas",
      icon: User,
    },
    {
      id: "anyone",
      label: "Cualquiera",
      desc: "Cualquier usuario puede añadir opciones",
      icon: Globe,
    },
  ];

  const MOCK_FOLLOWING = [
    {
      id: "u1",
      name: "Alex Marín",
      username: "@alexm",
      avatar: "bg-orange-500",
    },
    { id: "u2", name: "Sara Vega", username: "@sarav", avatar: "bg-pink-500" },
    {
      id: "u3",
      name: "Marcos Ruiz",
      username: "@mruiz",
      avatar: "bg-emerald-500",
    },
    {
      id: "u4",
      name: "Elena Soler",
      username: "@elenas",
      avatar: "bg-indigo-500",
    },
    {
      id: "u5",
      name: "David Ortíz",
      username: "@david_o",
      avatar: "bg-blue-500",
    },
  ];

  // --- ESTADOS ---
  let type = $state("standard");
  let question = $state("");
  let isSubmitting = $state(false);
  let showAuthModal = $state(false);

  // --- ESTADOS DE MODALES ---
  let showCollabModal = $state(false);
  let showDurationModal = $state(false);
  let showSortPanel = $state(false);
  let showHelpModal = $state(false);
  let showGiphyPicker = $state(false);
  let showColorSlider = $state<string | null>(null);
  let activeGiphyOptionId = $state<string | null>(null);
  let initialGiphySearch = $state("");
  let isAutoFetchingGif = $state<Record<string, boolean>>({});
  let showDiscardModal = $state(false);
  let showInfoPanel = $state(false);

  // --- ESTADOS DE BORRADORES ---
  let drafts = $state<any[]>([]);
  let showDeleteDraftModal = $state(false);
  let draftToDelete = $state<number | null>(null);

  // --- ESTADOS DE COLABORACIÓN ---
  let collabMode = $state("me");
  let isSelectingUsers = $state(false);
  let selectedUserIds = $state<string[]>([]);
  let userSearchQuery = $state("");

  // --- ESTADOS DE DURACIÓN ---
  let startsNow = $state(true);
  let isIndefinite = $state(true);
  let startDate = $state("");
  let endDate = $state("");

  // --- GESTIÓN DE OPCIONES ---
  let options = $state([
    {
      id: "opt-1",
      title: "",
      image: "",
      colorFrom: "hsl(239, 90%, 30%)",
      colorTo: "hsl(239, 95%, 15%)",
      isCorrect: false,
      gifOffset: 0,
      lastSearchTitle: "",
      gifSource: "tenor" as "giphy" | "tenor",
      tenorNextPos: "",
    },
    {
      id: "opt-2",
      title: "",
      image: "",
      colorFrom: "hsl(270, 90%, 30%)",
      colorTo: "hsl(270, 95%, 15%)",
      isCorrect: false,
      gifOffset: 0,
      lastSearchTitle: "",
      gifSource: "tenor" as "giphy" | "tenor",
      tenorNextPos: "",
    },
  ]);
  let draggedItemIndex = $state<number | null>(null);
  let correctOptionId = $state("opt-1");
  let activeIndex = $state(0);

  let scrollContainer: HTMLElement | null = $state(null);
  let modalScrollContainer: HTMLElement | null = $state(null);

  // --- LÓGICA DERIVADA ---
  let activeTypeData = $derived(
    CREATOR_TYPES.find((t) => t.id === type) || CREATOR_TYPES[0],
  );

  let filteredUsers = $derived(
    MOCK_FOLLOWING.filter(
      (u) =>
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()),
    ),
  );

  let activeCollabData = $derived(
    COLLAB_MODES.find((m) => m.id === collabMode) || COLLAB_MODES[0],
  );

  // Validación del formulario
  let validationErrors = $state<string[]>([]);

  let allOptionsValid = $derived(
    options.every((opt) => opt.title.trim().length >= 2),
  );

  let isFormValid = $derived(
    question.trim().length >= 2 && allOptionsValid && options.length >= 2,
  );

  function getValidationErrors(): string[] {
    const errors: string[] = [];
    if (question.trim().length < 2) {
      errors.push("La pregunta debe tener al menos 2 caracteres");
    }
    if (options.length < 2) {
      errors.push("Debes tener al menos 2 opciones");
    }
    const invalidOptions = options.filter((opt) => opt.title.trim().length < 2);
    if (invalidOptions.length > 0) {
      errors.push(
        `${invalidOptions.length} opción(es) sin texto válido (mínimo 2 caracteres)`,
      );
    }
    return errors;
  }

  // Detectar si hay cambios sin guardar
  let hasUnsavedChanges = $derived(
    question.trim().length > 0 ||
      options.some((opt) => opt.title.trim().length > 0 || opt.image),
  );

  // --- FUNCIONES ---
  function getDurationConfig() {
    const startText = startsNow
      ? "Ahora"
      : startDate
        ? startDate.split("T")[0].split("-").reverse().slice(0, 2).join("/")
        : "---";
    if (isIndefinite) {
      return { text: startText, indefinite: true };
    }
    const endText = endDate
      ? endDate.split("T")[0].split("-").reverse().slice(0, 2).join("/")
      : "---";
    return { text: `${startText} - ${endText}`, indefinite: false };
  }

  function getCollabLabel() {
    if (collabMode === "selected") return `${selectedUserIds.length} elegidos`;
    return (
      COLLAB_MODES.find((m) => m.id === collabMode)?.label || "Colaboración"
    );
  }

  function getTypeDescription() {
    switch (type) {
      case "standard":
        return "Encuesta normal con voto único";
      case "quiz":
        return "Esta opción será la correcta";
      case "tierlist":
        return "Los usuarios elegirán su tier list";
      case "swipe":
        return "Mejor opción para votos múltiples";
      default:
        return "";
    }
  }

  function handleScroll(e: Event) {
    const container = e.target as HTMLElement;
    const cardWidth = container.offsetWidth * 0.72 + 20;
    const index = Math.round(container.scrollLeft / cardWidth);

    if (!isNaN(index) && index !== activeIndex) {
      activeIndex = index;
    }
  }

  async function scrollToIndex(index: number) {
    if (scrollContainer) {
      const cards = scrollContainer.querySelectorAll(".option-card-unit");
      if (cards[index]) {
        cards[index].scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
        activeIndex = index;
      }
    }
  }

  function centerOptionById(id: string) {
    const idx = options.findIndex((o) => o.id === id);
    if (idx !== -1) {
      scrollToIndex(idx);
    }
  }

  function onDragStart(index: number) {
    draggedItemIndex = index;
  }

  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newOptions = [...options];
    const draggedItem = newOptions[draggedItemIndex];
    newOptions.splice(draggedItemIndex, 1);
    newOptions.splice(index, 0, draggedItem);
    draggedItemIndex = index;
    options = newOptions;
  }

  function onDragEnd() {
    draggedItemIndex = null;
  }

  function handleTypeChange(newType: string) {
    type = newType;
    if (newType === "quiz") {
      const currentOption = options[activeIndex] || options[0];
      if (currentOption) correctOptionId = currentOption.id;
    }
  }

  function addOption() {
    if (options.length >= 10) return;

    // Usamos el sistema HSL desde el principio con alta intensidad (index 0)
    const family = COLOR_FAMILIES[options.length % COLOR_FAMILIES.length];
    const range = SHADE_VALUES[0]; // Muy Intenso

    const newId = `opt-${Date.now()}`;
    options = [
      ...options,
      {
        id: newId,
        title: "",
        image: "",
        colorFrom: `hsl(${family.h}, 90%, ${range.l1}%)`,
        colorTo: `hsl(${family.h}, 95%, ${range.l2}%)`,
        isCorrect: false,
        gifOffset: 0,
        lastSearchTitle: "",
        gifSource: "tenor",
        tenorNextPos: "",
      },
    ];

    setTimeout(async () => {
      await scrollToIndex(options.length - 1);
      activeIndex = options.length - 1;
      if (showSortPanel && modalScrollContainer) {
        modalScrollContainer.scrollTo({
          top: modalScrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100);
  }

  const COLOR_FAMILIES = [
    { name: "Azul", hue: "blue", h: 217, hex: "#3b82f6" },
    { name: "Cian", hue: "cyan", h: 188, hex: "#06b6d4" },
    { name: "Esmeralda", hue: "emerald", h: 160, hex: "#10b981" },
    { name: "Lima", hue: "lime", h: 84, hex: "#84cc16" },
    { name: "Ámbar", hue: "amber", h: 45, hex: "#f59e0b" },
    { name: "Naranja", hue: "orange", h: 25, hex: "#f97316" },
    { name: "Rojo", hue: "red", h: 0, hex: "#ef4444" },
    { name: "Rosa", hue: "rose", h: 350, hex: "#f43f5e" },
    { name: "Fucsia", hue: "fuchsia", h: 295, hex: "#d946ef" },
    { name: "Púrpura", hue: "purple", h: 270, hex: "#a855f7" },
    { name: "Índigo", hue: "indigo", h: 239, hex: "#6366f1" },
  ];

  const SHADE_VALUES = [
    { l1: 30, l2: 15 }, // 1. Muy Intenso
    { l1: 40, l2: 20 },
    { l1: 50, l2: 30 },
    { l1: 60, l2: 40 },
    { l1: 70, l2: 50 }, // 5. Equilibrado
    { l1: 75, l2: 60 },
    { l1: 80, l2: 70 },
    { l1: 85, l2: 75 },
    { l1: 90, l2: 80 },
    { l1: 95, l2: 85 }, // 10. Pastel
  ];

  function getOptionColorSetup(id: string) {
    const opt = options.find((o) => o.id === id);
    if (!opt) return { hueIdx: 0, shadeIdx: 4 };

    const from = opt.colorFrom || "";

    // Si ya es HSL: "hsl(217, 90%, 50%)"
    if (from.startsWith("hsl")) {
      const match = from.match(/hsl\((\d+)/);
      const h = match ? parseInt(match[1]) : 217;
      const hueIdx = COLOR_FAMILIES.findIndex(
        (f) => Math.abs((f.h || 0) - h) < 10,
      );

      const lMatch = from.match(/(\d+)%\)/);
      const l = lMatch ? parseInt(lMatch[1]) : 50;
      const shadeIdx = SHADE_VALUES.findIndex((s) => s.l1 === l);

      return {
        hueIdx: hueIdx === -1 ? 0 : hueIdx,
        shadeIdx: shadeIdx === -1 ? 4 : shadeIdx,
      };
    }

    // Compatibilidad con Tailwind antiguo
    const parts = from.split("-");
    const hue = parts[1] || "blue";
    const hueIdx = COLOR_FAMILIES.findIndex((f) => f.hue === hue);
    return { hueIdx: hueIdx === -1 ? 0 : hueIdx, shadeIdx: 4 };
  }

  function handleDualSliderChange(
    id: string,
    hueIdx: number,
    shadeIdx: number,
  ) {
    const family = COLOR_FAMILIES[hueIdx];
    const range = SHADE_VALUES[shadeIdx];

    updateOptionMultiple(id, {
      colorFrom: `hsl(${family.h}, 90%, ${range.l1}%)`,
      colorTo: `hsl(${family.h}, 95%, ${range.l2}%)`,
    });
  }

  function getOptionCssColors(opt: any, alpha: number = 1) {
    let from = opt.colorFrom || "";
    let to = opt.colorTo || "";

    // Si no empieza con hsl, es el formato antiguo de Tailwind (o inicial)
    if (!from.startsWith("hsl")) {
      const parts = from.split("-");
      const hue = parts[1] || "blue";
      const family =
        COLOR_FAMILIES.find((f) => f.hue === hue) || COLOR_FAMILIES[0];
      from = `hsl(${family.h}, 90%, 50%)`;
      to = `hsl(${family.h}, 95%, 25%)`;
    }

    if (alpha < 1) {
      // Convertimos hsl(h, s, l) a hsla(h, s, l, a) de forma segura
      const fromHsla = from.replace("hsl", "hsla").replace(")", `, ${alpha})`);
      const toHsla = to
        .replace("hsl", "hsla")
        .replace(")", `, ${alpha + 0.1})`);
      return { from: fromHsla, to: toHsla };
    }

    return { from, to };
  }

  function removeOption(id: string) {
    options = options.filter((o) => o.id !== id);

    // Si no quedan opciones, creamos una nueva automáticamente
    if (options.length === 0) {
      addOption();
    }

    if (activeIndex >= options.length) {
      activeIndex = Math.max(0, options.length - 1);
    }
  }

  function toggleColorSlider(id: string) {
    if (showColorSlider === id) {
      showColorSlider = null;
    } else {
      showColorSlider = id;
      centerOptionById(id);
    }
  }

  function updateOption(id: string, field: string, value: any) {
    options = options.map((o) => (o.id === id ? { ...o, [field]: value } : o));
  }

  function updateOptionMultiple(id: string, updates: Record<string, any>) {
    options = options.map((o) => (o.id === id ? { ...o, ...updates } : o));
  }

  function toggleUserSelection(userId: string) {
    if (selectedUserIds.includes(userId)) {
      selectedUserIds = selectedUserIds.filter((id) => id !== userId);
    } else {
      selectedUserIds = [...selectedUserIds, userId];
    }
  }

  function openGiphyPicker(optionId: string) {
    activeGiphyOptionId = optionId;
    const opt = options.find((o) => o.id === optionId);
    initialGiphySearch = opt?.title || "";
    showGiphyPicker = true;
    centerOptionById(optionId);
  }

  function handleGifSelect(url: string) {
    if (activeGiphyOptionId) {
      updateOption(activeGiphyOptionId, "image", url);
    }
    showGiphyPicker = false;
    activeGiphyOptionId = null;
    initialGiphySearch = "";
  }

  async function autoFetchGif(id: string, next: boolean = false) {
    centerOptionById(id);
    const opt = options.find((o) => o.id === id);
    if (!opt || !opt.title.trim()) {
      openGiphyPicker(id);
      return;
    }

    const currentTitle = opt.title.trim().toLowerCase();
    const titleChanged = currentTitle !== (opt as any).lastSearchTitle;

    isAutoFetchingGif[id] = true;
    try {
      // Siempre empezar por Tenor si el título cambia o si no hay imagen
      let source =
        titleChanged || !opt.image
          ? "tenor"
          : (opt as any).gifSource || "tenor";
      let gifUrl = "";
      let nextPos = "";
      let nextOffset = 0;

      if (source === "tenor") {
        // Usar el token 'next' guardado si estamos pidiendo el siguiente
        const pos =
          next && !titleChanged ? (opt as any).tenorNextPos || "" : "";

        const results = await searchTenor(opt.title, {
          limit: 1,
          pos: pos,
        });

        if (results && results.length > 0) {
          gifUrl = getBestTenorUrl(results[0]);
          nextPos = (results as any).next || "";
        }
      }

      // Si Tenor no devuelve nada o si ya pasamos por Tenor y queremos probar Giphy
      // (O si decidimos alternar tras X intentos, pero por ahora Tenor es prioridad)
      if (!gifUrl) {
        source = "giphy";
        const offset =
          next && !titleChanged ? ((opt as any).gifOffset || 0) + 1 : 0;
        const results = await searchGiphy(opt.title, {
          limit: 1,
          offset: offset,
        });
        if (results && results.length > 0) {
          gifUrl = getBestGifUrl(results[0]);
          nextOffset = offset;
        }
      }

      if (gifUrl) {
        updateOptionMultiple(id, {
          image: gifUrl,
          gifOffset: nextOffset,
          gifSource: source,
          tenorNextPos: nextPos,
          lastSearchTitle: currentTitle,
        });
      }
    } catch (err) {
      console.error("[CreatePollModal] Error auto-fetching GIF:", err);
    } finally {
      isAutoFetchingGif[id] = false;
    }
  }

  function colorToHex(color: string): string {
    if (!color) return "#3b82f6";
    if (color.startsWith("#")) return color;

    // Si es HSL: hsl(217, 90%, 50%)
    if (color.startsWith("hsl")) {
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        let h = parseInt(match[1]) / 360;
        let s = parseInt(match[2]) / 100;
        let l = parseInt(match[3]) / 100;

        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          const hue2rgb = (t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          r = hue2rgb(h + 1 / 3);
          g = hue2rgb(h);
          b = hue2rgb(h - 1 / 3);
        }
        const toHex = (x: number) => {
          const hex = Math.round(x * 255).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }

    // Si es legacy Tailwind: "indigo-600" o "from-indigo-600"
    const cleanColor = color.replace("from-", "").split("-")[0];
    const family = COLOR_FAMILIES.find((f) => f.hue === cleanColor);
    return family?.hex || "#3b82f6";
  }

  async function handleSubmit() {
    // Siempre mostrar errores si hay alguno
    const errors = getValidationErrors();
    if (errors.length > 0) {
      validationErrors = errors;
      // Auto-ocultar después de 4 segundos
      setTimeout(() => {
        validationErrors = [];
      }, 4000);
      return;
    }

    if (isSubmitting) return;

    if (!$isAuthenticated || !$currentUser) {
      showAuthModal = true;
      return;
    }

    isSubmitting = true;
    try {
      const pollData = {
        userId: $currentUser.userId || ($currentUser as any).id,
        title: question.trim(),
        type: type,
        options: options.map((opt, idx) => ({
          optionKey: opt.id,
          optionLabel: opt.title || `Opción ${idx + 1}`,
          colorFrom: opt.colorFrom,
          colorTo: opt.colorTo,
          color: colorToHex(opt.colorFrom), // Convertimos a Hex para la BD
          imageUrl: opt.image || undefined,
          isCorrect: type === "quiz" ? opt.id === correctOptionId : false,
          displayOrder: idx,
        })),
        settings: {
          collabMode,
          selectedUserIds: collabMode === "selected" ? selectedUserIds : [],
          startsNow,
          isIndefinite,
          startDate: !startsNow ? startDate : undefined,
          endDate: !isIndefinite ? endDate : undefined,
        },
      };

      const response = await apiPost("/api/polls", pollData);
      dispatch("created", response.data);
      close();
    } catch (error) {
      console.error("Error creating poll:", error);
    } finally {
      isSubmitting = false;
    }
  }

  function close() {
    isOpen = false;
    resetForm();
    validationErrors = [];
    showInfoPanel = false;
  }

  function tryClose() {
    if (hasUnsavedChanges) {
      showDiscardModal = true;
    } else {
      close();
    }
  }

  function discardChanges() {
    showDiscardModal = false;
    close();
  }

  function saveDraft() {
    // Guardar en localStorage (en producción se guardaría en BD)
    const draft = {
      question,
      type,
      options,
      collabMode,
      selectedUserIds,
      startsNow,
      isIndefinite,
      startDate,
      endDate,
      savedAt: new Date().toISOString(),
    };

    // Añadir al array de borradores existente
    const existingDrafts = JSON.parse(
      localStorage.getItem("poll_drafts") || "[]",
    );
    existingDrafts.unshift(draft); // Añadir al principio
    localStorage.setItem("poll_drafts", JSON.stringify(existingDrafts));

    // TODO: Guardar en base de datos cuando esté disponible
    // await apiPost("/api/polls/drafts", draft);

    showDiscardModal = false;
    close();
  }

  function checkForDraft() {
    const savedDrafts = localStorage.getItem("poll_drafts");
    if (savedDrafts) {
      try {
        drafts = JSON.parse(savedDrafts);
      } catch {
        drafts = [];
      }
    } else {
      drafts = [];
    }
  }

  function loadDraft(index: number) {
    const draft = drafts[index];
    if (draft) {
      question = draft.question || "";
      type = draft.type || "standard";
      options = draft.options || [];
      collabMode = draft.collabMode || "me";
      selectedUserIds = draft.selectedUserIds || [];
      startsNow = draft.startsNow ?? true;
      isIndefinite = draft.isIndefinite ?? true;
      startDate = draft.startDate || "";
      endDate = draft.endDate || "";

      // NO eliminar el borrador - se mantiene hasta que se publique o se elimine manualmente
    }
  }

  function deleteDraft(index: number) {
    draftToDelete = index;
    showDeleteDraftModal = true;
  }

  function confirmDeleteDraft() {
    if (draftToDelete !== null) {
      drafts = drafts.filter((_, i) => i !== draftToDelete);
      localStorage.setItem("poll_drafts", JSON.stringify(drafts));
    }
    draftToDelete = null;
    showDeleteDraftModal = false;
  }

  function loadDraftFromModal() {
    if (draftToDelete !== null) {
      loadDraft(draftToDelete);
    }
    showDeleteDraftModal = false;
    draftToDelete = null;
  }

  // Comprobar si hay borrador al abrir
  $effect(() => {
    if (isOpen) {
      checkForDraft();
    }
  });

  function resetForm() {
    question = "";
    type = "standard";
    options = [
      {
        id: "opt-1",
        title: "",
        image: "",
        colorFrom: "hsl(239, 90%, 30%)",
        colorTo: "hsl(239, 95%, 15%)",
        isCorrect: false,
        gifOffset: 0,
        lastSearchTitle: "",
        gifSource: "tenor",
        tenorNextPos: "",
      },
      {
        id: "opt-2",
        title: "",
        image: "",
        colorFrom: "hsl(270, 90%, 30%)",
        colorTo: "hsl(270, 95%, 15%)",
        isCorrect: false,
        gifOffset: 0,
        lastSearchTitle: "",
        gifSource: "tenor",
        tenorNextPos: "",
      },
    ];
    collabMode = "me";
    selectedUserIds = [];
    startsNow = true;
    isIndefinite = true;
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-[100] flex flex-col bg-[#050505] text-slate-100 font-sans overflow-hidden select-none tracking-tight"
    transition:fade
  >
    <!-- HEADER -->
    <header
      class="mx-3 my-2 flex justify-between items-center z-50 flex-shrink-0"
    >
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <button
          onclick={tryClose}
          class="p-2 bg-white/5 rounded-full text-white/70 hover:text-white transition-all active:scale-90 flex-shrink-0"
        >
          <ArrowLeft size={22} />
        </button>

        {#if drafts.length > 0}
          <!-- Contenedor scroll horizontal para borradores -->
          <div
            class="flex-1 min-w-0 overflow-x-auto overflow-y-visible scrollbar-hide py-4 -my-2"
          >
            <div class="flex items-center gap-3 px-1">
              {#each drafts as draft, index}
                <div class="relative flex-shrink-0">
                  <button
                    onclick={() => loadDraft(index)}
                    class="relative group flex flex-col items-center"
                    title="Restaurar borrador"
                  >
                    <div
                      class="w-16 h-16 rounded-md overflow-hidden shadow-lg relative"
                      style={draft.options?.[0]?.image
                        ? ""
                        : `background: linear-gradient(135deg, ${draft.options?.[0]?.colorFrom || "hsl(239, 90%, 30%)"}, ${draft.options?.[0]?.colorTo || "hsl(239, 95%, 15%)"})`}
                    >
                      {#if draft.options?.[0]?.image}
                        <img
                          src={draft.options[0].image}
                          alt=""
                          class="w-full h-full object-cover"
                        />
                      {/if}
                      <!-- Overlay con título -->
                      <div
                        class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center pb-0.5"
                      >
                        <span
                          class="text-[7px] font-bold text-white/90 max-w-10 truncate text-center drop-shadow-lg"
                        >
                          {draft.question?.slice(0, 8) || "..."}
                        </span>
                      </div>
                      <!-- Overlay de hover -->
                      <div
                        class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"
                      >
                        <div
                          class="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Check size={16} class="text-white drop-shadow-lg" />
                        </div>
                      </div>
                    </div>
                  </button>

                  <!-- Botón X flotante -->
                  <button
                    onclick={() => deleteDraft(index)}
                    class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black text-white/80 hover:text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center shadow-lg z-10 ring-2 ring-white/80"
                    title="Eliminar borrador"
                  >
                    <X size={14} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0 relative">
        <!-- Botón de lanzar con badge de advertencia -->
        <div class="relative">
          <button
            onclick={() => {
              if (isFormValid) {
                handleSubmit();
              } else {
                showInfoPanel = !showInfoPanel;
              }
            }}
            disabled={isSubmitting}
            class={`p-3.5 rounded-full transition-all active:scale-90 ${isFormValid && !isSubmitting ? "bg-white text-black shadow-xl" : "bg-slate-800 text-slate-500"}`}
            title={isFormValid ? "Lanzar encuesta" : "Completa los requisitos"}
          >
            {#if isSubmitting}
              <Loader2 size={22} class="animate-spin" />
            {:else}
              <Send size={22} />
            {/if}
          </button>

          <!-- Badge de advertencia (esquina superior izquierda) -->
          {#if !isFormValid}
            <button
              onclick={() => (showInfoPanel = !showInfoPanel)}
              class="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg ring-2 ring-black transition-all hover:scale-110 active:scale-95"
              title="Ver requisitos"
            >
              <AlertCircle size={12} />
            </button>
          {/if}
        </div>

        <!-- Popup de requisitos -->
        {#if showInfoPanel && !isFormValid}
          <!-- Backdrop para cerrar al pulsar fuera -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="fixed inset-0 z-[90]"
            onclick={() => (showInfoPanel = false)}
          ></div>

          <div
            class="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl z-[100]"
            transition:fly={{ y: -10, duration: 200 }}
          >
            <!-- Botón cerrar -->
            <button
              onclick={() => (showInfoPanel = false)}
              class="absolute top-2 right-2 p-1 text-white/40 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>

            <p class="text-xs font-bold text-amber-400 mb-3">Requisitos</p>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                {#if question.trim().length >= 2}
                  <Check size={12} class="text-emerald-400" />
                {:else}
                  <X size={12} class="text-red-400" />
                {/if}
                <span
                  class="text-xs {question.trim().length >= 2
                    ? 'text-white/50'
                    : 'text-white/80'}">Pregunta (mín. 2 caracteres)</span
                >
              </div>
              <div class="flex items-center gap-2">
                {#if options.length >= 2}
                  <Check size={12} class="text-emerald-400" />
                {:else}
                  <X size={12} class="text-red-400" />
                {/if}
                <span
                  class="text-xs {options.length >= 2
                    ? 'text-white/50'
                    : 'text-white/80'}">Mínimo 2 opciones</span
                >
              </div>
              <div class="flex items-center gap-2">
                {#if allOptionsValid}
                  <Check size={12} class="text-emerald-400" />
                {:else}
                  <X size={12} class="text-red-400" />
                {/if}
                <span
                  class="text-xs {allOptionsValid
                    ? 'text-white/50'
                    : 'text-white/80'}">Todas las opciones con texto</span
                >
              </div>
            </div>
          </div>
        {/if}
      </div>
    </header>

    {#if validationErrors.length > 0}
      <div
        class="px-6 py-3 bg-red-500/20 border-b border-red-500/30 flex-shrink-0 animate-in slide-in-from-top duration-300"
      >
        <div class="flex items-start gap-3">
          <div class="flex-1">
            {#each validationErrors as error}
              <p class="text-red-400 text-sm font-medium">• {error}</p>
            {/each}
          </div>
          <button
            onclick={() => (validationErrors = [])}
            class="p-1 text-red-400 hover:text-red-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    {/if}

    <main class="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <!-- MODAL GESTIÓN OPCIONES -->
      {#if showSortPanel}
        <div
          class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => (showSortPanel = false)}
          />
          <div
            class="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col max-h-[85vh]"
            in:scale={{ start: 0.95, duration: 300 }}
          >
            <div class="flex justify-between items-center py-2 mb-4">
              <h3
                class="text-xl font-black uppercase tracking-widest text-white/90 ml-2"
              >
                Gestionar opciones
              </h3>
              <button
                onclick={() => (showSortPanel = false)}
                class="p-3 bg-white/5 rounded-full"><X size={20} /></button
              >
            </div>

            <div
              bind:this={modalScrollContainer}
              class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar"
            >
              {#each options as opt, idx (opt.id)}
                <div
                  draggable="true"
                  ondragstart={() => onDragStart(idx)}
                  ondragover={(e) => onDragOver(e, idx)}
                  ondragend={onDragEnd}
                  class={`relative border rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 overflow-hidden cursor-grab active:cursor-grabbing ${draggedItemIndex === idx ? "opacity-20 scale-95 border-[#9ec264]" : "border-white/10 opacity-100"}`}
                  style="background: linear-gradient(135deg, {getOptionCssColors(
                    opt,
                  ).from}, {getOptionCssColors(opt)
                    .to}); border-color: {getOptionCssColors(opt).from}"
                >
                  <div class="absolute inset-0 bg-black/5 -z-10" />
                  <GripVertical size={18} class="text-white/40 flex-shrink-0" />
                  <div
                    class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0 relative"
                  >
                    {#if opt.image}
                      <img
                        src={opt.image}
                        class="w-full h-full object-cover"
                        alt=""
                      />
                    {:else}
                      <ImageIcon size={18} class="text-white/10" />
                    {/if}
                  </div>
                  <div
                    class="flex-1 min-w-0 text-sm font-bold text-white/90 truncate"
                  >
                    {opt.title || "Sin título"}
                  </div>
                  <div class="flex items-center gap-1 relative z-10">
                    <button
                      onclick={() => {
                        centerOptionById(opt.id);
                        showSortPanel = false;
                      }}
                      class="p-2 text-white/60 hover:text-white transition-colors"
                      title="Ver en pantalla"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onclick={() => removeOption(opt.id)}
                      class="p-2 text-white/40 hover:text-white transition-colors"
                      title="Eliminar"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <div class="flex gap-3 mt-6">
              <button
                onclick={addOption}
                disabled={options.length >= 10}
                class="flex-1 py-4 bg-[#9ec264]/20 text-[#9ec264] border border-[#9ec264]/30 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                <Plus size={18} strokeWidth={4} />
                Añadir
              </button>
              <button
                onclick={() => (showSortPanel = false)}
                class="flex-[1.5] py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- MODAL DURACIÓN -->
      {#if showDurationModal}
        <div
          class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => (showDurationModal = false)}
          />
          <div
            class="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            in:scale={{ start: 0.95, duration: 300 }}
          >
            <div class="flex justify-between items-center mb-8">
              <h3
                class="text-xl font-black uppercase tracking-widest text-white/90"
              >
                Duración
              </h3>
              <button
                onclick={() => (showDurationModal = false)}
                class="p-2 bg-white/5 rounded-full"><X size={20} /></button
              >
            </div>
            <div class="space-y-8 flex-1">
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-4">
                    <div
                      class={`w-16 h-16 flex items-center justify-center rounded-2xl transition-all ${startsNow ? "bg-[#9ec264]/10 text-[#9ec264]" : "bg-white/5 text-white/20"}`}
                    >
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 class="text-base font-black uppercase tracking-wider">
                        Inicio
                      </h4>
                      <p
                        class="text-[10px] text-white/40 uppercase tracking-tighter"
                      >
                        {startsNow ? "Al instante" : "Programado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onclick={() => (startsNow = !startsNow)}
                    class={`w-14 h-7 rounded-full p-1 transition-all ${startsNow ? "bg-[#9ec264]/80" : "bg-white/10"}`}
                    ><div
                      class={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${startsNow ? "translate-x-7" : "translate-x-0"}`}
                    /></button
                  >
                </div>
                {#if !startsNow}
                  <input
                    type="datetime-local"
                    bind:value={startDate}
                    class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#9ec264] transition-all"
                  />
                {/if}
              </div>
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <div
                    class={`w-16 h-16 flex items-center justify-center rounded-2xl transition-all ${isIndefinite ? "bg-[#9ec264]/10 text-[#9ec264]" : "bg-white/5 text-white/20"}`}
                  >
                    <Infinity size={32} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 class="text-base font-black uppercase tracking-wider">
                      Cierre
                    </h4>
                    <p
                      class="text-[10px] text-white/40 uppercase tracking-tighter"
                    >
                      {isIndefinite ? "Indefinida" : "Límite"}
                    </p>
                  </div>
                </div>
                <button
                  onclick={() => (isIndefinite = !isIndefinite)}
                  class={`w-14 h-7 rounded-full p-1 transition-all ${isIndefinite ? "bg-[#9ec264]/80" : "bg-white/10"}`}
                  ><div
                    class={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${isIndefinite ? "translate-x-7" : "translate-x-0"}`}
                  /></button
                >
              </div>
              {#if !isIndefinite}
                <input
                  type="datetime-local"
                  bind:value={endDate}
                  class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#9ec264] transition-all"
                />
              {/if}
            </div>
            <button
              onclick={() => (showDurationModal = false)}
              class="mt-10 w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >Guardar</button
            >
          </div>
        </div>
      {/if}

      <!-- MODAL COLABORACIÓN -->
      {#if showCollabModal}
        <div
          class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => {
              showCollabModal = false;
              isSelectingUsers = false;
            }}
          />
          <div
            class="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            in:fly={{ y: 50, duration: 300 }}
          >
            <div class="flex justify-between items-center mb-6">
              <h3
                class="text-xl font-black uppercase tracking-widest text-white/90"
              >
                {isSelectingUsers ? "Elegir Usuarios" : "Colaboración"}
              </h3>
              <button
                onclick={() => {
                  showCollabModal = false;
                  isSelectingUsers = false;
                }}
                class="p-2 bg-white/5 rounded-full"><X size={20} /></button
              >
            </div>
            {#if !isSelectingUsers}
              <div class="grid gap-4 flex-1">
                {#each COLLAB_MODES as mode}
                  <button
                    onclick={() => {
                      if (mode.id === "selected") isSelectingUsers = true;
                      else {
                        collabMode = mode.id;
                        showCollabModal = false;
                      }
                    }}
                    class={`flex items-center gap-5 p-6 rounded-2xl border transition-all duration-300 ${collabMode === mode.id ? "bg-[#9ec264]/20 border-[#9ec264]/40 shadow-xl" : "bg-white/5 border-white/5 text-white/50"}`}
                  >
                    <div
                      class={`p-4 rounded-xl ${collabMode === mode.id ? "bg-[#9ec264]/20" : "bg-black/20"}`}
                    >
                      <mode.icon
                        size={26}
                        class={collabMode === mode.id
                          ? "text-[#9ec264]"
                          : "text-white/40"}
                      />
                    </div>
                    <div class="text-left flex-1">
                      <p
                        class={`font-black uppercase tracking-wider text-sm ${collabMode === mode.id ? "text-white" : "text-white/70"}`}
                      >
                        {mode.label}
                      </p>
                      <p
                        class={`text-[10px] tracking-tight ${collabMode === mode.id ? "text-white/60" : "text-white/30"}`}
                      >
                        {mode.desc}
                      </p>
                    </div>
                    {#if collabMode === mode.id && mode.id !== "selected"}
                      <Check size={22} class="ml-auto text-[#9ec264]" />
                    {/if}
                  </button>
                {/each}
              </div>
            {:else}
              <div class="flex flex-col flex-1 overflow-hidden">
                <div class="relative mb-6">
                  <Search
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
                    size={18}
                  />
                  <input
                    bind:value={userSearchQuery}
                    placeholder="Buscar usuario..."
                    class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:border-[#9ec264]/40 transition-all"
                  />
                </div>
                <div
                  class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar"
                >
                  {#each filteredUsers as user}
                    <button
                      onclick={() => toggleUserSelection(user.id)}
                      class={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${selectedUserIds.includes(user.id) ? "bg-[#9ec264]/10 border-[#9ec264]/30" : "bg-white/5 border-transparent"}`}
                    >
                      <div
                        class={`w-10 h-10 rounded-full ${user.avatar} flex items-center justify-center text-white font-black text-sm`}
                      >
                        {user.name[0]}
                      </div>
                      <div class="text-left flex-1">
                        <p class="font-bold text-sm text-white">{user.name}</p>
                      </div>
                      <div
                        class={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedUserIds.includes(user.id) ? "bg-white border-white text-[#9ec264] scale-110" : "border-white/10"}`}
                      >
                        {#if selectedUserIds.includes(user.id)}
                          <Check size={14} strokeWidth={4} />
                        {/if}
                      </div>
                    </button>
                  {/each}
                </div>
                <button
                  onclick={() => {
                    collabMode = "selected";
                    isSelectingUsers = false;
                    showCollabModal = false;
                  }}
                  class="mt-6 w-full py-4 bg-[#9ec264] text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl"
                  >Confirmar ({selectedUserIds.length})</button
                >
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- MODAL DE AYUDA / INFO -->
      {#if showHelpModal && activeTypeData}
        <div
          class="fixed inset-0 z-[2000] flex items-center justify-center p-6"
          transition:fade
        >
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => (showHelpModal = false)}
          />
          <div
            class="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            in:scale={{ start: 0.95, duration: 300 }}
          >
            <div class="flex flex-col items-center text-center">
              <div
                class="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
                style="background-color: {activeTypeData.hex}20; border: 1px solid {activeTypeData.hex}40"
              >
                <activeTypeData.icon
                  size={36}
                  style="color: {activeTypeData.hex}"
                />
              </div>
              <h3
                class="text-2xl font-black uppercase tracking-widest mb-4"
                style="color: {activeTypeData.hex}"
              >
                {activeTypeData.helpTitle}
              </h3>
              <p class="text-white/60 text-sm leading-relaxed mb-8">
                {activeTypeData.helpDesc}
              </p>
              <button
                onclick={() => (showHelpModal = false)}
                class="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                >Entendido</button
              >
            </div>
          </div>
        </div>
      {/if}

      <!-- PREGUNTA Y CONFIGURACIÓN SUPERIOR -->
      <div class="px-6 pt-4 pb-2 flex-shrink-0">
        <textarea
          autofocus
          bind:value={question}
          placeholder="¿Qué quieres preguntar?"
          class="w-full bg-transparent border-none focus:ring-0 p-0 text-3xl font-black text-white placeholder-white/40 resize-none leading-none tracking-tighter outline-none appearance-none"
          rows="2"
        />
        <div class="flex items-center justify-center gap-2 mt-4">
          <button
            onclick={() => (showDurationModal = true)}
            class="flex items-center gap-3 px-5 py-2.5 bg-white/5 rounded-full border border-white/5 text-white active:scale-95 transition-all"
          >
            <Clock size={16} class="text-white/70" />
            <div
              class="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"
            >
              {#if getDurationConfig().indefinite}
                <span>{getDurationConfig().text}</span>
                <span class="opacity-30">-</span>
                <Infinity size={18} strokeWidth={3} class="text-white" />
              {:else}
                <span>{getDurationConfig().text}</span>
              {/if}
            </div>
          </button>

          <button
            onclick={() => (showCollabModal = true)}
            class={`flex items-center justify-center transition-all border active:scale-90 ${collabMode !== "me" ? "bg-[#9ec264] text-black border-[#9ec264] shadow-xl" : "bg-white/5 text-white/40 border-white/5"} ${collabMode === "selected" && selectedUserIds.length > 0 ? "px-3.5 h-10 gap-2 rounded-full" : "w-10 h-10 rounded-full"}`}
            title={getCollabLabel()}
          >
            <activeCollabData.icon size={18} />
            {#if collabMode === "selected" && selectedUserIds.length > 0}
              <span class="text-[11px] font-black"
                >{selectedUserIds.length}</span
              >
            {/if}
          </button>

          <button
            onclick={() => (showSortPanel = true)}
            class="flex items-center gap-2.5 px-4 py-2.5 bg-white/5 rounded-full border border-white/5 text-white/40 active:scale-90 transition-all text-[11px] font-black uppercase tracking-wider"
          >
            <List size={18} />
            <span class="opacity-80">{options.length}</span>
          </button>
        </div>
      </div>

      <!-- ÁREA CENTRAL: CARDS + PAGINACIÓN + INFO -->
      <div
        class="flex-1 flex flex-col justify-center min-h-0 py-0 overflow-hidden relative"
      >
        <div
          bind:this={scrollContainer}
          onscroll={handleScroll}
          class="flex h-full max-h-[820px] overflow-x-auto scrollbar-hide px-12 pt-6 pb-0 items-center gap-5"
        >
          {#each options as opt, idx (opt.id)}
            <div
              class="option-card-unit real-option-card-main flex-shrink-0 w-[72vw] sm:w-[320px] h-full flex flex-col relative"
            >
              <!-- Botón Eliminar Flotante (Fuera del overflow-hidden para verse por encima) -->
              <div class="absolute -top-3 -left-3 z-[150]">
                <button
                  onclick={() => removeOption(opt.id)}
                  class="p-2.5 rounded-full bg-black text-white shadow-2xl hover:bg-zinc-800 active:scale-90 transition-all border-2 border-white/20"
                  title="Eliminar opción"
                >
                  <X size={14} strokeWidth={4} />
                </button>
              </div>

              <div
                class={`flex-1 rounded-2xl border-2 shadow-2xl overflow-hidden relative transition-all duration-300 ${type === "quiz" && correctOptionId === opt.id ? "border-yellow-400 shadow-yellow-500/20" : "border-white/10"}`}
              >
                <div
                  class="absolute inset-0"
                  style="background: linear-gradient(135deg, {getOptionCssColors(
                    opt,
                  ).from}, {getOptionCssColors(opt).to})"
                >
                  {#if opt.image}
                    <img
                      src={opt.image}
                      class="w-full h-full object-cover animate-in fade-in"
                      alt=""
                    />
                  {/if}
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent"
                  />
                </div>
                <div
                  class="absolute top-6 left-6 z-30 bg-black/40 backdrop-blur-xl px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 text-white/70"
                >
                  #{idx + 1}
                </div>
                <div class="absolute bottom-6 left-6 right-20 z-20">
                  <textarea
                    bind:value={opt.title}
                    placeholder={`Opción ${idx + 1}...`}
                    class="w-full bg-transparent border-none focus:ring-0 p-0 text-xl font-black text-white placeholder-white/30 resize-none leading-tight outline-none appearance-none"
                    rows="3"
                  />
                </div>
                <div class="absolute bottom-6 right-3 z-30">
                  <div class="flex flex-col gap-2">
                    {#if type === "quiz"}
                      <button
                        onclick={() => {
                          correctOptionId = opt.id;
                          centerOptionById(opt.id);
                        }}
                        class={`p-3 rounded-2xl backdrop-blur-lg border transition-all ${correctOptionId === opt.id ? "bg-[#f0b100]/20 border-[#f0b100]/40 text-[#f0b100] shadow-lg shadow-[#f0b100]/10" : "bg-black/10 border-white/5 text-white/70 hover:text-white"}`}
                        ><Trophy size={18} /></button
                      >
                    {/if}

                    <div
                      class={`flex flex-col items-center rounded-2xl border backdrop-blur-lg transition-all overflow-hidden ${opt.image ? "bg-[#9ec264]/10 border-[#9ec264]/30 text-[#9ec264]" : "bg-black/20 border-white/10 text-white shadow-xl"}`}
                    >
                      {#if !opt.image}
                        <button
                          onclick={() => autoFetchGif(opt.id, false)}
                          class="p-3 w-full hover:bg-white/5 border-b border-white/5 transition-colors flex items-center justify-center"
                          disabled={isAutoFetchingGif[opt.id]}
                        >
                          {#if isAutoFetchingGif[opt.id]}
                            <Loader2 size={18} class="animate-spin" />
                          {:else}
                            <ImageIcon size={18} />
                          {/if}
                        </button>
                      {/if}
                      {#if !opt.image}
                        <div class="relative w-full flex flex-col items-center">
                          <button
                            onclick={() => toggleColorSlider(opt.id)}
                            class={`p-3 w-full transition-all flex items-center justify-center ${showColorSlider === opt.id ? "bg-white text-black" : "hover:bg-white/10 text-white/70"}`}
                          >
                            <Palette
                              size={18}
                              fill={showColorSlider === opt.id
                                ? "currentColor"
                                : "none"}
                            />
                          </button>
                        </div>
                      {/if}
                      {#if opt.image}
                        <button
                          onclick={() => autoFetchGif(opt.id, true)}
                          class="p-3 hover:bg-black/20 border-b border-white/5 transition-colors flex items-center justify-center"
                          title="Siguiente GIF"
                          disabled={isAutoFetchingGif[opt.id]}
                        >
                          {#if isAutoFetchingGif[opt.id]}
                            <Loader2 size={18} class="animate-spin" />
                          {:else}
                            <RefreshCw size={18} />
                          {/if}
                        </button>
                        <button
                          onclick={() => openGiphyPicker(opt.id)}
                          class="p-3 hover:bg-black/20 border-b border-white/5 transition-colors flex items-center justify-center"
                          title="Buscar manualmente"
                        >
                          <SearchIcon size={18} />
                        </button>
                        <button
                          onclick={() => {
                            updateOptionMultiple(opt.id, {
                              image: "",
                              gifOffset: 0,
                              tenorNextPos: "",
                            });
                            centerOptionById(opt.id);
                          }}
                          class="p-3 hover:bg-red-500/20 text-red-500/60 hover:text-red-500 transition-colors flex items-center justify-center"
                          title="Eliminar imagen"
                        >
                          <Trash2 size={18} />
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
          {#if options.length < 10}
            <div
              class="option-card-unit flex-shrink-0 w-[72vw] sm:w-[320px] h-full rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center transition-all relative bg-white/[0.01]"
            >
              <button
                onclick={addOption}
                class={`absolute top-1/2 -translate-y-1/2 z-[60] flex items-center justify-center text-white active:scale-90 transition-all duration-500 ease-in-out ${activeIndex === options.length ? "left-1/2 -translate-x-1/2 scale-150" : "md:left-1/2 md:-translate-x-1/2 -left-2 translate-x-0 scale-100"}`}
              >
                <Plus size={48} strokeWidth={3} />
              </button>
            </div>
          {/if}
          <div class="flex-shrink-0 w-2 h-full"></div>
        </div>

        <!-- NAVEGACIÓN E INFO -->
        <div class="flex flex-col items-center flex-shrink-0 py-4 mt-2">
          <div class="flex justify-center items-center gap-2 mb-4 md:hidden">
            {#each options as opt, idx (opt.id)}
              <button
                onclick={() => scrollToIndex(idx)}
                class={`transition-all duration-300 active:scale-90 ${activeIndex === idx ? "bg-white w-6 h-1 shadow-[0_0_10px_rgba(255,255,255,0.4)]" : "bg-white/10 w-1 h-1"} rounded-full`}
              />
            {/each}
            {#if options.length < 10}
              <button
                onclick={() => scrollToIndex(options.length)}
                class={`transition-all duration-300 active:scale-90 flex items-center justify-center ${activeIndex === options.length ? "text-white" : "text-white/20"}`}
              >
                <Plus
                  size={activeIndex === options.length ? 12 : 10}
                  strokeWidth={activeIndex === options.length ? 4 : 3}
                />
              </button>
            {/if}
          </div>
          <div class="h-10 flex items-center justify-center">
            {#if activeTypeData}
              <div
                class="flex items-center gap-3 px-4 py-2 rounded-full border backdrop-blur-xl shadow-lg transition-all"
                style="background-color: {activeTypeData.hex}15; border-color: {activeTypeData.hex}30"
              >
                <div class="flex items-center gap-2">
                  <activeTypeData.icon
                    size={14}
                    style="color: {activeTypeData.hex}"
                  />
                  <span
                    class="text-[10px] font-black uppercase tracking-[0.15em] leading-none"
                    style="color: {activeTypeData.hex}"
                    >{activeTypeData.label}</span
                  >
                </div>

                <div class="w-px h-3 bg-white/10 mx-0.5" />

                <span
                  class="text-[9px] font-black uppercase tracking-wider whitespace-nowrap opacity-60"
                  style="color: {activeTypeData.hex}"
                  >{getTypeDescription()}</span
                >

                <div class="w-px h-3 bg-white/10 mx-0.5" />

                <button
                  onclick={() => (showHelpModal = true)}
                  class="p-1 -mr-1 rounded-full text-white/40 hover:text-white transition-colors"
                  ><Info size={14} /></button
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
    </main>

    <!-- DOCK INFERIOR -->
    <footer
      class="relative z-50 bg-black border-t border-white/5 pb-4 pt-4 flex-shrink-0"
    >
      <div class="flex flex-col items-center">
        <div
          class="flex justify-center items-center gap-3 px-6 w-full max-w-md"
        >
          {#each CREATOR_TYPES as t}
            <button
              onclick={() => handleTypeChange(t.id)}
              class={`flex flex-col items-center gap-2 flex-1 transition-all duration-300 ${type === t.id ? "scale-105 opacity-100" : "opacity-30 grayscale"}`}
            >
              <div
                class={`p-3 rounded-2xl w-full flex items-center justify-center transition-all ${type === t.id ? `bg-gradient-to-br ${t.color} shadow-lg ring-1 ring-white/10` : "bg-slate-900 hover:bg-slate-800"}`}
              >
                {#if t.id === "swipe"}
                  <ArrowLeftRight size={20} class="text-white" />
                {:else}
                  <t.icon size={20} class="text-white" />
                {/if}
              </div>
              <span
                class={`text-[9px] font-black uppercase tracking-tighter ${type === t.id ? "text-white" : "text-slate-500"}`}
                >{t.label}</span
              >
            </button>
          {/each}
        </div>
      </div>
    </footer>

    <style>
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
      }
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      .custom-color-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        border: 2px solid rgba(255, 255, 255, 0.8);
        transition: transform 0.1s;
      }

      .custom-color-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }
    </style>
  </div>
{/if}

{#if showAuthModal}
  <AuthModal bind:isOpen={showAuthModal} />
{/if}

{#if showGiphyPicker}
  <div
    class="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    transition:fade
  >
    <div
      class="w-full max-w-lg h-[80vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
      transition:scale={{ start: 0.95, duration: 200 }}
    >
      <GiphyPicker
        onSelect={handleGifSelect}
        onClose={() => (showGiphyPicker = false)}
        optionColor={activeTypeData.hex}
        initialSearch={initialGiphySearch}
      />
    </div>
  </div>
{/if}

{#if showColorSlider}
  <div
    class="fixed inset-0 z-[2200] flex items-end justify-center p-3 sm:p-8 pb-2"
    transition:fade
    onclick={() => (showColorSlider = null)}
  >
    <div
      class="relative w-full max-w-lg bg-[#111] backdrop-blur-3xl p-7 rounded-3xl border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.9)] flex flex-col gap-4 z-[2210]"
      transition:fly={{ y: 50, duration: 300 }}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex justify-between items-center">
        <div class="flex flex-col">
          <h3
            class="text-xl font-black uppercase tracking-[0.1em] text-white m-0"
          >
            Color de opción
          </h3>
        </div>
        <button
          onclick={() => (showColorSlider = null)}
          class="p-2 -mr-2 text-white/40 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <!-- Tono (Hue) -->
      <div class="flex flex-col gap-4">
        <span
          class="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 px-1"
          >Tono Principal</span
        >
        <div class="relative h-4 flex items-center">
          <div
            class="absolute inset-0 rounded-full"
            style="background: linear-gradient(to right, #3b82f6, #06b6d4, #10b981, #84cc16, #f59e0b, #f97316, #ef4444, #f43f5e, #d946ef, #a855f7, #6366f1);"
          ></div>
          <input
            type="range"
            min="0"
            max={COLOR_FAMILIES.length - 1}
            step="1"
            value={getOptionColorSetup(showColorSlider).hueIdx}
            class="absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer z-10 custom-color-slider"
            oninput={(e) =>
              handleDualSliderChange(
                showColorSlider!,
                parseInt(e.currentTarget.value),
                getOptionColorSetup(showColorSlider!).shadeIdx,
              )}
          />
        </div>
      </div>

      <!-- Brillo (Shade) -->
      <div class="flex flex-col gap-4">
        <span
          class="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 px-1"
          >Intensidad</span
        >
        <div class="relative h-4 flex items-center">
          <div
            class="absolute inset-0 rounded-full"
            style="background: linear-gradient(to right, 
              {COLOR_FAMILIES[getOptionColorSetup(showColorSlider).hueIdx]
              .hex}, 
              #fff
            ); filter: brightness(0.6) saturate(1.8);"
          ></div>
          <input
            type="range"
            min="0"
            max={SHADE_VALUES.length - 1}
            step="1"
            value={getOptionColorSetup(showColorSlider).shadeIdx}
            class="absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer z-10 custom-color-slider"
            oninput={(e) =>
              handleDualSliderChange(
                showColorSlider!,
                getOptionColorSetup(showColorSlider!).hueIdx,
                parseInt(e.currentTarget.value),
              )}
          />
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showDiscardModal}
  <div
    class="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
    transition:fade
  >
    <div
      class="w-full max-w-sm bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      transition:scale={{ start: 0.95, duration: 200 }}
    >
      <div class="p-6 text-center border-b border-white/10">
        <h3 class="text-lg font-black text-white mb-2">¿Descartar encuesta?</h3>
        <p class="text-sm text-white/60">
          Tienes cambios sin guardar. ¿Qué quieres hacer?
        </p>
      </div>
      <div class="flex flex-col">
        <button
          onclick={saveDraft}
          class="py-4 px-6 text-sm font-bold text-[#9ec264] border-b border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
        >
          <Save size={18} />
          Guardar borrador
        </button>
        <button
          onclick={discardChanges}
          class="py-4 px-6 text-sm font-bold text-red-400 border-b border-white/10 hover:bg-white/5 transition-colors"
        >
          Descartar
        </button>
        <button
          onclick={() => (showDiscardModal = false)}
          class="py-4 px-6 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteDraftModal}
  <div
    class="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
    transition:fade
  >
    <div
      class="w-full max-w-sm bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      transition:scale={{ start: 0.95, duration: 200 }}
    >
      <div class="p-6 text-center border-b border-white/10">
        <h3 class="text-lg font-black text-white mb-2">¿Eliminar borrador?</h3>
        <p class="text-sm text-white/60">
          Esta acción no se puede deshacer. ¿Qué quieres hacer?
        </p>
      </div>
      <div class="flex flex-col">
        <button
          onclick={loadDraftFromModal}
          class="py-4 px-6 text-sm font-bold text-[#9ec264] border-b border-white/10 hover:bg-white/5 transition-colors"
        >
          Seguir editando
        </button>
        <button
          onclick={confirmDeleteDraft}
          class="py-4 px-6 text-sm font-bold text-red-400 border-b border-white/10 hover:bg-white/5 transition-colors"
        >
          Eliminar borrador
        </button>
        <button
          onclick={() => (showDeleteDraftModal = false)}
          class="py-4 px-6 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
{/if}
